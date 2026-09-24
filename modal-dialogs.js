// Alfa Materiales - Módulo de Modales Personalizados (Reemplazo de alert, confirm y prompt)

/**
 * Muestra un modal de alerta estilizado (reemplazo de alert)
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título del diálogo
 * @param {string} opciones.mensaje - Mensaje a mostrar
 * @param {string} [opciones.icono="bi-info-circle"] - Clase de icono Bootstrap Icons
 * @param {string} [opciones.textoBoton="Entendido"] - Texto del botón de confirmación
 * @param {string} [opciones.tipo="info"] - "info", "error", "advertencia", "exito"
 * @returns {Promise<void>}
 */
export function mostrarAlertaModal({
  titulo = "Atención",
  mensaje = "",
  icono = "bi-info-circle",
  textoBoton = "Entendido",
  tipo = "info"
} = {}) {
  return new Promise((resolve) => {
    const colorIcono = {
      error: "#b3261e",
      advertencia: "#e67700",
      exito: "#2b8a3e",
      info: "#e76f51"
    }[tipo] || "#e76f51";

    const modalOverlay = document.createElement("div");
    modalOverlay.className = "admin-modal";
    modalOverlay.style.zIndex = "10000";

    modalOverlay.innerHTML = `
      <div class="modal-contenido" style="max-width: 460px;">
        <div class="modal-cabecera">
          <h3><i class="bi ${icono}" style="color: ${colorIcono};"></i> ${escaparHtml(titulo)}</h3>
          <button type="button" class="modal-cerrar" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-cuerpo">
          <p class="modal-dialogo-texto">${escaparHtml(mensaje)}</p>
          <div class="modal-pie">
            <button type="button" class="boton-guardar btn-aceptar-alerta">
              ${escaparHtml(textoBoton)}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const cerrar = () => {
      document.removeEventListener("keydown", onKeyDown);
      modalOverlay.remove();
      resolve();
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        cerrar();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    modalOverlay.querySelector(".modal-cerrar")?.addEventListener("click", cerrar);
    modalOverlay.querySelector(".btn-aceptar-alerta")?.addEventListener("click", cerrar);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) cerrar();
    });

    // Foco automático en el botón
    setTimeout(() => {
      modalOverlay.querySelector(".btn-aceptar-alerta")?.focus();
    }, 50);
  });
}

/**
 * Muestra un modal de confirmación estilizado (reemplazo de confirm)
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título del diálogo
 * @param {string} opciones.mensaje - Mensaje o pregunta
 * @param {string} [opciones.icono="bi-question-circle"] - Clase de icono
 * @param {string} [opciones.textoConfirmar="Confirmar"] - Texto del botón positivo
 * @param {string} [opciones.textoCancelar="Cancelar"] - Texto del botón de cancelar
 * @param {boolean} [opciones.esPeligro=false] - Si es una acción destructiva (rojo)
 * @returns {Promise<boolean>} - true si confirma, false si cancela
 */
export function mostrarConfirmacionModal({
  titulo = "Confirmar acción",
  mensaje = "¿Deseás continuar?",
  icono = "bi-question-circle",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  esPeligro = false
} = {}) {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "admin-modal";
    modalOverlay.style.zIndex = "10000";

    const claseBotonConfirmar = esPeligro ? "boton-peligro" : "boton-guardar";
    const colorIcono = esPeligro ? "var(--color-rojo)" : "var(--color-naranja)";

    modalOverlay.innerHTML = `
      <div class="modal-contenido" style="max-width: 480px;">
        <div class="modal-cabecera">
          <h3><i class="bi ${icono}" style="color: ${colorIcono};"></i> ${escaparHtml(titulo)}</h3>
          <button type="button" class="modal-cerrar" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-cuerpo">
          <p class="modal-dialogo-texto">${escaparHtml(mensaje)}</p>
          <div class="modal-pie">
            <button type="button" class="boton-cancelar btn-cancelar-conf">
              ${escaparHtml(textoCancelar)}
            </button>
            <button type="button" class="${claseBotonConfirmar} btn-confirmar-conf">
              ${escaparHtml(textoConfirmar)}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const terminar = (resultado) => {
      document.removeEventListener("keydown", onKeyDown);
      modalOverlay.remove();
      resolve(resultado);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        terminar(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    modalOverlay.querySelector(".modal-cerrar")?.addEventListener("click", () => terminar(false));
    modalOverlay.querySelector(".btn-cancelar-conf")?.addEventListener("click", () => terminar(false));
    modalOverlay.querySelector(".btn-confirmar-conf")?.addEventListener("click", () => terminar(true));
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) terminar(false);
    });

    setTimeout(() => {
      if (esPeligro) {
        modalOverlay.querySelector(".btn-cancelar-conf")?.focus();
      } else {
        modalOverlay.querySelector(".btn-confirmar-conf")?.focus();
      }
    }, 50);
  });
}

