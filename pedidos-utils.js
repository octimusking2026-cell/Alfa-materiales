/* ==========================================================================
   Alfa Materiales Eldorado — pedidos-utils.js
   Lógica centralizada de cálculo de envíos, estados y formato de pedidos.
   Evita discrepancias entre el carrito público, Firestore y el panel admin.
   ========================================================================== */

// Parámetros de negocio oficiales
export const UMBRAL_ENVIO_GRATIS = 300000; // A partir de $300.000
export const UMBRAL_AVISO_CERCA = 280000;  // Aviso "Estás cerca" a partir de $280.000
export const COSTO_ENVIO = 20000;          // Costo de flete dentro de la ciudad en ARS

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
 * Normaliza cadenas de texto eliminando tildes y diacríticos
 */
function normalizarTexto(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Determina si un producto individual corresponde a Cemento o Plasticor
 */
export function esCementoOPlasticor(item) {
  const nombreNorm = normalizarTexto(item?.nombre);
  return nombreNorm.includes("cemento") || nombreNorm.includes("plasticor");
}

/**
 * Regla de negocio especial:
 * Devuelve true si el pedido contiene ÚNICAMENTE cemento, plasticor o una combinación de ambos.
 * Si contiene algún otro producto (ej: ladrillos, barras de hierro, arena), devuelve false.
 */
export function contieneSoloCementoOPlasticor(carrito) {
  if (!carrito || !Array.isArray(carrito) || carrito.length === 0) return false;
  return carrito.every(item => esCementoOPlasticor(item));
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
      costoFlete: 15000,
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
      costoFlete: 15000,
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
 * Cuenta la cantidad total de unidades de productos tipo Ladrillo en el carrito
 */
export function contarLadrillosCarrito(carrito) {
  if (!carrito || !Array.isArray(carrito)) return 0;
  return carrito.reduce((acc, item) => {
    const cat = (item.categoria || "").toLowerCase();
    const nombre = (item.nombre || "").toLowerCase();
    const esLadrillo = cat === "ladrillos" || nombre.includes("ladrillo");
    return esLadrillo ? acc + Number(item.cantidad || 0) : acc;
  }, 0);
}

/**
 * Valida reglas de flete y calcula costo total de envío en tiempo real
 * @param {Object} params
 * @param {Array} params.carrito - Array de productos del carrito
 * @param {string} params.tipoDestino - "eldorado" o "otro"
 * @param {string} params.zonaEldorado - Clave de zona en Eldorado (ej: "centro_km8_10")
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
  const soloCementoPlasticor = contieneSoloCementoOPlasticor(items);

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

    // Dentro de Eldorado rige la política de flete gratis a partir de $300.000 (excepto solo Cemento/Plasticor)
    if (soloCementoPlasticor) {
      costoEnvio = fleteBase;
      esGratis = false;
      aviso = {
        texto: `Flete en Eldorado (${nombreZona}): ${formatearPrecio(fleteBase)}. Los pedidos exclusivamente de Cemento o Plasticor no acceden a envío gratis.`,
        clase: "pago"
      };
    } else if (subtotal >= UMBRAL_ENVIO_GRATIS) {
      costoEnvio = 0;
      esGratis = true;
      aviso = {
        texto: "🎉 ¡Tu envío es gratis en Eldorado!",
        clase: "incluido"
      };
    } else if (subtotal >= UMBRAL_AVISO_CERCA) {
      costoEnvio = fleteBase;
      esGratis = false;
      const faltante = formatearPrecio(UMBRAL_ENVIO_GRATIS - subtotal);
      aviso = {
        texto: `¡Estás cerca del envío gratis! Sumá ${faltante} más y tu envío será gratis en Eldorado.`,
        clase: "cerca"
      };
    } else {
      costoEnvio = fleteBase;
      esGratis = false;
      const faltante = formatearPrecio(UMBRAL_ENVIO_GRATIS - subtotal);
      aviso = {
        texto: `Flete en Eldorado (${nombreZona}): ${formatearPrecio(fleteBase)}. (Sumá ${faltante} más para envío gratis).`,
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
 * Estructura del Pedido para Firestore:
 * Recopila y normaliza todos los datos del pedido para guardarlo en Cloud Firestore (/pedidos).
 * Incluye: departamento, localidad, direccion, referencia y costoEnvio.
 * 
 * @param {Object} params
 * @param {Array} params.items - Productos congelados del carrito
 * @param {Object} params.cliente - { nombre, telefono, direccion }
 * @param {Object} params.calculoEnvio - Resultado de validarYCalcularEnvio()
 * @param {Object} params.formularioEnvio - { tipoDestino, departamento, localidad, direccion, referencia }
 * @param {number} params.numeroPedido - Número correlativo entero (ej: 1, 2, 3...)
 * @param {string} params.codigoPedido - Código visible formateado (ej: "PEDIDO #0001")
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
    estado: "pendiente",
    createdAt: typeof serverTimestamp === "function" ? serverTimestamp() : (serverTimestamp || new Date())
  };

  if (esOtro) {
    pedidoData.envioACoordinar = true;
  }

  return pedidoData;
}
