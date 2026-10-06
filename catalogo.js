/* ==========================================================================
   Alfa Materiales Eldorado — catalogo.js
   Catálogo de productos, filtros por categoría, búsqueda y sincronización Firestore
   ========================================================================== */

import { db } from './firebase-init.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { formatearPrecio, optimizarImagenUrl } from './pedidos-utils.js';
import { agregarAlCarrito } from './carrito.js';
import { CATEGORIAS, MAPA_CATEGORIAS, ORDEN_CATEGORIAS } from './categorias.js';

const WHATSAPP_NUMERO = "543751563056";

/* ---- CATÁLOGO INICIAL DE RESERVA (FALLBACK) ----------------------------- */
export const PRODUCTOS_INICIALES = [
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
  { id: "27", nombre: "Barra de hierro 20", precio: 75375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
];

export let productos = [...PRODUCTOS_INICIALES];

let renderizarCatalogoFn = null;

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

export function inicializarCatalogo() {
  const contenedor = document.querySelector(".contenedor-productos");
  if (!contenedor) return;

  const listaMenuNav = document.getElementById("menu-categorias-lista");
  if (listaMenuNav) {
    const numeritoActual = document.querySelector(".numerito")?.textContent || "0";
    listaMenuNav.innerHTML = `
      <li>
        <button class="boton-menu boton-categoria active" data-categoria="todos"><i class="bi bi-hand-index"></i>Todos los productos</button>
      </li>
      ${CATEGORIAS.map(cat => `
        <li>
          <button class="boton-menu boton-categoria" data-categoria="${cat.id}">${cat.nombre}</button>
        </li>
      `).join("")}
      <li>
        <a class="boton-menu boton-carrito" href="carrito.html"><i class="bi bi-cart"></i>Carrito<span class="numerito">${numeritoActual}</span></a>
      </li>
      <li>
        <a class="boton-menu boton-contacto" href="contacto.html"><i class="bi bi-geo-alt"></i>Contacto</a>
      </li>
      <li>
        <a class="boton-menu boton-admin" href="admin.html"><i class="bi bi-shield-lock"></i>Administración</a>
      </li>
    `;
  }

  const botonesCategoria = document.querySelectorAll(".boton-categoria");
  const titulo = document.querySelector(".titulo");
  const inputBusqueda = document.querySelector(".buscador-input");

  let categoriaActual = "todos";

  function renderizarProductos() {
    contenedor.innerHTML = "";

    let lista = categoriaActual === "todos"
      ? [...productos].sort((a, b) => {
          const ordA = ORDEN_CATEGORIAS[a.categoria] ?? 99;
          const ordB = ORDEN_CATEGORIAS[b.categoria] ?? 99;
          if (ordA !== ordB) return ordA - ordB;
          return (a.nombre || "").localeCompare(b.nombre || "");
        })
      : productos.filter(p => p.categoria === categoriaActual);

    const busqueda = inputBusqueda ? inputBusqueda.value.trim().toLowerCase() : "";
    if (busqueda) {
      lista = lista.filter(p => (p.nombre || "").toLowerCase().includes(busqueda));
    }

    if (lista.length === 0) {
      if (busqueda) {
        contenedor.innerHTML = `
          <p class="carrito-vacio">
            No encontramos "${escaparHtml(inputBusqueda.value.trim())}" entre nuestros productos.
            Probá con otro nombre o <a href="https://wa.me/${WHATSAPP_NUMERO}" target="_blank">consultanos por WhatsApp</a>.
          </p>`;
      } else {
        contenedor.innerHTML = `<p class="carrito-vacio">No hay productos en esta categoría todavía.</p>`;
      }
      return;
    }

    function renderizarDescripcionProducto(desc) {
      if (!desc || !desc.trim()) return "";
      const textoLimpio = desc.trim();
      const esLargo = textoLimpio.length > 110 || textoLimpio.split("\n").length > 3;

      if (!esLargo) {
        return `<div class="producto-descripcion" style="font-size: 0.82rem; color: #555; margin: 4px 0 8px 0; line-height: 1.4; white-space: pre-wrap; word-break: break-word;">${escaparHtml(textoLimpio)}</div>`;
      }

      const corto = textoLimpio.slice(0, 100) + "...";
      return `
        <div class="producto-descripcion-contenedor" style="margin: 4px 0 8px 0;">
          <div class="producto-desc-corta" style="font-size: 0.82rem; color: #555; line-height: 1.4; white-space: pre-wrap; word-break: break-word;">
            ${escaparHtml(corto)}
            <button type="button" class="btn-toggle-desc" style="background: none; border: none; padding: 0 4px; color: var(--color-primario, #ff5722); font-size: 0.8rem; font-weight: 600; cursor: pointer; text-decoration: underline;">ver más</button>
          </div>
          <div class="producto-desc-completa" style="display: none; font-size: 0.82rem; color: #555; line-height: 1.4; white-space: pre-wrap; word-break: break-word;">
            ${escaparHtml(textoLimpio)}
            <button type="button" class="btn-toggle-desc" style="background: none; border: none; padding: 0 4px; color: var(--color-primario, #ff5722); font-size: 0.8rem; font-weight: 600; cursor: pointer; text-decoration: underline;">ver menos</button>
          </div>
        </div>
      `;
    }

    lista.forEach(producto => {
      const articulo = document.createElement("article");
      articulo.classList.add("producto");
      articulo.innerHTML = `
        <img class="producto-imagen" src="${optimizarImagenUrl(producto.imagen)}" alt="${escaparHtml(producto.nombre)}" onerror="this.src='fotos/favicon-32.png'">
        <div class="producto-detalles">
          <h3 class="producto-nombre">${escaparHtml(producto.nombre)}</h3>
          ${renderizarDescripcionProducto(producto.descripcion)}
          <p class="producto-precio">${formatearPrecio(producto.precio)}</p>
          <div class="producto-cantidad">
            <button type="button" class="cantidad-btn cantidad-restar" data-id="${producto.id}" aria-label="Restar cantidad">−</button>
            <input type="number" class="cantidad-valor" data-id="${producto.id}" min="1" step="1" value="1" inputmode="numeric">
            <button type="button" class="cantidad-btn cantidad-sumar" data-id="${producto.id}" aria-label="Sumar cantidad">+</button>
          </div>
          <button class="producto-boton" data-id="${producto.id}">
            <i class="bi bi-cart-plus"></i> Agregar
          </button>
        </div>
      `;
      contenedor.appendChild(articulo);
    });
  }

  renderizarCatalogoFn = renderizarProductos;

  // Filtro por categoría
  botonesCategoria.forEach(boton => {
    boton.addEventListener("click", () => {
      botonesCategoria.forEach(b => b.classList.remove("active"));
      boton.classList.add("active");

      const catId = boton.dataset.categoria || "todos";
      categoriaActual = catId;
      if (catId === "todos") {
        titulo.textContent = "Todos los productos";
      } else {
        const catObj = MAPA_CATEGORIAS[catId];
        titulo.textContent = catObj ? catObj.nombre : boton.textContent.trim();
      }
      renderizarProductos();
    });
  });

  // Buscador reactivo
  inputBusqueda?.addEventListener("input", () => {
    renderizarProductos();
  });

  // Delegación de eventos para agregar y sumar/restar
  contenedor.addEventListener("click", (evento) => {
    const botonToggleDesc = evento.target.closest(".btn-toggle-desc");
    if (botonToggleDesc) {
      const contenedorDesc = botonToggleDesc.closest(".producto-descripcion-contenedor");
      if (contenedorDesc) {
        const corta = contenedorDesc.querySelector(".producto-desc-corta");
        const completa = contenedorDesc.querySelector(".producto-desc-completa");
        if (corta && completa) {
          const estaMostrandoCorta = corta.style.display !== "none";
          corta.style.display = estaMostrandoCorta ? "none" : "block";
          completa.style.display = estaMostrandoCorta ? "block" : "none";
        }
      }
      return;
    }

    const botonRestar = evento.target.closest(".cantidad-restar");
    const botonSumar = evento.target.closest(".cantidad-sumar");
    const botonAgregar = evento.target.closest(".producto-boton");

    if (botonRestar) {
      cambiarCantidadSeleccionada(botonRestar.dataset.id, -1);
      return;
    }
    if (botonSumar) {
      cambiarCantidadSeleccionada(botonSumar.dataset.id, 1);
      return;
    }
    if (botonAgregar) {
      const id = botonAgregar.dataset.id;
      const inputCantidad = contenedor.querySelector(`.cantidad-valor[data-id="${id}"]`);
      const cantidad = inputCantidad ? parseInt(inputCantidad.value, 10) : 1;
      const prod = productos.find(p => String(p.id) === String(id));
      if (prod) {
        agregarAlCarrito(prod, cantidad);
      }
      if (inputCantidad) inputCantidad.value = "1";
    }
  });

  function cambiarCantidadSeleccionada(id, delta) {
    const input = contenedor.querySelector(`.cantidad-valor[data-id="${id}"]`);
    if (!input) return;
    let valor = (parseInt(input.value, 10) || 0) + delta;
    if (valor < 1) valor = 1;
    input.value = valor;
  }

  contenedor.addEventListener("change", (evento) => {
    const input = evento.target.closest(".cantidad-valor");
    if (!input) return;
    let valor = parseInt(input.value, 10);
    if (isNaN(valor) || valor < 1) valor = 1;
    input.value = valor;
  });

  renderizarProductos();
}

/**
 * Sincronización en tiempo real del catálogo desde Firestore
 */
export function conectarCatalogoFirestore() {
  const colProductos = collection(db, "productos");
  onSnapshot(colProductos, (snapshot) => {
    if (!snapshot.empty) {
      const listaDb = [];
      snapshot.forEach(docSnap => {
        listaDb.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      productos = listaDb;
      if (renderizarCatalogoFn) {
        renderizarCatalogoFn();
      }
    }
  }, (error) => {
    console.warn("No se pudo obtener catálogo de Firestore, usando catálogo base:", error);
  });
}
