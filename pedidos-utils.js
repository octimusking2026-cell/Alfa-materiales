/* ==========================================================================
   Alfa Materiales Eldorado — pedidos-utils.js
   Lógica centralizada de cálculo de envíos, estados y formato de pedidos.
   Evita discrepancias entre el carrito público, Firestore y el panel admin.
   ========================================================================== */

import {
  UMBRAL_ENVIO_GRATIS,
  UMBRAL_AVISO_CERCA,
  COSTO_ENVIO,
  COSTO_FLETE_KM1_6,
  COSTO_FLETE_KM7_12,
  MINIMO_LADRILLOS_ENVIO_GRATIS,
  ZONAS_ELDORADO_VALIDAS,
  COSTOS_FLETE_ELDORADO,
  esLadrillo,
  contarLadrillos,
  contarLadrillosCarrito,
  tieneProductosConRestriccionLadrillos,
  requiereMinimoLadrillosEnvioGratis,
  contieneSoloOtrosOCementoSinMinimoLadrillos,
  calcularCostoEnvio
} from './reglas-envio.js';

// Re-exportar todas las reglas y constantes para compatibilidad
export {
  UMBRAL_ENVIO_GRATIS,
  UMBRAL_AVISO_CERCA,
  COSTO_ENVIO,
  COSTO_FLETE_KM1_6,
  COSTO_FLETE_KM7_12,
  MINIMO_LADRILLOS_ENVIO_GRATIS,
  ZONAS_ELDORADO_VALIDAS,
  COSTOS_FLETE_ELDORADO,
  esLadrillo,
  contarLadrillos,
  contarLadrillosCarrito,
  tieneProductosConRestriccionLadrillos,
  requiereMinimoLadrillosEnvioGratis,
  contieneSoloOtrosOCementoSinMinimoLadrillos,
  calcularCostoEnvio
};

// Estados del pedido con labels amigables y estilos visuales (3 principales: Pendiente, Entregado, Cancelado)
export const ESTADOS_PEDIDO = {
  pendiente: { label: "Pendiente", clase: "estado-pendiente", icono: "bi-clock-history", bg: "#fef3c7", color: "#92400e" },
  entregado: { label: "Entregado", clase: "estado-entregado", icono: "bi-patch-check-fill", bg: "#dcfce7", color: "#15803d" },
  cancelado: { label: "Cancelado", clase: "estado-cancelado", icono: "bi-x-circle-fill", bg: "#fee2e2", color: "#b91c1c" },
  // Compatibilidad con registros antiguos
  confirmado: { label: "Confirmado", clase: "estado-confirmado", icono: "bi-check-circle", bg: "#e0f2fe", color: "#0369a1" },
  preparando: { label: "Preparando", clase: "estado-preparando", icono: "bi-box-seam", bg: "#ffedd5", color: "#c2410c" },
  enviado: { label: "Enviado", clase: "estado-enviado", icono: "bi-truck", bg: "#f3e8ff", color: "#6b21a8" }
};

/**
 * Formatea un número como moneda argentina ARS
 */
export function formatearPrecio(num) {
  return Number(num || 0).toLocaleString("es-AR", { 
    style: "currency", 
    currency: "ARS", 
    minimumFractionDigits: 0 
  });
}

/**
 * Formatea un número correlativo como código de pedido (ej: PEDIDO #0001)
 */
export function formatearCodigoPedido(num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n <= 0) return "PEDIDO #0001";
  return `PEDIDO #${String(n).padStart(4, "0")}`;
}

/**
 * Optimiza URLs de imágenes de Cloudinary insertando transformaciones automáticas (f_auto,q_auto,w_600)
 */
export function optimizarImagenUrl(url) {
  if (!url || typeof url !== "string") return url || "fotos/favicon-32.png";
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (url.includes("/upload/f_auto,q_auto,w_600/")) return url;
    return url.replace("/upload/", "/upload/f_auto,q_auto,w_600/");
  }
  return url;
}

/**
 * Normaliza cadenas de texto eliminando tildes y diacríticos
 */
function normalizarTexto(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}


/* ==========================================================================
   CONFIGURACIÓN AVANZADA DE ENVÍOS Y FLETES (ELDORADO Y OTROS PUNTOS DE MISIONES)
   ========================================================================== */

