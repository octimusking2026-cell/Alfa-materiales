/* ==========================================================================
   Alfa Materiales Eldorado — carrito.js
   Gestión del carrito en localStorage, renderizado y checkout en Firestore
   ========================================================================== */

import { 
  db, 
  firebaseConfig
} from './firebase-init.js';

import { 
  doc, 
  getDoc 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { 
  configEnvios, 
  obtenerInfoDepartamento, 
  formatearPrecio, 
  formatearCodigoPedido, 
  construirObjetoPedidoFirestore 
} from './pedidos-utils.js';

import { 
  configurarModuloEnvios, 
  ejecutarValidacionEnvioUI, 
  envioSeleccion 
} from './envio.js';

import { 
  mostrarAlertaModal, 
  mostrarConfirmacionModal, 
  mostrarModalFormularioPedido, 
  mostrarModalExitoPedido 
} from './modal-dialogs.js';

const WHATSAPP_NUMERO = "543751563056";
const COOLDOWN_PEDIDOS_SEGUNDOS = 20;

// Control de concurrencia para evitar pedidos duplicados
let procesandoPedido = false;

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

/* ==========================================================================
   Carrito persistido en localStorage
   ========================================================================== */

export function obtenerCarrito() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}

export function guardarCarrito(carrito) {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

export function totalPesosCarrito(carrito) {
  return carrito.reduce((acc, item) => acc + Number(item.precio) * Number(item.cantidad), 0);
}

export function actualizarNumerito() {
  const numerito = document.querySelector(".numerito");
  if (!numerito) return;
  numerito.textContent = obtenerCarrito().length;
}

export function agregarAlCarrito(producto, cantidad = 1) {
  if (!producto || cantidad < 1) return;

  const carrito = obtenerCarrito();
  const item = carrito.find(p => String(p.id) === String(producto.id));

  if (item) {
    item.cantidad += cantidad;
    if (producto.categoria && !item.categoria) {
      item.categoria = producto.categoria;
    }
  } else {
    carrito.push({
      id: String(producto.id),
      nombre: producto.nombre,
      precio: Number(producto.precio),
      categoria: producto.categoria || "",
      imagen: producto.imagen,
      cantidad,
    });
  }

  guardarCarrito(carrito);
  actualizarNumerito();

  // Animación visual en el botón de carrito
  const btnCarrito = document.querySelector(".boton-carrito");
  if (btnCarrito) {
    btnCarrito.classList.add("destacado-pulse");
    setTimeout(() => btnCarrito.classList.remove("destacado-pulse"), 800);
  }
}

export function eliminarDelCarrito(id) {
  const carrito = obtenerCarrito().filter(p => String(p.id) !== String(id));
  guardarCarrito(carrito);
  renderizarCarrito();
}

/* ==========================================================================
   Renderizado del Carrito
   ========================================================================== */

export function renderizarCarrito() {
  const carrito = obtenerCarrito();
  const vacioMsg = document.querySelector(".carrito-vacio");
  const listaProductos = document.querySelector(".carrito-productos");
  const acciones = document.querySelector(".carrito-acciones");
  const moduloEnvio = document.getElementById("modulo-envio-fletes");
  const totalEl = document.querySelector(".carrito-total");
  const envioEl = document.querySelector(".carrito-envio");

  if (!listaProductos) return;

  listaProductos.innerHTML = "";

  if (carrito.length === 0) {
    if (vacioMsg) vacioMsg.style.display = "block";
    listaProductos.style.display = "none";
    if (acciones) acciones.style.display = "none";
    if (moduloEnvio) moduloEnvio.style.display = "none";
    if (totalEl) totalEl.textContent = "";
    if (envioEl) envioEl.textContent = "";
    actualizarNumerito();
    return;
  }

  if (vacioMsg) vacioMsg.style.display = "none";
  listaProductos.style.display = "flex";
  if (acciones) acciones.style.display = "flex";
  if (moduloEnvio) moduloEnvio.style.display = "block";

  carrito.forEach(item => {
    const subtotal = Number(item.precio) * Number(item.cantidad);
    const div = document.createElement("div");
    div.classList.add("carrito-producto");
    div.innerHTML = `
      <img src="${item.imagen}" alt="${escaparHtml(item.nombre)}" onerror="this.src='fotos/favicon-32.png'">
      <div class="carrito-producto-titulo">
        <small>Producto</small>
        <h3>${escaparHtml(item.nombre)}</h3>
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
    boton.addEventListener("click", () => eliminarDelCarrito(boton.dataset.id));
  });

  // Ejecuta la validación en tiempo real del módulo de fletes
  ejecutarValidacionEnvioUI();
  actualizarNumerito();
}

export function inicializarCarrito() {
  const contenedorCarrito = document.querySelector(".contenedor-carrito");
  if (!contenedorCarrito) return;

  configurarModuloEnvios();
  renderizarCarrito();

  document.querySelector(".carrito-acciones-vaciar")?.addEventListener("click", async () => {
    if (obtenerCarrito().length === 0) return;
    const confirmado = await mostrarConfirmacionModal({
      titulo: "Vaciar carrito",
      mensaje: "¿Estás seguro de que querés vaciar todos los productos que agregaste al carrito?",
      icono: "bi-cart-x",
      textoConfirmar: "Vaciar carrito",
      textoCancelar: "Conservar productos",
      esPeligro: true
    });
    if (confirmado) {
      guardarCarrito([]);
      renderizarCarrito();
    }
  });

  // Botón principal de confirmar pedido
  const botonFinalizar = document.querySelector(".carrito-acciones-derecha button");
  if (botonFinalizar) {
    botonFinalizar.innerHTML = `<i class="bi bi-check-circle"></i> Confirmar pedido`;
    botonFinalizar.classList.add("boton-accion-naranja");
    botonFinalizar.addEventListener("click", procesarCompraPublica);
  }
}

/* ==========================================================================
   Checkout seguro mediante Cloud Function (crearPedido)
   ========================================================================== */

export async function procesarCompraPublica() {
  // Evitar ejecuciones simultáneas o dobles clics
  if (procesandoPedido) return;

  // Protección anti-spam / Rate-limit local en el cliente
  const ultimoPedidoTimestamp = Number(localStorage.getItem("alfa_ultimo_pedido_ts") || 0);
  const ahora = Date.now();
  const segundosTranscurridos = Math.floor((ahora - ultimoPedidoTimestamp) / 1000);

  if (segundosTranscurridos < COOLDOWN_PEDIDOS_SEGUNDOS) {
    const restantes = COOLDOWN_PEDIDOS_SEGUNDOS - segundosTranscurridos;
    await mostrarAlertaModal({
      titulo: "POR FAVOR AGUARDÁ UN MOMENTO",
      mensaje: `Registraste un pedido hace instantes.<br><br>Para evitar envíos duplicados o saturación, por favor esperá <strong>${restantes} segundo${restantes !== 1 ? 's' : ''}</strong> antes de confirmar otro pedido.`,
      icono: "bi-hourglass-split",
      tipo: "advertencia"
    });
    return;
  }

  const carrito = obtenerCarrito();
  if (carrito.length === 0) {
    await mostrarAlertaModal({
      titulo: "Carrito vacío",
      mensaje: "Tu carrito no tiene productos todavía. Agregá materiales desde el catálogo para iniciar una compra.",
      icono: "bi-cart-x",
      tipo: "info"
    });
    return;
  }

  // Pre-verificación transparente de precios con /productos (aviso informativo de catálogo para UX)
  let preciosModificadosEnCatalogo = false;
  try {
    for (const item of carrito) {
      if (item.id) {
        const prodDocRef = doc(db, "productos", String(item.id));
        const prodDocSnap = await getDoc(prodDocRef);
        if (prodDocSnap.exists()) {
          const dataDoc = prodDocSnap.data();
          const precioActual = Number(dataDoc?.precio || 0);
          if (dataDoc?.categoria && item.categoria !== dataDoc.categoria) {
            item.categoria = dataDoc.categoria;
          }
          if (Number(item.precio) !== precioActual) {
            item.precio = precioActual;
            preciosModificadosEnCatalogo = true;
          }
        }
      }
    }
    if (preciosModificadosEnCatalogo) {
      guardarCarrito(carrito);
      renderizarCarrito();
      await mostrarAlertaModal({
        titulo: "PRECIOS ACTUALIZADOS",
        mensaje: "Los precios de algunos productos se actualizaron con el catálogo oficial en tiempo real. Tu resumen y total fueron ajustados.",
        icono: "bi-info-circle-fill",
        tipo: "info"
      });
      return;
    }
  } catch (errCatalogo) {
    console.warn("[CLIENTE] Advertencia al consultar precios de catálogo:", errCatalogo);
  }

  // 1. Validación de campo obligatorio "Barrio y Calle"
  const inputBarrioCalle = document.getElementById("input-barrio-calle");
  const inputDetallesRef = document.getElementById("input-detalles-referencia");
  const errorBarrioCalle = document.getElementById("error-barrio-calle");

  const barrioCalle = inputBarrioCalle?.value.trim() || "";
  const detallesRef = inputDetallesRef?.value.trim() || "";

  if (!barrioCalle) {
    if (errorBarrioCalle) errorBarrioCalle.style.display = "flex";
    if (inputBarrioCalle) {
      inputBarrioCalle.style.borderColor = "#b3261e";
      inputBarrioCalle.style.backgroundColor = "#fff8f8";
      inputBarrioCalle.focus();
      inputBarrioCalle.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  // 2. Validación de reglas de flete y montos mínimos de zona
  const calculo = ejecutarValidacionEnvioUI();
  if (!calculo || !calculo.valido) {
    await mostrarAlertaModal({
      titulo: "Requisitos de envío no alcanzados",
      mensaje: calculo?.error || "El pedido no cumple con las condiciones mínimas de entrega para la zona seleccionada.",
      icono: "bi-exclamation-triangle-fill",
      tipo: "advertencia"
    });
    return;
  }

  // Construir dirección descriptiva pre-poblada con zona y referencias desde el primer input (Barrio y Calle)
  const deptoActualInfo = configEnvios.departamentos[envioSeleccion.deptoOtro] || obtenerInfoDepartamento(envioSeleccion.deptoOtro);
  const destinoTexto = envioSeleccion.tipoDestino === "eldorado"
    ? `Eldorado (${configEnvios.zonasEldorado[envioSeleccion.zonaEldorado]?.nombre || "Km 1 a 6"})`
    : `${envioSeleccion.localidadOtro} (${deptoActualInfo?.nombre || envioSeleccion.deptoOtro || "Misiones"})`;

  const direccionCompleta = detallesRef
    ? `${barrioCalle}, ${destinoTexto} — Ref: ${detallesRef}`
    : `${barrioCalle}, ${destinoTexto}`;

  // 3. Modal interactivo para datos de contacto (Nombre y Teléfono) sin duplicar dirección
  const datosCliente = await mostrarModalFormularioPedido({
    resumenTotal: formatearPrecio(calculo.total),
    cantidadItems: carrito.length
  });

  // Si canceló o falta algún dato obligatorio, detenemos inmediatamente
  if (!datosCliente || !datosCliente.nombre || !datosCliente.telefono) {
    return;
  }

  const { nombre: nombreCliente, telefono: telefonoCliente } = datosCliente;

  const botonFinalizar = document.querySelector(".carrito-acciones-derecha button");
  if (botonFinalizar) {
    botonFinalizar.disabled = true;
    botonFinalizar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Validando con el catálogo...`;
  }

  procesandoPedido = true;

  try {
    // 4. Preparar payload seguro: Solo IDs, cantidades, datos de entrega y totalReportadoPorCliente para auditoría
    const payloadCrearPedido = {
      items: carrito.map(item => ({
        id: String(item.id),
        cantidad: Number(item.cantidad || 1)
      })),
      tipoDestino: envioSeleccion.tipoDestino,
      departamento: envioSeleccion.tipoDestino === "eldorado" ? "Eldorado" : (deptoActualInfo?.nombre || envioSeleccion.deptoOtro || "Misiones"),
      localidad: envioSeleccion.tipoDestino === "eldorado" ? (configEnvios.zonasEldorado[envioSeleccion.zonaEldorado]?.nombre || "Eldorado") : envioSeleccion.localidadOtro,
      zonaEnvio: envioSeleccion.tipoDestino === "eldorado" ? (configEnvios.zonasEldorado[envioSeleccion.zonaEldorado]?.nombre || "Km 1 a 6") : `${deptoActualInfo?.nombre || envioSeleccion.deptoOtro} — ${envioSeleccion.localidadOtro}`,
      clienteNombre: nombreCliente,
      clienteTelefono: telefonoCliente,
      clienteDireccion: direccionCompleta,
      referencia: detallesRef,
      totalReportadoPorCliente: Number(calculo.total || 0)
    };

    console.log("[CLIENTE] Enviando petición a Netlify Function crear-pedido:", payloadCrearPedido);

    const respuestaHttp = await fetch('/.netlify/functions/crear-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadCrearPedido)
    });

    const datosRespuesta = await respuestaHttp.json().catch(() => ({}));

    if (!respuestaHttp.ok || !datosRespuesta.success) {
      const errorFetch = new Error(datosRespuesta.error || "No se pudo procesar el pedido en el servidor.");
      errorFetch.code = datosRespuesta.code || "INTERNAL";
      throw errorFetch;
    }

    const codigoPedido = datosRespuesta.codigoPedido || "PEDIDO CONFIRMADO";

    // 5. Limpiar el carrito y registrar marca de tiempo anti-spam tras confirmación exitosa
    localStorage.setItem("alfa_ultimo_pedido_ts", String(Date.now()));
    guardarCarrito([]);
    renderizarCarrito();

    // Resetear campos de dirección
    if (inputBarrioCalle) inputBarrioCalle.value = "";
    if (inputDetallesRef) inputDetallesRef.value = "";

    // 6. Preparar enlace de consulta a WhatsApp (canal de consulta, NO para registrar pedido)
    const mensajeConsulta = `Hola Alfa Materiales! Acabo de registrar mi ${codigoPedido} a nombre de ${nombreCliente} con entrega en ${direccionCompleta}.`;
    const urlWhatsApp = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensajeConsulta)}`;

    // 7. Mostrar pantalla de éxito al cliente
    await mostrarModalExitoPedido({
      codigoPedido: codigoPedido,
      urlWhatsApp: urlWhatsApp,
      envioACoordinar: envioSeleccion.tipoDestino === "otro"
    });

  } catch (error) {
    console.error("Error al registrar pedido mediante Netlify Function:", error);
    let errorTitulo = "NO SE PUDO REGISTRAR EL PEDIDO";
    let errorMsg = error?.message || String(error);

    if (error?.code === "RATE_LIMIT" || errorMsg.includes("pedidos recientes")) {
      errorTitulo = "LÍMITE DE PEDIDOS ALCANZADO";
      errorMsg = "Ya registramos pedidos recientes con este número de teléfono. Para evitar envíos duplicados o saturación, por favor esperá unos minutos o contactanos directamente por WhatsApp.";
    } else if (error?.code === "NOT_FOUND" || errorMsg.includes("no existe en el catálogo")) {
      errorTitulo = "CATÁLOGO DESACTUALIZADO";
      errorMsg = "Uno o más productos seleccionados ya no están disponibles en el catálogo. Por favor actualizá la página y revisá tu carrito.";
    }

    await mostrarAlertaModal({
      titulo: errorTitulo,
      mensaje: `
        <div style="font-size: 0.95rem; color: #374151; margin-bottom: 8px;">
          ${escaparHtml(errorMsg)}
        </div>
      `,
      icono: "bi-exclamation-triangle-fill",
      tipo: "error"
    });
  } finally {
    procesandoPedido = false;
    if (botonFinalizar) {
      botonFinalizar.disabled = false;
      botonFinalizar.innerHTML = `<i class="bi bi-check-circle"></i> Confirmar pedido`;
    }
  }
}

