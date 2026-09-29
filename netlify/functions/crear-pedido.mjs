// netlify/functions/crear-pedido.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Objeto de compatibilidad con interfaz admin estándar
const admin = {
  get apps() {
    return getApps();
  },
  initializeApp,
  credential: {
    cert
  },
  firestore: getFirestore
};

// Inicialización controlada de Firebase Admin
let db;
try {
  if (!admin.apps.length) {
    const rawEnv = process.env.JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (rawEnv) {
      const serviceAccount = typeof rawEnv === "string" ? JSON.parse(rawEnv) : rawEnv;

      // Normalizar saltos de línea en clave privada si vinieron escapados
      if (serviceAccount?.private_key && typeof serviceAccount.private_key === "string" && serviceAccount.private_key.includes("\\n")) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[FIREBASE ADMIN] Inicializado exitosamente con cuenta de servicio para el proyecto:", serviceAccount.project_id);
    }
  }

  if (admin.apps.length) {
    db = admin.firestore();
  }
} catch (error) {
  console.error(
    "[FIREBASE ADMIN] Error al parsear JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE o inicializar Firebase Admin:",
    error
  );
}

import {
  UMBRAL_ENVIO_GRATIS,
  MINIMO_LADRILLOS_ENVIO_GRATIS,
  COSTO_ENVIO,
  ZONAS_ELDORADO_VALIDAS,
  esLadrillo,
  contarLadrillos,
  requiereMinimoLadrillosEnvioGratis,
  calcularCostoEnvio
} from "../../reglas-envio.js";

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, code: "METHOD_NOT_ALLOWED", error: "Método no permitido." });
  }

  // Garantizar inicialización de DB si aún no está lista
  if (!db) {
    try {
      if (!admin.apps.length) {
        const rawEnv = process.env.JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!rawEnv) {
          throw new Error("Variable de entorno JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE ausente en Netlify.");
        }
        const serviceAccount = typeof rawEnv === "string" ? JSON.parse(rawEnv) : rawEnv;
        if (serviceAccount?.private_key && typeof serviceAccount.private_key === "string" && serviceAccount.private_key.includes("\\n")) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        }
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      db = admin.firestore();
    } catch (errInit) {
      console.error("[FIREBASE ADMIN] Falló la conexión con la cuenta de servicio:", errInit);
      return jsonResponse(500, {
        success: false,
        code: "FIREBASE_INIT_ERROR",
        error: "Error interno: No se pudo conectar a la base de datos de Firebase. Verifique la variable JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE."
      });
    }
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: "Cuerpo de la petición inválido." });
  }

  const {
    items: itemsSolicitados,
    tipoDestino = "eldorado",
    zonaEldorado = "km1_6",
    departamento = "Eldorado",
    localidad = "Eldorado",
    zonaEnvio = "Km 1 a 6",
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    referencia = "",
    totalReportadoPorCliente = null
  } = data || {};

  // 1. Validaciones básicas de payload
  if (!itemsSolicitados || !Array.isArray(itemsSolicitados) || itemsSolicitados.length === 0) {
    return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: "El pedido debe contener al menos un producto." });
  }
  if (itemsSolicitados.length > 100) {
    return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: "El pedido no puede superar 100 productos diferentes." });
  }

  const telLimpio = String(clienteTelefono || "").replace(/\D/g, "");
  if (!telLimpio || telLimpio.length < 6 || telLimpio.length > 20) {
    return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: "Por favor ingresá un número de teléfono de contacto válido." });
  }

  const direccionLimpia = String(clienteDireccion || "").trim();
  if (!direccionLimpia || direccionLimpia.length < 3 || direccionLimpia.length > 300) {
    return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: "Por favor ingresá una dirección de entrega válida." });
  }

  const nombreLimpio = String(clienteNombre || "").trim().slice(0, 100);

  // 2. Consultar catálogo oficial en /productos para cada ítem solicitado
  const itemsCongelados = [];
  let subtotalOficial = 0;

  try {
    for (const item of itemsSolicitados) {
      const id = String(item.id || "").trim();
      const cantidad = Number(item.cantidad);

      if (!id || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
        return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: `Identificador de producto inválido: "${id}".` });
      }
      if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 50000) {
        return jsonResponse(400, { success: false, code: "INVALID_ARGUMENT", error: `Cantidad no válida para el producto ${id}.` });
      }

      const prodDoc = await db.collection("productos").doc(id).get();
      if (!prodDoc.exists) {
        return jsonResponse(404, { success: false, code: "NOT_FOUND", error: `El producto con ID "${id}" no existe en el catálogo.` });
      }

      const prodData = prodDoc.data() || {};
      const precioOficial = Number(prodData.precio || 0);
      if (isNaN(precioOficial) || precioOficial < 0) {
        return jsonResponse(500, { success: false, code: "INTERNAL", error: `El precio oficial del producto ${prodData.nombre || id} es inválido.` });
      }

      const itemSubtotal = precioOficial * cantidad;
      subtotalOficial += itemSubtotal;

      itemsCongelados.push({
        id,
        nombre: String(prodData.nombre || "Material"),
        precio: precioOficial,
        cantidad,
        subtotal: itemSubtotal,
        categoria: String(prodData.categoria || "otros"),
        imagen: String(prodData.imagen || ""),
        descripcion: String(prodData.descripcion || "").slice(0, 500),
        ladrilloEquivalente: Number(prodData.ladrilloEquivalente || 0)
      });
    }
  } catch (err) {
    console.error("Error consultando catálogo:", err);
    return jsonResponse(500, { success: false, code: "INTERNAL", error: "Error interno al validar el catálogo contra Firestore." });
  }

  // 3. Calcular costo de flete oficial según reglas vigentes centralizadas en reglas-envio.js
  const zonaValidada = ZONAS_ELDORADO_VALIDAS.includes(zonaEldorado) ? zonaEldorado : "km1_6";
  const costoEnvioOficial = calcularCostoEnvio({
    items: itemsCongelados,
    subtotal: subtotalOficial,
    tipoDestino,
    zonaEldorado: zonaValidada
  });

  const totalCalculadoOficial = subtotalOficial + costoEnvioOficial;

  // 4. Auditoría de discrepancias (precios en cliente vs. catálogo oficial)
  const reportado = totalReportadoPorCliente !== null && totalReportadoPorCliente !== undefined
    ? Number(totalReportadoPorCliente)
    : totalCalculadoOficial;
  const diferencia = Math.abs(reportado - totalCalculadoOficial);
  const revisionRequerida = diferencia > 1;
  const motivoRevision = revisionRequerida
    ? `Discrepancia detectada: el cliente reportó $${reportado.toLocaleString("es-AR")} y el catálogo oficial sumó $${totalCalculadoOficial.toLocaleString("es-AR")} (Diferencia: $${diferencia.toLocaleString("es-AR")}).`
    : "";

  // 5. Transacción atómica: rate limiting por teléfono (3 cada 10 min) + contador correlativo + creación de pedido
  const rateLimitRef = db.collection("rate_limits").doc(telLimpio);
  const contadorRef = db.collection("contadores").doc("pedidos");
  const nuevoPedidoRef = db.collection("pedidos").doc();

  let numeroPedidoFinal = 1;
  let codigoPedidoFinal = "PEDIDO #0001";

  try {
    await db.runTransaction(async (transaction) => {
      const rateLimitSnap = await transaction.get(rateLimitRef);
      const contadorSnap = await transaction.get(contadorRef);

      const ahoraMs = Date.now();
      const DIEZ_MINUTOS_MS = 10 * 60 * 1000;
      let nuevoCount = 1;
      let primerEnvioMs = ahoraMs;

      if (rateLimitSnap.exists) {
        const rlData = rateLimitSnap.data() || {};
        primerEnvioMs = Number(rlData.primerEnvio || ahoraMs);
        const cantidad = Number(rlData.cantidad || 0);

        if (ahoraMs - primerEnvioMs < DIEZ_MINUTOS_MS) {
          if (cantidad >= 3) {
            const err = new Error("RATE_LIMIT");
            err.code = "RATE_LIMIT";
            throw err;
          }
          nuevoCount = cantidad + 1;
        } else {
          primerEnvioMs = ahoraMs;
          nuevoCount = 1;
        }
      }

      let ultimoNumero = 0;
      if (contadorSnap.exists) {
        ultimoNumero = Number(contadorSnap.data()?.ultimoNumero || 0);
      }
      numeroPedidoFinal = ultimoNumero + 1;
      codigoPedidoFinal = `PEDIDO #${String(numeroPedidoFinal).padStart(4, "0")}`;

      transaction.set(
        rateLimitRef,
        {
          primerEnvio: primerEnvioMs,
          ultimoEnvio: FieldValue.serverTimestamp(),
          cantidad: nuevoCount
        },
        { merge: true }
      );

      transaction.set(
        contadorRef,
        {
          ultimoNumero: numeroPedidoFinal,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      const refLimpia = String(referencia || "").trim().slice(0, 300);
      const locLimpia = String(localidad || "Eldorado").slice(0, 100);
      const deptoLimpio = String(departamento || (esOtro ? "Misiones" : "Eldorado")).slice(0, 100);

      const direccionCompleta = refLimpia
        ? `${direccionLimpia}, ${locLimpia} (${deptoLimpio}) — Ref: ${refLimpia}`
        : `${direccionLimpia}, ${locLimpia} (${deptoLimpio})`;

      const pedidoDocData = {
        numeroPedido: numeroPedidoFinal,
        codigoPedido: codigoPedidoFinal,
        clienteNombre: nombreLimpio,
        clienteTelefono: telLimpio,
        clienteDireccion: direccionCompleta.slice(0, 300),
        tipoDestino: String(tipoDestino).slice(0, 50),
        departamento: deptoLimpio,
        localidad: locLimpia,
        direccion: direccionLimpia.slice(0, 200),
        referencia: refLimpia,
        zonaEnvio: String(zonaEnvio || `${deptoLimpio} — ${locLimpia}`).slice(0, 100),
        items: itemsCongelados,
        subtotal: subtotalOficial,
        costoEnvio: costoEnvioOficial,
        total: totalCalculadoOficial,
        totalCalculadoOficial,
        totalReportadoPorCliente: reportado,
        revisionRequerida,
        motivoRevision,
        estado: "pendiente",
        createdAt: FieldValue.serverTimestamp()
      };

      if (esOtro) pedidoDocData.envioACoordinar = true;

      transaction.set(nuevoPedidoRef, pedidoDocData);
    });
  } catch (err) {
    if (err?.code === "RATE_LIMIT") {
      return jsonResponse(429, {
        success: false,
        code: "RATE_LIMIT",
        error: "Ya registramos pedidos recientes con este número. Por favor, esperá unos minutos o contactanos por WhatsApp para coordinar."
      });
    }
    console.error("Error en transacción de pedido:", err);
    return jsonResponse(500, { success: false, code: "INTERNAL", error: "No se pudo registrar el pedido. Intentá nuevamente en unos minutos." });
  }

  return jsonResponse(200, {
    success: true,
    pedidoId: nuevoPedidoRef.id,
    codigoPedido: codigoPedidoFinal,
    numeroPedido: numeroPedidoFinal,
    total: totalCalculadoOficial,
    subtotal: subtotalOficial,
    costoEnvio: costoEnvioOficial,
    revisionRequerida
  });
};

export const config = { method: "POST" };
