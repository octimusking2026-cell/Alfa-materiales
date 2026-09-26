/**
 * Alfa Materiales Eldorado — Cloud Functions
 * Función callable 'crearPedido' para validación server-side de precios y protección anti-fraude.
 * Única puerta de entrada para registrar pedidos sin permitir escrituras directas desde el cliente.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

// Parámetros oficiales de negocio
const UMBRAL_ENVIO_GRATIS = 300000;
const COSTO_FLETE_KM1_6 = 20000;
const COSTO_FLETE_KM7_12 = 20000;
const MINIMO_LADRILLOS_ENVIO_GRATIS = 150;

function normalizarTexto(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function esCementoOPlasticor(item) {
  const nombreNorm = normalizarTexto(item?.nombre);
  return nombreNorm.includes("cemento") || nombreNorm.includes("plasticor");
}

function esProductoCategoriaOtrosOCemento(item) {
  const cat = (item?.categoria || "").toLowerCase().trim();
  const nombreNorm = normalizarTexto(item?.nombre);
  if (cat === "otros") return true;
  if (esCementoOPlasticor(item)) return true;
  if (
    nombreNorm.includes("alambre") ||
    nombreNorm.includes("alambron") ||
    nombreNorm.includes("hierro") ||
    nombreNorm.includes("varilla") ||
    nombreNorm.includes("barra")
  ) {
    return true;
  }
  return false;
}

function esLadrillo(item) {
  const cat = (item?.categoria || "").toLowerCase().trim();
  const nombreNorm = normalizarTexto(item?.nombre);
  return cat === "ladrillos" || nombreNorm.includes("ladrillo") || nombreNorm.includes("peine");
}

function contarLadrillos(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((acc, item) => {
    return esLadrillo(item) ? acc + Number(item.cantidad || 0) : acc;
  }, 0);
}

function tieneProductosConRestriccionLadrillos(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  return items.some(item => esProductoCategoriaOtrosOCemento(item));
}

function requiereMinimoLadrillosEnvioGratis(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  const tieneRestringidos = tieneProductosConRestriccionLadrillos(items);
  const totalLadrillos = contarLadrillos(items);
  return tieneRestringidos && totalLadrillos < MINIMO_LADRILLOS_ENVIO_GRATIS;
}

/**
 * Cloud Function Callable: crearPedido
 * Recibe sólo identificadores de productos y cantidades (no precios de usuario),
 * valida contra el catálogo oficial en /productos, calcula el total real, aplica rate-limiting
 * atómico transaccional y registra el pedido en Firestore con su número correlativo.
 * Exige Firebase App Check para impedir invocaciones externas directas con curl o scripts.
 */