export const configEnvios = {
  // Zonas de la ciudad de Eldorado (dividido en Km 1 a 6 y Km 7 a 12)
  zonasEldorado: {
    km1_6: {
      id: "km1_6",
      nombre: "Km 1 a 6",
      costoFlete: 20000,
      pedidoMinimo: 0,
      minLadrillos: 0
    },
    km7_12: {
      id: "km7_12",
      nombre: "Km 7 a 12",
      costoFlete: 20000,
      pedidoMinimo: 0,
      minLadrillos: 0
    },
    // Compatibilidad retroactiva
    centro_km8_10: {
      id: "km7_12",
      nombre: "Km 7 a 12",
      costoFlete: 20000,
      pedidoMinimo: 0,
      minLadrillos: 0
    },
    km1_7: {
      id: "km1_6",
      nombre: "Km 1 a 6",
      costoFlete: 20000,
      pedidoMinimo: 0,
      minLadrillos: 0
    },
    km11_mas: {
      id: "km7_12",
      nombre: "Km 7 a 12",
      costoFlete: 20000,
      pedidoMinimo: 0,
      minLadrillos: 0
    }
  },

  // Departamentos oficiales de Misiones para envíos fuera de la ciudad
  departamentos: {
    "Apóstoles": {
      id: "apostoles",
      nombre: "Apóstoles",
      costoFleteReferencia: 160000,
      localidades: ["Apóstoles", "San José", "Azara", "Tres Capones"]
    },
    "Cainguás": {
      id: "cainguas",
      nombre: "Cainguás",
      costoFleteReferencia: 120000,
      localidades: ["Aristóbulo del Valle", "Campo Grande", "Dos de Mayo"]
    },
    "Candelaria": {
      id: "candelaria",
      nombre: "Candelaria",
      costoFleteReferencia: 150000,
      localidades: ["Candelaria", "Santa Ana", "Bonpland", "Loreto", "Profundidad"]
    },
    "Capital": {
      id: "capital",
      nombre: "Capital",
      costoFleteReferencia: 180000,
      localidades: ["Posadas", "Garupá", "Fachinal"]
    },
    "Concepción": {
      id: "concepcion",
      nombre: "Concepción",
      costoFleteReferencia: 170000,
      localidades: ["Concepción de la Sierra", "Santa María"]
    },
    "Eldorado": {
      id: "eldorado",
      nombre: "Eldorado",
      costoFleteReferencia: 45000,
      localidades: [
        "Colonia Victoria",
        "Puerto Piray",
        "9 de Julio",
        "Santiago de Liniers",
        "Colonia Delicia"
      ]
    },
    "General Manuel Belgrano": {
      id: "general_manuel_belgrano",
      nombre: "General Manuel Belgrano",
      costoFleteReferencia: 130000,
      localidades: ["Bernardo de Irigoyen", "Comandante Andresito", "San Antonio"]
    },
    "Guaraní": {
      id: "guarani",
      nombre: "Guaraní",
      costoFleteReferencia: 140000,
      localidades: ["El Soberbio", "San Vicente"]
    },
    "Iguazú": {
      id: "iguazu",
      nombre: "Iguazú",
      costoFleteReferencia: 110000,
      localidades: ["Puerto Iguazú", "Wanda", "Puerto Esperanza", "Puerto Libertad"]
    },
    "Leandro N. Alem": {
      id: "leandro_n_alem",
      nombre: "Leandro N. Alem",
      costoFleteReferencia: 150000,
      localidades: ["Leandro N. Alem", "Cerro Azul", "Gobernador López", "Dos Arroyos", "Almafuerte"]
    },
    "Libertador General San Martín": {
      id: "libertador_general_san_martin",
      nombre: "Libertador General San Martín",
      costoFleteReferencia: 85000,
      localidades: ["Puerto Rico", "Capioví", "Garuhapé", "Ruiz de Montoya", "El Alcázar"]
    },
    "Montecarlo": {
      id: "montecarlo",
      nombre: "Montecarlo",
      costoFleteReferencia: 65000,
      localidades: ["Montecarlo", "Caraguatay", "Puerto Piray", "Tarumá"]
    },
    "Oberá": {
      id: "obera",
      nombre: "Oberá",
      costoFleteReferencia: 160000,
      localidades: ["Oberá", "Campo Viera", "Campo Ramón", "Panambí", "Los Helechos", "Guaraní"]
    },
    "San Ignacio": {
      id: "san_ignacio",
      nombre: "San Ignacio",
      costoFleteReferencia: 130000,
      localidades: ["San Ignacio", "Jardín América", "Gobernador Roca", "Hipólito Yrigoyen", "Corpus"]
    },
    "San Javier": {
      id: "san_javier",
      nombre: "San Javier",
      costoFleteReferencia: 170000,
      localidades: ["San Javier", "Itacaruaré", "Florentino Ameghino", "Mojón Grande"]
    },
    "San Pedro": {
      id: "san_pedro",
      nombre: "San Pedro",
      costoFleteReferencia: 120000,
      localidades: ["San Pedro", "Pozo Azul", "Crucero del Norte"]
    },
    "Veinticinco de Mayo (25 de Mayo)": {
      id: "veinticinco_de_mayo",
      nombre: "Veinticinco de Mayo (25 de Mayo)",
      costoFleteReferencia: 150000,
      localidades: ["25 de Mayo", "Alba Posse", "Colonia Aurora"]
    }
  }
};

