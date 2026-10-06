// netlify/functions/crear-pedido.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PRODUCTOS_INICIALES_LOCAL = [
  { id: "1", nombre: "Ladrillo hueco 8×18×25 Liviano (1ª)", precio: 330, imagen: "fotos/8x18x25 L.jpg", categoria: "ladrillos" },
  { id: "2", nombre: "Ladrillo hueco 12×18×25 Livaino (1ª)", precio: 370, imagen: "fotos/12x18x25 L.jpg", categoria: "ladrillos" },
  { id: "3", nombre: "Ladrillo hueco 12×18×25 Liviano (2ª)", precio: 330, imagen: "fotos/12x18x25 L.jpg", categoria: "ladrillos" },
  { id: "4", nombre: "Ladrillo hueco 12×18×25 Visto (1ª)", precio: 495, imagen: "fotos/12x18x25 visto.jpg", categoria: "ladrillos" },
  { id: "5", nombre: "Ladrillo hueco 12×18×25 Visto (2ª)", precio: 395, imagen: "fotos/12x18x25 visto.jpg", categoria: "ladrillos" },
  { id: "6", nombre: "Ladrillo hueco 18×18×25 Liviano (1ª)", precio: 545, imagen: "fotos/18x18x25 nuevo.jpg", categoria: "ladrillos" },
  { id: "7", nombre: "Ladrillo hueco 18×18×25 Liviano (2ª)", precio: 440, imagen: "fotos/18x18x25 nuevo.jpg", categoria: "ladrillos" },
  { id: "8", nombre: "Medio ladrillo hueco 12×18 Liviano", precio: 250, imagen: "fotos/medio 12x18 L.jpg", categoria: "ladrillos" },
  { id: "9", nombre: "Medio ladrillo hueco 12×18 Visto", precio: 280, imagen: "fotos/medio 12x18 V.jpg", categoria: "ladrillos" },
  { id: "10", nombre: "Medio Ladrillo hueco 18×18 Liviano", precio: 320, imagen: "fotos/medio 18x18.jpg", categoria: "ladrillos" },
  { id: "11", nombre: "Peine encadenado", precio: 500, imagen: "fotos/peinde para encadenado.jpg", categoria: "ladrillos" },
  { id: "12", nombre: "Ladrillo macizo (1ª)", precio: 400, imagen: "fotos/macizo 1ra.jpg", categoria: "ladrillos" },
  { id: "13", nombre: "Ladrillo macizo (2ª)", precio: 230, imagen: "fotos/macizo comun.jpg", categoria: "ladrillos" },
  { id: "14", nombre: "Cemento holcim 25kg", precio: 8000, imagen: "fotos/cemento holcim.jpg", categoria: "aridos" },
  { id: "15", nombre: "Plasticor 25kg", precio: 8000, imagen: "fotos/plasticor.jpg", categoria: "aridos" },
  { id: "16", nombre: "Arena fina (m³)", precio: 55000, imagen: "fotos/bolson de arena.jpg", categoria: "aridos" },
  { id: "17", nombre: "Ripio (m³)", precio: 55000, imagen: "fotos/bolson de ripio1.jpg", categoria: "aridos" },
  { id: "18", nombre: "Alambron kg", precio: 4600, imagen: "fotos/alambron.png", categoria: "otros" },
  { id: "19", nombre: "Alambre dulce kg", precio: 4600, imagen: "fotos/alambre dulce.webp", categoria: "otros" },
  { id: "20", nombre: "Alambre galvanizado 14", precio: 5500, imagen: "fotos/alambre galvanizado 14.jpg", categoria: "otros" },
  { id: "21", nombre: "Barra de hierro 4,2", precio: 4000, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: "22", nombre: "Barra de hierro 6", precio: 7125, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: "23", nombre: "Barra de hierro 8", precio: 12375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: "24", nombre: "Barra de hierro 10", precio: 19500, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: "25", nombre: "Barra de hierro 12", precio: 27750, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: "26", nombre: "Barra de hierro 16", precio: 47500, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: "27", nombre: "Barra de hierro 20", precio: 75375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" }
];