export const crearPedido = onCall({
  cors: true,
  maxInstances: 10,
  enforceAppCheck: true
}, async (request) => {
  const data = request.data || {};
  const {
    items: itemsSolicitados,
    tipoDestino = "eldorado",
    departamento = "Eldorado",
    localidad = "Eldorado",
    zonaEnvio = "Km 1 a 6",
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    referencia = "",
    totalReportadoPorCliente = null
  } = data;

  // 1. Validaciones básicas de payload
  if (!itemsSolicitados || !Array.isArray(itemsSolicitados) || itemsSolicitados.length === 0) {
    throw new HttpsError("invalid-argument", "El pedido debe contener al menos un producto.");
  }

  if (itemsSolicitados.length > 100) {
    throw new HttpsError("invalid-argument", "El pedido no puede superar 100 productos diferentes.");
  }

  const telLimpio = String(clienteTelefono || "").replace(/\D/g, "");
  if (!telLimpio || telLimpio.length < 6 || telLimpio.length > 20) {
    throw new HttpsError("invalid-argument", "Por favor ingresá un número de teléfono de contacto válido.");
  }

  const direccionLimpia = String(clienteDireccion || "").trim();
  if (!direccionLimpia || direccionLimpia.length < 3 || direccionLimpia.length > 300) {
    throw new HttpsError("invalid-argument", "Por favor ingresá una dirección de entrega válida.");
  }

  const nombreLimpio = String(clienteNombre || "").trim().slice(0, 100);

  // 2. Consultar catálogo oficial en /productos para cada ítem solicitado
  const itemsCongelados = [];
  let subtotalOficial = 0;

  for (const item of itemsSolicitados) {
    const id = String(item.id || "").trim();
    const cantidad = Number(item.cantidad);

    if (!id || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      throw new HttpsError("invalid-argument", `Identificador de producto inválido: "${id}".`);
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 50000) {
      throw new HttpsError("invalid-argument", `Cantidad no válida para el producto ${id}: ${cantidad}.`);
    }

    const prodDoc = await db.collection("productos").doc(id).get();
    if (!prodDoc.exists) {
      throw new HttpsError("not-found", `El producto con ID "${id}" no existe en el catálogo.`);
    }

    const prodData = prodDoc.data() || {};
    const precioOficial = Number(prodData.precio || 0);
    if (isNaN(precioOficial) || precioOficial < 0) {
      throw new HttpsError("internal", `El precio oficial del producto ${prodData.nombre || id} es inválido.`);
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
      imagen: String(prodData.imagen || "")
    });
  }

  // 3. Calcular costo de flete oficial según reglas de negocio
  let costoEnvioOficial = 0;
  const esOtro = tipoDestino === "otro";

  if (!esOtro) {
    const restriccionLadrillosActiva = requiereMinimoLadrillosEnvioGratis(itemsCongelados);
    const esKm7a12 = String(zonaEnvio || "").includes("7") || String(zonaEnvio || "").includes("km7_12");
    const fleteBase = esKm7a12 ? COSTO_FLETE_KM7_12 : COSTO_FLETE_KM1_6;

    // Si tiene Cemento, Plasticor o cualquier artículo de 'Otros' y menos de 150 ladrillos:
    // NO IMPORTA EL MONTO DEL PEDIDO, el flete se cobra siempre.
    if (restriccionLadrillosActiva) {
      costoEnvioOficial = fleteBase;
    } else if (subtotalOficial >= UMBRAL_ENVIO_GRATIS) {
      costoEnvioOficial = 0;
    } else {
      costoEnvioOficial = fleteBase;
    }
  } else {
    // Fuera de Eldorado: Flete a coordinar con la empresa
    costoEnvioOficial = 0;
  }

  const totalCalculadoOficial = subtotalOficial + costoEnvioOficial;

  // 4. Comparar totalReportadoPorCliente con totalCalculadoOficial (auditoría de discrepancias)
  const reportado = totalReportadoPorCliente !== null && totalReportadoPorCliente !== undefined
    ? Number(totalReportadoPorCliente)
    : totalCalculadoOficial;

  const diferencia = Math.abs(reportado - totalCalculadoOficial);
  const revisionRequerida = diferencia > 1; // Tolerancia a pequeñas discrepancias de redondeo
  const motivoRevision = revisionRequerida
    ? `Discrepancia detectada: el cliente reportó $${reportado.toLocaleString("es-AR")} y el catálogo oficial sumó $${totalCalculadoOficial.toLocaleString("es-AR")} (Diferencia: $${diferencia.toLocaleString("es-AR")}).`
    : "";

  // 5. Transacción atómica única: Rate limiting por teléfono + Contador correlativo + Creación de pedido
  // Todas las lecturas transaccionales se ejecutan antes de cualquier escritura para evitar condiciones de carrera (TOCTOU)
  const rateLimitRef = db.collection("rate_limits").doc(telLimpio);
  const contadorRef = db.collection("contadores").doc("pedidos");
  const nuevoPedidoRef = db.collection("pedidos").doc();

  let numeroPedidoFinal = 1;
  let codigoPedidoFinal = "PEDIDO #0001";

  await db.runTransaction(async (transaction) => {
    // === LECTURAS TRANSACCIONALES (primer paso) ===
    const rateLimitSnap = await transaction.get(rateLimitRef);
    const contadorSnap = await transaction.get(contadorRef);

    // === EVALUACIÓN DE RATE LIMITING POR TELÉFONO ===
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
          throw new HttpsError(
            "resource-exhausted",
            "Ya registramos pedidos recientes con este número. Por favor, esperá unos minutos o contactanos por WhatsApp para coordinar."
          );
        }
        nuevoCount = cantidad + 1;
      } else {
        // Ventana de 10 min expirada: reiniciar contador
        primerEnvioMs = ahoraMs;
        nuevoCount = 1;
      }
    }

    // === EVALUACIÓN DEL CONTADOR DE PEDIDOS ===
    let ultimoNumero = 0;
    if (contadorSnap.exists) {
      ultimoNumero = Number(contadorSnap.data()?.ultimoNumero || 0);
    }

    numeroPedidoFinal = ultimoNumero + 1;
    codigoPedidoFinal = `PEDIDO #${String(numeroPedidoFinal).padStart(4, "0")}`;

    // === ESCRITURAS TRANSACCIONALES (segundo paso) ===
    // 1. Registrar conteo de frecuencia de forma serializada y atómica
    transaction.set(rateLimitRef, {
      primerEnvio: primerEnvioMs,
      ultimoEnvio: FieldValue.serverTimestamp(),
      cantidad: nuevoCount
    }, { merge: true });

    // 2. Incrementar contador oficial correlativo
    transaction.set(contadorRef, {
      ultimoNumero: numeroPedidoFinal,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // 3. Crear el documento del pedido con valores congelados y auditados
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
      totalCalculadoOficial: totalCalculadoOficial,
      totalReportadoPorCliente: reportado,
      revisionRequerida,
      motivoRevision,
      estado: "pendiente",
      createdAt: FieldValue.serverTimestamp()
    };

    if (esOtro) {
      pedidoDocData.envioACoordinar = true;
    }

    transaction.set(nuevoPedidoRef, pedidoDocData);
  });

  return {
    success: true,
    pedidoId: nuevoPedidoRef.id,
    codigoPedido: codigoPedidoFinal,
    numeroPedido: numeroPedidoFinal,
    total: totalCalculadoOficial,
    subtotal: subtotalOficial,
    costoEnvio: costoEnvioOficial,
    revisionRequerida
  };
});