/**
 * Busca la configuración de un departamento por su nombre exacto o por su id
 */
export function obtenerInfoDepartamento(claveONombre) {
  if (!claveONombre) return null;
  if (configEnvios.departamentos[claveONombre]) {
    return configEnvios.departamentos[claveONombre];
  }
  const busqueda = claveONombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const [key, info] of Object.entries(configEnvios.departamentos)) {
    const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (keyNorm === busqueda || info.id === claveONombre) {
      return info;
    }
  }
  return null;
}

/**
 * Valida reglas de flete y calcula costo total de envío en tiempo real
 * @param {Object} params
 * @param {Array} params.carrito - Array de productos del carrito
 * @param {string} params.tipoDestino - "eldorado" o "otro"
 * @param {string} params.zonaEldorado - Clave de zona en Eldorado (ej: "km1_6")
 * @param {string} params.deptoOtro - Clave de departamento de Misiones (ej: "gral_san_martin")
 * @param {string} params.localidadOtro - Nombre de la localidad seleccionada (ej: "Capioví")
 * @returns {Object} { valido, error, subtotal, costoEnvio, total, esGratis, aviso, totalLadrillos, datosEnvio }
 */
export function validarYCalcularEnvio({
  carrito = [],
  tipoDestino = "eldorado",
  zonaEldorado = "km1_6",
  deptoOtro = "",
  localidadOtro = ""
} = {}) {
  const items = Array.isArray(carrito) ? carrito : [];
  const subtotal = items.reduce((acc, item) => {
    return acc + Number(item.precio || 0) * Number(item.cantidad || 1);
  }, 0);

  const totalLadrillos = contarLadrillosCarrito(items);

  let valido = true;
  let error = null;
  let costoEnvio = 0;
  let esGratis = false;
  let aviso = { texto: "", clase: "pago" };

  let nombreZona = "";
  let departamento = "Eldorado";
  let localidad = "Eldorado";

  if (tipoDestino === "eldorado") {
    const zonaInfo = configEnvios.zonasEldorado[zonaEldorado] || configEnvios.zonasEldorado.km1_6;
    nombreZona = zonaInfo.nombre;
    departamento = "Eldorado";
    localidad = zonaInfo.nombre;

    const fleteBase = zonaInfo.costoFlete;
    const restriccionLadrillosActiva = requiereMinimoLadrillosEnvioGratis(items);
    const faltanteParaEnvioGratis = UMBRAL_ENVIO_GRATIS - subtotal;
    const cercaDeEnvioGratis = faltanteParaEnvioGratis > 0 && faltanteParaEnvioGratis <= 20000;

    // Regla: si el carrito contiene productos que no son ladrillos,
    // requiere al menos 150 ladrillos para acceder a envío gratis, sin importar el monto.
    if (restriccionLadrillosActiva) {
      costoEnvio = fleteBase;
      esGratis = false;
      const ladrillosFaltantes = Math.max(0, MINIMO_LADRILLOS_ENVIO_GRATIS - totalLadrillos);

      if (subtotal >= UMBRAL_ENVIO_GRATIS) {
        aviso = {
          texto: `Flete en Eldorado (${nombreZona}): ${formatearPrecio(fleteBase)}. Los pedidos con productos que no son ladrillos requieren incluir al menos 150 ladrillos para acceder a envío gratis (faltan ${ladrillosFaltantes} ladrillos).`,
          clase: "pago"
        };
      } else if (cercaDeEnvioGratis) {
        const faltante = formatearPrecio(faltanteParaEnvioGratis);
        aviso = {
          texto: `¡Estás cerca en monto! Si sumás ${faltante} más y alcanzás un mínimo de 150 ladrillos, el envío es incluido en Eldorado.`,
          clase: "cerca"
        };
      } else {
        aviso = {
          texto: `Flete en Eldorado (${nombreZona}): ${formatearPrecio(fleteBase)}.`,
          clase: "pago"
        };
      }
    } else if (subtotal >= UMBRAL_ENVIO_GRATIS) {
      costoEnvio = 0;
      esGratis = true;
      aviso = {
        texto: "🎉 ¡Tu envío es incluido en Eldorado!",
        clase: "incluido"
      };
    } else if (cercaDeEnvioGratis) {
      costoEnvio = fleteBase;
      esGratis = false;
      const faltante = formatearPrecio(faltanteParaEnvioGratis);
      aviso = {
        texto: `¡Estás cerca del envío gratis! Si sumás ${faltante} más, el envío es incluido en Eldorado.`,
        clase: "cerca"
      };
    } else {
      costoEnvio = fleteBase;
      esGratis = false;
      aviso = {
        texto: `Flete en Eldorado (${nombreZona}): ${formatearPrecio(fleteBase)}.`,
        clase: "pago"
      };
    }
  } else {
    // Otro punto de Misiones: Presupuesto de envío a coordinar con el cliente
    const deptoInfo = configEnvios.departamentos[deptoOtro] || obtenerInfoDepartamento(deptoOtro);
    departamento = deptoInfo?.nombre || deptoOtro || "Misiones";
    localidad = localidadOtro || deptoInfo?.localidades?.[0] || "";
    nombreZona = `${departamento} — ${localidad}`;
    costoEnvio = 0;
    esGratis = false;
    valido = true;
    error = null;
    aviso = {
      texto: "Nos vamos a comunicar con vos a la brevedad para coordinar el presupuesto de envío según tu localidad.",
      clase: "info"
    };
  }

  const total = subtotal + costoEnvio;

  return {
    valido,
    error,
    subtotal,
    costoEnvio,
    total,
    esGratis,
    aviso,
    totalLadrillos,
    datosEnvio: {
      tipoDestino,
      departamento,
      localidad,
      zonaEnvio: nombreZona,
      costoEnvio
    }
  };
}

