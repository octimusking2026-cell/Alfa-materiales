/* ==========================================================================
   Alfa Materiales Eldorado — script.js
   ========================================================================== */

/* ---- CATÁLOGO DE PRODUCTOS -------------------------------------------
   Para agregar un producto nuevo, sumá un objeto a este array. No hace
   falta tocar el HTML: el catálogo se dibuja solo a partir de esta lista.
   "categoria" tiene que ser exactamente: "ladrillos", "aridos" u "otros"
   (coincide con los botones del menú).
------------------------------------------------------------------------- */
const productos = [
  // --- Bloques / Ladrillos ---
  { id: 1, nombre: "Ladrillo hueco 8×18×25 Liviano (1ª)", precio: 330, imagen: "fotos/8x18x25 L.jpg", categoria: "ladrillos" },
  { id: 2, nombre: "Ladrillo hueco 12×18×25 Livaino (1ª)", precio: 370, imagen: "fotos/12x18x25 L.jpg", categoria: "ladrillos" },
  { id: 3, nombre: "Ladrillo hueco 12×18×25 Liviano (2ª)", precio: 330, imagen: "fotos/12x18x25 L.jpg", categoria: "ladrillos" },
  { id: 4, nombre: "Ladrillo hueco 12×18×25 Visto (1ª)", precio: 495, imagen: "fotos/12x18x25 visto.jpg", categoria: "ladrillos" },
  { id: 5, nombre: "Ladrillo hueco 12×18×25 Visto (2ª)", precio: 395, imagen: "fotos/12x18x25 visto.jpg", categoria: "ladrillos" },
  { id: 6, nombre: "Ladrillo hueco 18×18×25 Liviano (1ª)", precio: 545, imagen: "fotos/18x18x25 nuevo.jpg", categoria: "ladrillos" },
  { id: 7, nombre: "Ladrillo hueco 18×18×25 Liviano (2ª)", precio: 440, imagen: "fotos/18x18x25 nuevo.jpg", categoria: "ladrillos" },
  { id: 8, nombre: "Medio ladrillo hueco 12×18 Liviano", precio: 250, imagen: "fotos/medio 12x18 L.jpg", categoria: "ladrillos" },
  { id: 9, nombre: "Medio ladrillo hueco 12×18 Visto", precio: 280, imagen: "fotos/medio 12x18 V.jpg", categoria: "ladrillos" },
  { id: 10, nombre: "Medio Ladrillo hueco 18×18 Liviano", precio: 320, imagen: "fotos/medio 18x18.jpg", categoria: "ladrillos" },
  { id: 11, nombre: "Peine encadenado", precio: 500, imagen: "fotos/peinde para encadenado.jpg", categoria: "ladrillos" },
  { id: 12, nombre: "Ladrillo macizo (1ª)", precio: 400, imagen: "fotos/macizo 1ra.jpg", categoria: "ladrillos" },
  { id: 13, nombre: "Ladrillo macizo (2ª)", precio: 230, imagen: "fotos/macizo comun.jpg", categoria: "ladrillos" },

  // --- Áridos y Aglomerantes (ejemplo, reemplazar por datos reales) ---
  { id: 14, nombre: "Cemento holcim 25kg", precio: 8000, imagen: "fotos/cemento holcim.jpg", categoria: "aridos" },
  { id: 15, nombre: "Plasticor 25kg", precio: 8000, imagen: "fotos/plasticor.jpg", categoria: "aridos" },
  { id: 16, nombre: "Arena fina (m³)", precio: 55000, imagen: "fotos/bolson de arena.jpg", categoria: "aridos" },
  { id: 17, nombre: "Ripio (m³)", precio: 55000, imagen: "fotos/bolson de ripio1.jpg", categoria: "aridos" },

  // --- Otros (ejemplo, reemplazar por datos reales) ---
  { id: 18, nombre: "Alambron kg", precio: 4600, imagen: "fotos/alambron.png", categoria: "otros" },
  { id: 19, nombre: "Alambre dulce kg", precio: 4600, imagen: "fotos/alambre dulce.webp", categoria: "otros" },
  { id: 20, nombre: "Alambre galvanizado 14", precio: 5500, imagen: "fotos/alambre galvanizado 14.jpg", categoria: "otros" },
  { id: 21, nombre: "Barra de hierro 4,2", precio: 4000, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: 22, nombre: "Barra de hierro 6", precio: 7125, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: 23, nombre: "Barra de hierro 8", precio: 12375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: 24, nombre: "Barra de hierro 10", precio: 19500, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: 25, nombre: "Barra de hierro 12", precio: 27750, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: 26, nombre: "Barra de hierro 16", precio: 47500, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { id: 27, nombre: "Barra de hierro 20", precio: 75375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
];

const WHATSAPP_NUMERO = "543751563056"; // 54 (Argentina) + 3751563056

// Reglas de envío
const UMBRAL_ENVIO_GRATIS = 400000; // a partir de acá, envío incluido
const UMBRAL_AVISO_CERCA = 380000;  // entre este valor y el anterior, se avisa que está cerca
const COSTO_ENVIO = 20000;          // costo si no llega al umbral de aviso

/* ==========================================================================
   Carrito — persistido en localStorage para que no se pierda al navegar
   ========================================================================== */

function obtenerCarrito() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}

function guardarCarrito(carrito) {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

function totalUnidadesCarrito(carrito) {
  return carrito.reduce((acc, item) => acc + item.cantidad, 0);
}

function totalPesosCarrito(carrito) {
  return carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
}

function formatearPrecio(num) {
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 });
}

