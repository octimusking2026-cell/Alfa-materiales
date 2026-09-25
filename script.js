/* ==========================================================================
   Alfa Materiales Eldorado — script.js
   Punto de entrada principal y orquestador de módulos (Catálogo, Carrito y Envíos)
   ========================================================================== */

import { inicializarCatalogo, conectarCatalogoFirestore } from './catalogo.js';
import { inicializarCarrito, actualizarNumerito } from './carrito.js';

// Inicialización reactiva de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  inicializarCatalogo();
  inicializarCarrito();
  actualizarNumerito();
  conectarCatalogoFirestore();
});

// Re-exportaciones para compatibilidad con cualquier import existente
export * from './catalogo.js';
export * from './carrito.js';
export * from './envio.js';
