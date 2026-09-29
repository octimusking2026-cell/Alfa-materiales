/* ==========================================================================
   Alfa Materiales Eldorado — reglas-envio.js
   Módulo universal de constantes puras y cálculo de fletes/envíos.
   Funciones y constantes puras sin dependencias de DOM, window ni navegador.
   Compatible tanto con el cliente web (ESM) como con funciones serverless (Netlify/Node).
   ========================================================================== */

// Parámetros y reglas oficiales de negocio
export const UMBRAL_ENVIO_GRATIS = 300000; // Monto mínimo para envío gratis en Eldorado ($300.000)
export const UMBRAL_AVISO_CERCA = 280000;  // Aviso "Estás cerca" a partir de $280.000
export const COSTO_ENVIO = 20000;          // Costo de flete base en Eldorado ($20.000)
export const COSTO_FLETE_KM1_6 = 20000;    // Costo de flete Km 1 a 6
export const COSTO_FLETE_KM7_12 = 20000;   // Costo de flete Km 7 a 12
export const MINIMO_LADRILLOS_ENVIO_GRATIS = 150; // Mínimo de unidades de ladrillo si el carrito incluye otros productos

// Zonas válidas de Eldorado
export const ZONAS_ELDORADO_VALIDAS = ["km1_6", "km7_12"];
export const COSTOS_FLETE_ELDORADO = {
  km1_6: 20000,
  km7_12: 20000
};

/**
 * Determina si un producto individual es un ladrillo.
 * Decide SOLO por item.categoria === "ladrillos".
 */
export function esLadrillo(item) {
  const cat = (item?.categoria || "").toLowerCase().trim();
  return cat === "ladrillos";
}

/**
 * Cuenta la cantidad total de ladrillos en el carrito.
 * Suma las unidades de productos con categoría "ladrillos" más (cantidad × ladrilloEquivalente) para otras categorías.
 */
export function contarLadrillos(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((acc, item) => {
    const cant = Number(item.cantidad || 0);
    if (esLadrillo(item)) {
      return acc + cant;
    }
    const equiv = Number(item.ladrilloEquivalente || 0);
    return acc + (equiv > 0 ? cant * equiv : 0);
  }, 0);
}

// Alias para retrocompatibilidad
export const contarLadrillosCarrito = contarLadrillos;

/**
 * Devuelve true si el carrito contiene CUALQUIER producto cuya categoría no sea "ladrillos".
 */
export function tieneProductosConRestriccionLadrillos(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  return items.some(item => !esLadrillo(item));
}

/**
 * Regla de negocio de envío gratis:
 * Si el carrito contiene CUALQUIER producto cuya categoría no sea "ladrillos",
 * el envío gratis requiere al menos 150 unidades de productos con categoria === "ladrillos".
 * Si hay menos de 150 ladrillos se cobra el flete, aunque el subtotal supere $300.000.
 * Si el carrito tiene solo ladrillos, aplica solo el monto mínimo ($300.000).
 */
export function requiereMinimoLadrillosEnvioGratis(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  const tieneRestringidos = tieneProductosConRestriccionLadrillos(items);
  const totalLadrillos = contarLadrillos(items);
  return tieneRestringidos && totalLadrillos < MINIMO_LADRILLOS_ENVIO_GRATIS;
}

// Alias para retrocompatibilidad
export const contieneSoloOtrosOCementoSinMinimoLadrillos = requiereMinimoLadrillosEnvioGratis;

/**
 * Calcula el costo del flete en ARS según las reglas oficiales de negocio.
 * @param {Object} params
 * @param {Array} [params.items] - Array de productos (con categoria, precio, cantidad, etc.)
 * @param {number|null} [params.subtotal] - Subtotal opcional (si no se especifica se calcula desde los items)
 * @param {string} [params.tipoDestino] - "eldorado" o "otro"
 * @param {string} [params.zonaEldorado] - Clave de zona ("km1_6" o "km7_12")
 * @returns {number} Costo de flete en ARS
 */
export function calcularCostoEnvio({
  items = [],
  subtotal = null,
  tipoDestino = "eldorado",
  zonaEldorado = "km1_6"
} = {}) {
  if (tipoDestino === "otro") {
    return 0; // Envío fuera de Eldorado: presupuesto a coordinar
  }

  const listaItems = Array.isArray(items) ? items : [];
  const subtotalCalculado = (subtotal !== null && subtotal !== undefined)
    ? Number(subtotal)
    : listaItems.reduce((acc, item) => acc + (Number(item.precio || 0) * Number(item.cantidad || 1)), 0);

  // Validar zona contra lista permitida (fallback seguro a km1_6)
  const zonaClave = ZONAS_ELDORADO_VALIDAS.includes(zonaEldorado) ? zonaEldorado : "km1_6";
  const fleteBase = COSTOS_FLETE_ELDORADO[zonaClave] ?? COSTO_ENVIO;

  const restriccionLadrillos = requiereMinimoLadrillosEnvioGratis(listaItems);

  // 1. Si contiene productos que no son ladrillos y menos de 150 ladrillos -> se cobra flete
  if (restriccionLadrillos) {
    return fleteBase;
  }

  // 2. Si el subtotal alcanza o supera el umbral ($300.000) -> envío gratis ($0)
  if (subtotalCalculado >= UMBRAL_ENVIO_GRATIS) {
    return 0;
  }

  // 3. Caso general -> se cobra flete base
  return fleteBase;
}