function actualizarNumerito() {
  const numerito = document.querySelector(".numerito");
  if (!numerito) return;
  // Cuenta líneas de producto distintas (no la suma de cantidades):
  // 1000 ladrillos + 30m de alambre = 2 productos en el numerito.
  numerito.textContent = obtenerCarrito().length;
}

// Convierte texto a HTML seguro (evita que símbolos como < > rompan el
// mensaje o inyecten HTML si alguien los escribe en el buscador).
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/* ==========================================================================
   Página index.html — catálogo
   ========================================================================== */

function inicializarCatalogo() {
  const contenedor = document.querySelector(".contenedor-productos");
  if (!contenedor) return; // esta página no es index.html

  const botonesCategoria = document.querySelectorAll(".boton-categoria");
  const titulo = document.querySelector(".titulo");
  const inputBusqueda = document.querySelector(".buscador-input");

  let categoriaActual = "todos"; // se actualiza al hacer click en el menú

  function renderizarProductos() {
    contenedor.innerHTML = "";

    let lista = categoriaActual === "todos"
      ? productos
      : productos.filter(p => p.categoria === categoriaActual);

    const busqueda = inputBusqueda ? inputBusqueda.value.trim().toLowerCase() : "";
    if (busqueda) {
      lista = lista.filter(p => p.nombre.toLowerCase().includes(busqueda));
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

    lista.forEach(producto => {
      const articulo = document.createElement("article");
      articulo.classList.add("producto");
      articulo.innerHTML = `
        <img class="producto-imagen" src="${producto.imagen}" alt="${producto.nombre}">
        <div class="producto-detalles">
          <h3 class="producto-nombre">${producto.nombre}</h3>
          <p class="producto-precio">${formatearPrecio(producto.precio)}</p>
          <div class="producto-cantidad">
            <button type="button" class="cantidad-btn cantidad-restar" data-id="${producto.id}" aria-label="Restar cantidad">−</button>
            <input type="number" class="cantidad-valor" data-id="${producto.id}" min="1" step="1" value="1" inputmode="numeric">
            <button type="button" class="cantidad-btn cantidad-sumar" data-id="${producto.id}" aria-label="Sumar cantidad">+</button>
          </div>
          <button class="producto-boton" data-id="${producto.id}">Agregar</button>
        </div>
      `;
      contenedor.appendChild(articulo);
    });
  }

  // Filtro por categoría
  botonesCategoria.forEach(boton => {
    boton.addEventListener("click", () => {
      botonesCategoria.forEach(b => b.classList.remove("active"));
      boton.classList.add("active");

      const texto = boton.textContent.trim().toLowerCase();
      let categoria = "todos";
      if (texto.includes("ladrillos")) categoria = "ladrillos";
      else if (texto.includes("áridos") || texto.includes("aridos")) categoria = "aridos";
      else if (texto.includes("otros")) categoria = "otros";

      categoriaActual = categoria;
      titulo.textContent = boton.textContent.trim();
      renderizarProductos();
    });
  });

  // Buscador: se actualiza en cada tecleo
  inputBusqueda?.addEventListener("input", () => {
    renderizarProductos();
  });

  // Un solo listener para todo el contenedor: cubre los botones de cantidad
  // y "Agregar" de cualquier producto, incluidos los que se sumen a futuro.
  contenedor.addEventListener("click", (evento) => {
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
      const id = Number(botonAgregar.dataset.id);
      const inputCantidad = contenedor.querySelector(`.cantidad-valor[data-id="${id}"]`);
      const cantidad = inputCantidad ? parseInt(inputCantidad.value, 10) : 1;
      agregarAlCarrito(id, cantidad);
      if (inputCantidad) inputCantidad.value = "1"; // reset visual tras agregar
    }
  });

  function cambiarCantidadSeleccionada(id, delta) {
    const input = contenedor.querySelector(`.cantidad-valor[data-id="${id}"]`);
    if (!input) return;
    let valor = (parseInt(input.value, 10) || 0) + delta;
    if (valor < 1) valor = 1;
    input.value = valor;
  }

  // La persona también puede tipear la cantidad directamente en el campo.
  // Mientras escribe la dejamos tranquila; recién al salir del campo (change)
  // corregimos si quedó vacía, en cero, negativa o con decimales.
  contenedor.addEventListener("change", (evento) => {
    const input = evento.target.closest(".cantidad-valor");
    if (!input) return;
    let valor = parseInt(input.value, 10);
    if (isNaN(valor) || valor < 1) valor = 1;
    input.value = valor;
  });

  renderizarProductos();
}

