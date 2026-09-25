/* ==========================================================================
   Alfa Materiales Eldorado — carrito.js
   Gestión del carrito en localStorage, renderizado y checkout en Firestore
   ========================================================================== */

import { 
  db, 
  firebaseConfig 
} from './firebase-init.js';

import { 
  collection, 
  doc, 
  addDoc, 
  runTransaction, 
  serverTimestamp 
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
  } else {
    carrito.push({
      id: String(producto.id),
      nombre: producto.nombre,
      precio: Number(producto.precio),
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
   Checkout público y guardado en Firestore (/pedidos)
   ========================================================================== */

// Obtiene el número correlativo atómico para el pedido con fallback anti-colisión
async function obtenerSiguienteNumeroPedido() {
  const contadorRef = doc(db, "contadores", "pedidos");
  
  // Intento 1 y 2 con transacción atómica en Firestore
  for (let intento = 0; intento < 2; intento++) {
    try {
      const nuevoNumero = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(contadorRef);
        let ultimo = 0;
        if (docSnap.exists()) {
          ultimo = Number(docSnap.data().ultimoNumero || 0);
        }
        const siguiente = ultimo + 1;
        transaction.set(contadorRef, { ultimoNumero: siguiente, updatedAt: serverTimestamp() }, { merge: true });
        return siguiente;
      });
      localStorage.setItem("alfa_ultimo_pedido_num", String(nuevoNumero));
      return nuevoNumero;
    } catch (err) {
      if (intento === 0) {
        await new Promise(res => setTimeout(res, 400));
      } else {
        console.warn("Aviso al obtener contador atómico en Firestore tras reintento, usando identificador único de resguardo:", err);
      }
    }
  }

  // Fallback anti-colisiones: Genera un número único derivado de la marca temporal (timestamp) y un factor aleatorio
  // Evita que dos clientes desconectados o con problemas de red coincidan en el mismo número secuencial (ej: #0001)
  const fallbackUnico = Math.floor((Date.now() % 900000) + (Math.random() * 90000) + 10000);
  localStorage.setItem("alfa_ultimo_pedido_num", String(fallbackUnico));
  return fallbackUnico;
}

export async function procesarCompraPublica() {
  // Evitar ejecuciones simultáneas o dobles clics
  if (procesandoPedido) return;

  // Protección anti-spam / Rate-limit por dispositivo
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
    botonFinalizar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Procesando pedido...`;
  }

  procesandoPedido = true;

  try {
    // 1. Obtener número correlativo de pedido (PEDIDO #0001, PEDIDO #0002, etc.)
    const numeroPedido = await obtenerSiguienteNumeroPedido();
    const codigoPedido = formatearCodigoPedido(numeroPedido);

    // 2. Congelar precios y productos tal como estaban al momento de la compra
    const itemsCongelados = carrito.map(item => {
      const p = Number(item.precio || 0);
      const c = Number(item.cantidad || 1);
      return {
        id: String(item.id),
        nombre: String(item.nombre || "").slice(0, 150),
        precio: p,
        cantidad: c,
        subtotal: p * c
      };
    });

    // 3. Formulario y datos estructurados de entrega (tomados del primer input de dirección: barrioCalle)
    const formularioEnvio = {
      tipoDestino: envioSeleccion.tipoDestino,
      departamento: envioSeleccion.tipoDestino === "eldorado" ? "Eldorado" : (deptoActualInfo?.nombre || envioSeleccion.deptoOtro || "Misiones"),
      localidad: envioSeleccion.tipoDestino === "eldorado" ? (configEnvios.zonasEldorado[envioSeleccion.zonaEldorado]?.nombre || "Eldorado") : envioSeleccion.localidadOtro,
      direccion: barrioCalle,
      referencia: detallesRef
    };

    // 4. Construir objeto oficial del pedido para Firestore
    const datosPedido = construirObjetoPedidoFirestore({
      items: itemsCongelados,
      cliente: {
        nombre: nombreCliente,
        telefono: telefonoCliente,
        direccion: direccionCompleta
      },
      calculoEnvio: calculo,
      formularioEnvio,
      numeroPedido,
      codigoPedido,
      serverTimestamp
    });

    console.log("[CLIENTE] Enviando pedido a Firestore colección /pedidos:", datosPedido);

    let docRef;
    try {
      docRef = await addDoc(collection(db, "pedidos"), datosPedido);
      console.log("[CLIENTE] Pedido confirmado en Firestore con ID:", docRef.id);
    } catch (errFirestore) {
      console.error("[CLIENTE] Error técnico al escribir en Firestore (/pedidos):", errFirestore);
      
      const errorMsgTecnico = errFirestore?.message || String(errFirestore);
      const esServiceDisabled = errorMsgTecnico.includes("Cloud Firestore API has not been used") || 
                                errorMsgTecnico.includes("SERVICE_DISABLED") ||
                                errFirestore?.code === "permission-denied";

      let explicacionAdicional = "";
      if (esServiceDisabled) {
        explicacionAdicional = `
          <div style="margin-top: 12px; padding: 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; text-align: left; font-size: 0.88rem; color: #991b1b; line-height: 1.4;">
            <strong>Causa en Firebase:</strong> La base de datos Cloud Firestore no está habilitada o creada en el proyecto <em>${firebaseConfig?.projectId || 'alfa-materiales'}</em>.<br><br>
            <strong>Solución requerida:</strong> Ingresá a la consola de Firebase en tu proyecto, sección <strong>Firestore Database</strong> y hacé clic en <strong>"Crear base de datos"</strong>.
          </div>
        `;
      }

      await mostrarAlertaModal({
        titulo: "NO SE PUDO REGISTRAR EL PEDIDO",
        mensaje: `
          Ocurrió un error de comunicación con Firestore y el pedido NO pudo ser guardado.
          <br><br>
          <div style="font-family: monospace; font-size: 0.85rem; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; word-break: break-all; color: #374151; text-align: left;">
            Error: ${escaparHtml(errorMsgTecnico)}
          </div>
          ${explicacionAdicional}
        `,
        icono: "bi-x-octagon-fill",
        tipo: "error"
      });

      // No se guarda el pedido, no se limpia el carrito y no se muestra éxito
      return;
    }

    // 5. Limpiar el carrito y registrar marca de tiempo anti-spam ÚNICAMENTE después de confirmar que Firestore guardó el documento
    localStorage.setItem("alfa_ultimo_pedido_ts", String(Date.now()));
    guardarCarrito([]);
    renderizarCarrito();

    // Resetear campos de dirección
    if (inputBarrioCalle) inputBarrioCalle.value = "";
    if (inputDetallesRef) inputDetallesRef.value = "";

    // 6. Preparar enlace de consulta a WhatsApp (canal de consulta, NO para registrar pedido)
    const mensajeConsulta = `Hola Alfa Materiales! Acabo de registrar mi ${codigoPedido} a nombre de ${nombreCliente} con entrega en ${datosPedido.clienteDireccion}.`;
    const urlWhatsApp = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensajeConsulta)}`;

    // 7. Mostrar pantalla de éxito al cliente solo habiendo confirmado la escritura
    await mostrarModalExitoPedido({
      codigoPedido: codigoPedido,
      urlWhatsApp: urlWhatsApp,
      envioACoordinar: envioSeleccion.tipoDestino === "otro"
    });

  } catch (error) {
    console.error("Error inesperado al procesar pedido:", error);
    await mostrarAlertaModal({
      titulo: "NO SE PUDO REGISTRAR EL PEDIDO",
      mensaje: `Ocurrió un inconveniente inesperado: ${escaparHtml(error?.message || String(error))}`,
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