/**
 * Muestra el modal con formulario para completar datos del cliente al procesar compra pública (reemplazo de los 3 prompts)
 * @param {Object} opciones
 * @param {string} opciones.resumenTotal - Total formateado
 * @param {number} opciones.cantidadItems - Cantidad de tipos de productos
 * @returns {Promise<{ nombre: string, telefono: string, direccion: string } | null>}
 */
export function mostrarModalFormularioPedido({ resumenTotal = "$0", cantidadItems = 0 } = {}) {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "admin-modal";
    modalOverlay.style.zIndex = "10000";

    modalOverlay.innerHTML = `
      <div class="modal-contenido" style="max-width: 520px;">
        <div class="modal-cabecera">
          <h3><i class="bi bi-person-lines-fill" style="color: var(--color-naranja);"></i> Datos de Entrega</h3>
          <button type="button" class="modal-cerrar" aria-label="Cerrar">&times;</button>
        </div>
        <form id="form-pedido-cliente" class="modal-cuerpo">
          <p class="modal-dialogo-texto" style="font-size: 0.95rem; color: var(--color-gris);">
            Completá tus datos de contacto para coordinar la entrega y facturación en Eldorado (${cantidadItems} ítems — <strong>${escaparHtml(resumenTotal)}</strong>):
          </p>

          <div class="form-grupo">
            <label for="pedido-cliente-nombre">
              <i class="bi bi-person"></i> Nombre o Empresa <small style="color: var(--color-gris); font-weight: normal;">(opcional)</small>
            </label>
            <input 
              type="text" 
              id="pedido-cliente-nombre" 
              placeholder="Ej: Juan Pérez / Constructora del Norte" 
              maxlength="100"
              autocomplete="name"
            >
          </div>

          <div class="form-grupo">
            <label for="pedido-cliente-telefono">
              <i class="bi bi-telephone"></i> Teléfono de contacto <small style="color: var(--color-gris); font-weight: normal;">(opcional)</small>
            </label>
            <input 
              type="tel" 
              id="pedido-cliente-telefono" 
              placeholder="Ej: 3751 45-6789" 
              maxlength="50"
              autocomplete="tel"
            >
          </div>

          <div class="form-grupo">
            <label for="pedido-cliente-direccion">
              <i class="bi bi-geo-alt"></i> Dirección de entrega en Eldorado <small style="color: var(--color-gris); font-weight: normal;">(opcional)</small>
            </label>
            <input 
              type="text" 
              id="pedido-cliente-direccion" 
              placeholder="Ej: Av. San Martín Km 9, Barrio Iprodha" 
              maxlength="200"
              autocomplete="street-address"
            >
          </div>

          <div class="modal-pie">
            <button type="button" class="boton-cancelar btn-cancelar-pedido">
              Cancelar
            </button>
            <button type="submit" class="boton-guardar btn-confirmar-pedido">
              <i class="bi bi-check2-circle"></i> Continuar Pedido
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const terminar = (resultado) => {
      document.removeEventListener("keydown", onKeyDown);
      modalOverlay.remove();
      resolve(resultado);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        terminar(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const form = modalOverlay.querySelector("#form-pedido-cliente");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = document.getElementById("pedido-cliente-nombre")?.value.trim() || "";
      const telefono = document.getElementById("pedido-cliente-telefono")?.value.trim() || "";
      const direccion = document.getElementById("pedido-cliente-direccion")?.value.trim() || "";
      terminar({ nombre, telefono, direccion });
    });

    modalOverlay.querySelector(".modal-cerrar")?.addEventListener("click", () => terminar(null));
    modalOverlay.querySelector(".btn-cancelar-pedido")?.addEventListener("click", () => terminar(null));
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) terminar(null);
    });

    setTimeout(() => {
      document.getElementById("pedido-cliente-nombre")?.focus();
    }, 60);
  });
}

/**
 * Muestra el modal de éxito de registro de pedido con acceso directo a WhatsApp (reemplazo de alert de éxito)
 * @param {Object} opciones
 * @param {string} opciones.pedidoId - ID de Firestore del pedido
 * @param {string} opciones.urlWhatsApp - Enlace con texto armado hacia WhatsApp
 * @returns {Promise<void>}
 */
export function mostrarModalExitoPedido({ pedidoId = "", urlWhatsApp = "" } = {}) {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "admin-modal";
    modalOverlay.style.zIndex = "10000";

    const refCorta = pedidoId ? `#${pedidoId.slice(0, 7)}` : "";

    modalOverlay.innerHTML = `
      <div class="modal-contenido" style="max-width: 480px; text-align: center;">
        <div class="modal-cabecera" style="justify-content: center; position: relative;">
          <h3><i class="bi bi-check-circle-fill" style="color: #2b8a3e;"></i> ¡Pedido Registrado!</h3>
          <button type="button" class="modal-cerrar" style="position: absolute; right: 18px;" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-cuerpo" style="align-items: center; text-align: center;">
          <div style="font-size: 3rem; color: #2b8a3e; margin: 4px 0;">
            <i class="bi bi-box2-heart"></i>
          </div>
          <p class="modal-dialogo-texto" style="font-size: 1.05rem;">
            Tu pedido fue registrado con éxito en nuestro sistema con la referencia <strong>${escaparHtml(refCorta)}</strong>.
          </p>
          <p style="font-size: 0.9rem; color: var(--color-gris); margin: 0;">
            Hacé clic en el botón a continuación para enviar el detalle a nuestro WhatsApp y coordinar el horario de envío y la forma de pago:
          </p>

          <div style="width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
            <a 
              href="${urlWhatsApp}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="boton-guardar btn-ir-whatsapp" 
              style="background-color: #25d366; justify-content: center; font-size: 1.05rem; padding: 12px 20px; text-decoration: none;"
            >
              <i class="bi bi-whatsapp" style="font-size: 1.25rem;"></i> Abrir pedido en WhatsApp
            </a>
            <button type="button" class="boton-cancelar btn-cerrar-exito" style="width: 100%;">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const cerrar = () => {
      document.removeEventListener("keydown", onKeyDown);
      modalOverlay.remove();
      resolve();
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    modalOverlay.querySelector(".modal-cerrar")?.addEventListener("click", cerrar);
    modalOverlay.querySelector(".btn-cerrar-exito")?.addEventListener("click", cerrar);
    modalOverlay.querySelector(".btn-ir-whatsapp")?.addEventListener("click", () => {
      // Dejamos un instante para abrir la pestaña y luego cerramos el modal
      setTimeout(cerrar, 300);
    });
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) cerrar();
    });

    setTimeout(() => {
      modalOverlay.querySelector(".btn-ir-whatsapp")?.focus();
    }, 60);
  });
}

function escaparHtml(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