function agregarAlCarrito(id, cantidad = 1) {
  const producto = productos.find(p => p.id === id);
  if (!producto || cantidad < 1) return;

  const carrito = obtenerCarrito();
  const item = carrito.find(p => p.id === id);

  if (item) {
    item.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      imagen: producto.imagen,
      cantidad,
    });
  }

  guardarCarrito(carrito);
  actualizarNumerito();
}

/* ==========================================================================
   Página carrito.html
   ========================================================================== */

function inicializarCarrito() {
  const contenedorCarrito = document.querySelector(".contenedor-carrito");
  if (!contenedorCarrito) return; // esta página no es carrito.html

  renderizarCarrito();

  document.querySelector(".carrito-acciones-vaciar")?.addEventListener("click", () => {
    if (obtenerCarrito().length === 0) return;
    if (confirm("¿Vaciar todo el carrito?")) {
      guardarCarrito([]);
      renderizarCarrito();
    }
  });

  document.querySelector(".carrito-acciones-derecha button")?.addEventListener("click", finalizarCompra);
}

// Devuelve el texto y la clase CSS del aviso de envío según el total
function calcularAvisoEnvio(total) {
  if (total >= UMBRAL_ENVIO_GRATIS) {
    return { texto: "Envío incluido", clase: "incluido" };
  }
  if (total >= UMBRAL_AVISO_CERCA) {
    const faltante = formatearPrecio(UMBRAL_ENVIO_GRATIS - total);
    return { texto: `Sumá ${faltante} más y el envío no tiene costo`, clase: "cerca" };
  }
  return { texto: `El envío dentro de la ciudad tiene un costo de ${formatearPrecio(COSTO_ENVIO)}`, clase: "pago" };
}

function renderizarCarrito() {
  const carrito = obtenerCarrito();
  const vacioMsg = document.querySelector(".carrito-vacio");
  const listaProductos = document.querySelector(".carrito-productos");
  const acciones = document.querySelector(".carrito-acciones");
  const totalEl = document.querySelector(".carrito-total");
  const envioEl = document.querySelector(".carrito-envio");

  listaProductos.innerHTML = "";

  if (carrito.length === 0) {
    vacioMsg.style.display = "block";
    listaProductos.style.display = "none";
    if (acciones) acciones.style.display = "none";
    if (totalEl) totalEl.textContent = "";
    if (envioEl) envioEl.textContent = "";
    actualizarNumerito();
    return;
  }

  vacioMsg.style.display = "none";
  listaProductos.style.display = "flex";
  if (acciones) acciones.style.display = "flex";

  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    const div = document.createElement("div");
    div.classList.add("carrito-producto");
    div.innerHTML = `
      <img src="${item.imagen}" alt="${item.nombre}">
      <div class="carrito-producto-titulo">
        <small>Producto</small>
        <h3>${item.nombre}</h3>
      </div>
      <div class="carrito-producto-cantidad">
        <small>Cantidad</small>
        <p>${item.cantidad}</p>
      </div>
      <div class="carrito-producto-precio">
        <small>Precio</small>
        <p>${formatearPrecio(item.precio)}</p>
      </div>
      <div class="carrito-producto-subtotal">
        <small>Subtotal</small>
        <p>${formatearPrecio(subtotal)}</p>
      </div>
      <button class="carrito-producto-eliminar" data-id="${item.id}">
        <i class="bi bi-trash-fill"></i> Eliminar
      </button>
    `;
    listaProductos.appendChild(div);
  });

  listaProductos.querySelectorAll(".carrito-producto-eliminar").forEach(boton => {
    boton.addEventListener("click", () => eliminarDelCarrito(Number(boton.dataset.id)));
  });

  const total = totalPesosCarrito(carrito);

  if (totalEl) {
    totalEl.textContent = `Total: ${formatearPrecio(total)}`;
  }

  if (envioEl) {
    const aviso = calcularAvisoEnvio(total);
    envioEl.textContent = aviso.texto;
    envioEl.classList.remove("incluido", "cerca", "pago");
    envioEl.classList.add(aviso.clase);
  }

  actualizarNumerito();
}

function eliminarDelCarrito(id) {
  const carrito = obtenerCarrito().filter(p => p.id !== id);
  guardarCarrito(carrito);
  renderizarCarrito();
}

function finalizarCompra() {
  const carrito = obtenerCarrito();
  if (carrito.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }

  const total = totalPesosCarrito(carrito);
  const lineaEnvio = total >= UMBRAL_ENVIO_GRATIS
    ? "Envío incluido"
    : `Valor de envío dentro de la ciudad: ${formatearPrecio(COSTO_ENVIO)}`;

  let mensaje = "Hola! Quiero hacer un pedido en Alfa Materiales:\n\n";

  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    mensaje += `• ${item.nombre} — Cant: ${item.cantidad} — ${formatearPrecio(item.precio)} c/u — Subtotal: ${formatearPrecio(subtotal)}\n`;
  });

  mensaje += `\n${lineaEnvio}\n`;
  mensaje += `\nTotal: ${formatearPrecio(total)}`;

  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}

/* ==========================================================================
   Inicio
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  inicializarCatalogo();
  inicializarCarrito();
  actualizarNumerito();
});