/**
 * Evalúa si existe discrepancia significativa entre el total informado por el cliente y el oficial.
 * @param {Object} params
 * @param {number} params.totalReportadoPorCliente - Total que calculó la UI del cliente
 * @param {number} params.totalCalculadoOficial - Total real verificado con el catálogo oficial
 * @returns {Object} { revisionRequerida: boolean, diferencia: number, motivoRevision: string|null }
 */
export function evaluarDiscrepanciaPrecios({ totalReportadoPorCliente, totalCalculadoOficial }) {
  const reportado = Number(totalReportadoPorCliente || 0);
  const oficial = Number(totalCalculadoOficial || 0);
  const diferencia = Math.abs(reportado - oficial);

  // Consideramos discrepancia si la diferencia absoluta supera $1 (tolerancia a redondeos de céntimos)
  const revisionRequerida = diferencia > 1;
  const motivoRevision = revisionRequerida
    ? `Discrepancia de precios: el cliente reportó ${formatearPrecio(reportado)} pero el catálogo oficial suma ${formatearPrecio(oficial)} (Diferencia: ${formatearPrecio(diferencia)}).`
    : null;

  return {
    revisionRequerida,
    diferencia,
    motivoRevision
  };
}

/**
 * Estructura del Pedido para Firestore:
 * Recopila y normaliza todos los datos del pedido para guardarlo en Cloud Firestore (/pedidos).
 * Incluye auditoría server-side: totalReportadoPorCliente, totalCalculadoOficial y revisionRequerida.
 * 
 * @param {Object} params
 * @param {Array} params.items - Productos congelados del catálogo oficial
 * @param {Object} params.cliente - { nombre, telefono, direccion }
 * @param {Object} params.calculoEnvio - Resultado de validarYCalcularEnvio()
 * @param {Object} params.formularioEnvio - { tipoDestino, departamento, localidad, direccion, referencia }
 * @param {number} params.numeroPedido - Número correlativo entero (ej: 1, 2, 3...)
 * @param {string} params.codigoPedido - Código visible formateado (ej: "PEDIDO #0001")
 * @param {number} [params.totalReportadoPorCliente] - Total informado por el cliente para contraste
 * @param {boolean} [params.revisionRequerida] - Flag que indica si requiere revisión administrativa
 * @param {string} [params.motivoRevision] - Explicación de la revisión si aplica
 * @param {any} params.serverTimestamp - Función o timestamp de Firestore
 * @returns {Object} Objeto con las propiedades requeridas y permitidas por firestore.rules
 */