const MAPA_PRODUCTOS_LOCAL = {};
PRODUCTOS_INICIALES_LOCAL.forEach((item, index) => {
  MAPA_PRODUCTOS_LOCAL[String(item.id)] = item;
  const num = String(index + 1).padStart(2, "0");
  const slug = item.nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 45);
  const baseId = `base_${num}_${slug}`;
  MAPA_PRODUCTOS_LOCAL[baseId] = item;
});

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
let db = null;
try {
  if (!admin.apps.length) {
    const rawEnv = process.env.JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (rawEnv) {
      const serviceAccount = typeof rawEnv === "string" ? JSON.parse(rawEnv) : rawEnv;

      if (serviceAccount?.private_key && typeof serviceAccount.private_key === "string" && serviceAccount.private_key.includes("\\n")) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[FIREBASE ADMIN] Inicializado exitosamente con cuenta de servicio para el proyecto:", serviceAccount.project_id);
    } else {
      console.warn("[FIREBASE ADMIN] Variable JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE no detectada. Operando en modo de respaldo local para pedidos.");
    }
  }

  if (admin.apps.length) {
    db = admin.firestore();
  }
} catch (error) {
  console.warn(
    "[FIREBASE ADMIN] Advertencia al inicializar Firebase Admin (operando en modo respaldo local):",
    error?.message || error
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

  if (!db) {
    try {
      if (!admin.apps.length) {
        const rawEnv = process.env.JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (rawEnv) {
          const serviceAccount = typeof rawEnv === "string" ? JSON.parse(rawEnv) : rawEnv;
          if (serviceAccount?.private_key && typeof serviceAccount.private_key === "string" && serviceAccount.private_key.includes("\\n")) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
          }
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          db = admin.firestore();
        }
      } else {
        db = admin.firestore();
      }
    } catch (errInit) {
      console.warn("[FIREBASE ADMIN] No se pudo conectar a Firestore, usando respaldo local:", errInit?.message);
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
  const esOtro = tipoDestino === "otro";

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

      let prodData = null;
      if (db) {
        try {
          const prodDoc = await db.collection("productos").doc(id).get();
          if (prodDoc.exists) {
            prodData = prodDoc.data();
          }
        } catch (dbErr) {
          console.warn(`Error leyendo producto ${id} desde Firestore, usando respaldo local:`, dbErr?.message);
        }
      }

      if (!prodData) {
        prodData = MAPA_PRODUCTOS_LOCAL[id];
      }

      if (!prodData) {
        prodData = {
          nombre: item.nombre || `Producto ${id}`,
          precio: Number(item.precio || 0),
          categoria: item.categoria || "otros",
          imagen: item.imagen || "",
          descripcion: item.descripcion || "",
          ladrilloEquivalente: Number(item.ladrilloEquivalente || 0)
        };
      }

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
    return jsonResponse(500, { success: false, code: "INTERNAL", error: "Error interno al validar el catálogo." });
  }

  const zonaValidada = ZONAS_ELDORADO_VALIDAS.includes(zonaEldorado) ? zonaEldorado : "km1_6";
  const costoEnvioOficial = calcularCostoEnvio({
    items: itemsCongelados,
    subtotal: subtotalOficial,
    tipoDestino,
    zonaEldorado: zonaValidada
  });

  const totalCalculadoOficial = subtotalOficial + costoEnvioOficial;

  const reportado = totalReportadoPorCliente !== null && totalReportadoPorCliente !== undefined
    ? Number(totalReportadoPorCliente)
    : totalCalculadoOficial;
  const diferencia = Math.abs(reportado - totalCalculadoOficial);
  const revisionRequerida = diferencia > 1;
  const motivoRevision = revisionRequerida
    ? `Discrepancia detectada: el cliente reportó $${reportado.toLocaleString("es-AR")} y el catálogo oficial sumó $${totalCalculadoOficial.toLocaleString("es-AR")} (Diferencia: $${diferencia.toLocaleString("es-AR")}).`
    : "";

  let numeroPedidoFinal = Math.floor(1000 + Math.random() * 9000);
  let codigoPedidoFinal = `PEDIDO #${String(numeroPedidoFinal).padStart(4, "0")}`;
  const pedidoIdRes = "pedido_" + Date.now();

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
    estado: "pendiente"
  };
  if (esOtro) pedidoDocData.envioACoordinar = true;

  if (db) {
    const rateLimitRef = db.collection("rate_limits").doc(telLimpio);
    const contadorRef = db.collection("contadores").doc("pedidos");
    const nuevoPedidoRef = db.collection("pedidos").doc(pedidoIdRes);

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
        pedidoDocData.numeroPedido = numeroPedidoFinal;
        pedidoDocData.codigoPedido = codigoPedidoFinal;

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

        pedidoDocData.createdAt = FieldValue.serverTimestamp();
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
      console.warn("Aviso en transacción de Firestore, enviando datos para persistencia cliente:", err?.message);
    }
  }

  return jsonResponse(200, {
    success: true,
    pedidoId: pedidoIdRes,
    codigoPedido: codigoPedidoFinal,
    numeroPedido: numeroPedidoFinal,
    total: totalCalculadoOficial,
    subtotal: subtotalOficial,
    costoEnvio: costoEnvioOficial,
    revisionRequerida,
    pedidoDocData: db ? null : pedidoDocData
  });
};

export const config = { method: "POST" };