export function construirObjetoPedidoFirestore({
  items,
  cliente,
  calculoEnvio,
  formularioEnvio,
  numeroPedido,
  codigoPedido,
  totalReportadoPorCliente = null,
  revisionRequerida = false,
  motivoRevision = "",
  serverTimestamp
}) {
  const tipoDest = String(formularioEnvio?.tipoDestino || "eldorado");
  const esOtro = tipoDest === "otro";
  const depto = String(formularioEnvio?.departamento || (esOtro ? "Misiones" : "Eldorado")).slice(0, 100);
  const loc = String(formularioEnvio?.localidad || "Eldorado").slice(0, 100);
  const dir = String(formularioEnvio?.direccion || cliente?.direccion || "").trim().slice(0, 200);
  const ref = String(formularioEnvio?.referencia || "").trim().slice(0, 300);

  // Dirección descriptiva combinada para visualización ágil
  const direccionCompleta = cliente?.direccion || (
    ref
      ? `${dir}, ${loc} (${depto}) — Ref: ${ref}`
      : `${dir}, ${loc} (${depto})`
  );

  const subtotal = Number(calculoEnvio?.subtotal || 0);
  const costoEnvio = esOtro ? 0 : Number(calculoEnvio?.costoEnvio || 0);
  const total = esOtro ? subtotal : Number(calculoEnvio?.total || (subtotal + costoEnvio));

  const reportado = totalReportadoPorCliente !== null && totalReportadoPorCliente !== undefined 
    ? Number(totalReportadoPorCliente) 
    : total;

  const pedidoData = {
    numeroPedido: Number(numeroPedido),
    codigoPedido: String(codigoPedido),
    clienteNombre: String(cliente?.nombre || "").trim().slice(0, 100),
    clienteTelefono: String(cliente?.telefono || "").trim().slice(0, 50),
    clienteDireccion: String(direccionCompleta).slice(0, 300),
    tipoDestino: tipoDest.slice(0, 50),
    departamento: depto,
    localidad: loc,
    direccion: dir,
    referencia: ref,
    zonaEnvio: String(calculoEnvio?.datosEnvio?.zonaEnvio || `${depto} — ${loc}`).slice(0, 100),
    items: Array.isArray(items) ? items : [],
    subtotal: subtotal,
    costoEnvio: costoEnvio,
    total: total,
    totalCalculadoOficial: total,
    totalReportadoPorCliente: reportado,
    revisionRequerida: Boolean(revisionRequerida),
    motivoRevision: String(motivoRevision || "").slice(0, 500),
    estado: "pendiente",
    createdAt: typeof serverTimestamp === "function" ? serverTimestamp() : (serverTimestamp || new Date())
  };

  if (esOtro) {
    pedidoData.envioACoordinar = true;
  }

  return pedidoData;
}

/**
 * Genera el mensaje formateado para enviar por WhatsApp con el detalle del pedido.
 * Si el producto tiene descripción, se incluye debajo de cada uno.
 */
export function generarMensajeWhatsAppPedido({
  codigoPedido = "PEDIDO",
  clienteNombre = "",
  clienteDireccion = "",
  items = [],
  subtotal = 0,
  costoEnvio = 0,
  total = 0,
  envioACoordinar = false
} = {}) {
  const lineas = [
    `¡Hola Alfa Materiales! Acabo de registrar mi *${codigoPedido}*.`,
    clienteNombre ? `*Cliente:* ${clienteNombre}` : "",
    clienteDireccion ? `*Entrega:* ${clienteDireccion}` : "",
    "",
    "*Detalle de productos:*",
  ].filter(linea => linea !== "");

  items.forEach(item => {
    const cant = item.cantidad || 1;
    const precio = formatearPrecio(item.precio || 0);
    const sub = formatearPrecio((item.precio || 0) * cant);
    lineas.push(`• *${cant}x* ${item.nombre} (${precio} c/u) = ${sub}`);
    if (item.descripcion && String(item.descripcion).trim()) {
      const descLineas = String(item.descripcion).trim().split("\n");
      descLineas.forEach(dl => {
        if (dl.trim()) lineas.push(`   _${dl.trim()}_`);
      });
    }
  });

  lineas.push("");
  lineas.push(`*Subtotal:* ${formatearPrecio(subtotal)}`);
  if (envioACoordinar) {
    lineas.push(`*Flete:* A coordinar`);
  } else if (costoEnvio === 0) {
    lineas.push(`*Flete:* ¡Incluido en Eldorado! (Gratis)`);
  } else {
    lineas.push(`*Flete:* ${formatearPrecio(costoEnvio)}`);
  }
  lineas.push(`*Total:* ${formatearPrecio(total)}`);

  return lineas.join("\n");
}
