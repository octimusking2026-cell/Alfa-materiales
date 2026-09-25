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
export function mostrarModalFormularioPedido({ resumenTotal = "$ 0", cantidadItems = 0 } = {}) {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "admin-modal";
    modalOverlay.style.zIndex = "10000";

    modalOverlay.innerHTML = `
      <div class="modal-contenido" style="max-width: 520px;">
        <div class="modal-cabecera">
          <h3><i class="bi bi-person-lines-fill" style="color: var(--color-naranja);"></i> Datos de Contacto</h3>
          <button type="button" class="modal-cerrar" aria-label="Cerrar">&times;</button>
        </div>
        <form id="form-pedido-cliente" class="modal-cuerpo" novalidate>
          <p class="modal-dialogo-texto" style="font-size: 0.95rem; color: var(--color-gris); margin-bottom: 12px;">
            Completá tus datos para registrar tu pedido (${cantidadItems} ítems — <strong>${escaparHtml(resumenTotal)}</strong>):
          </p>

          <div class="form-grupo">
            <label for="pedido-cliente-nombre">
              <i class="bi bi-person"></i> Nombre o Empresa <span style="color: #b3261e; font-weight: 600;">* (obligatorio)</span>
            </label>
            <input 
              type="text" 
              id="pedido-cliente-nombre" 
              placeholder="Ej: Juan Pérez / Constructora del Norte" 
              maxlength="100"
              autocomplete="name"
              required
            >
            <div id="pedido-error-nombre" style="display: none; color: #b3261e; font-size: 0.85rem; font-weight: 500; margin-top: 5px;">
              <i class="bi bi-exclamation-circle-fill"></i> El nombre o empresa es obligatorio.
            </div>
          </div>

          <div class="form-grupo">
            <label for="pedido-cliente-telefono">
              <i class="bi bi-telephone"></i> Teléfono de contacto <span style="color: #b3261e; font-weight: 600;">* (obligatorio)</span>
            </label>
            <input 
              type="tel" 
              id="pedido-cliente-telefono" 
              placeholder="Ej: 3751 45-6789" 
              maxlength="50"
              autocomplete="tel"
              required
            >
            <div id="pedido-error-telefono" style="display: none; color: #b3261e; font-size: 0.85rem; font-weight: 500; margin-top: 5px;">
              <i class="bi bi-exclamation-circle-fill"></i> El teléfono de contacto es obligatorio.
            </div>
          </div>

          <!-- Campo Honeypot invisible para protección anti-spam / bots automáticos -->
          <div style="position: absolute; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;" aria-hidden="true">
            <input type="text" name="sitio_web_empresa_hp" id="pedido-cliente-hp" tabindex="-1" autocomplete="off" value="">
          </div>

          <div class="modal-pie">
            <button type="button" class="boton-cancelar btn-cancelar-pedido">
              Cancelar
            </button>
            <button type="submit" class="boton-guardar btn-confirmar-pedido">
              <i class="bi bi-check2-circle"></i> Confirmar pedido
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const inputNombre = modalOverlay.querySelector("#pedido-cliente-nombre");
    const inputTelefono = modalOverlay.querySelector("#pedido-cliente-telefono");
    const inputHoneypot = modalOverlay.querySelector("#pedido-cliente-hp");

    const errorNombre = modalOverlay.querySelector("#pedido-error-nombre");
    const errorTelefono = modalOverlay.querySelector("#pedido-error-telefono");

    const limpiarEstiloError = (input, errorDiv) => {
      if (errorDiv) errorDiv.style.display = "none";
      if (input) {
        input.style.borderColor = "";
        input.style.backgroundColor = "";
      }
    };

    inputNombre?.addEventListener("input", () => limpiarEstiloError(inputNombre, errorNombre));
    inputTelefono?.addEventListener("input", () => limpiarEstiloError(inputTelefono, errorTelefono));

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

      // Detección de bots por Honeypot
      if (inputHoneypot && inputHoneypot.value.trim().length > 0) {
        console.warn("[Anti-Spam] Bot detectado por honeypot. Cancelando pedido.");
        terminar(null);
        return;
      }

      const nombre = inputNombre?.value.trim() || "";
      const telefono = inputTelefono?.value.trim() || "";

      let hayError = false;
      let primerInvalido = null;

      if (!nombre) {
        hayError = true;
        if (errorNombre) errorNombre.style.display = "block";
        if (inputNombre) {
          inputNombre.style.borderColor = "#b3261e";
          inputNombre.style.backgroundColor = "#fff8f8";
          if (!primerInvalido) primerInvalido = inputNombre;
        }
      }

      if (!telefono) {
        hayError = true;
        if (errorTelefono) errorTelefono.style.display = "block";
        if (inputTelefono) {
          inputTelefono.style.borderColor = "#b3261e";
          inputTelefono.style.backgroundColor = "#fff8f8";
          if (!primerInvalido) primerInvalido = inputTelefono;
        }
      }

      if (hayError) {
        if (primerInvalido) primerInvalido.focus();
        return; // Formulario permanece disponible, no se cierra y no se guarda pedido
      }

      // Bloquear botón para evitar envíos duplicados por doble clic
      const btnConfirmar = modalOverlay.querySelector(".btn-confirmar-pedido");
      if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Procesando...`;
      }

      terminar({ nombre, telefono });
    });

    modalOverlay.querySelector(".modal-cerrar")?.addEventListener("click", () => terminar(null));
    modalOverlay.querySelector(".btn-cancelar-pedido")?.addEventListener("click", () => terminar(null));
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) terminar(null);
    });

    setTimeout(() => {
      inputNombre?.focus();
    }, 60);
  });
}

/**
 * Muestra el modal de confirmación con el mensaje oficial y botón opcional de consulta por WhatsApp
 * @param {Object} opciones
 * @param {string} opciones.codigoPedido - Código visible del pedido (ej: PEDIDO #0001)
 * @param {string} opciones.urlWhatsApp - Enlace de consulta hacia WhatsApp
 * @param {boolean} opciones.envioACoordinar - Si el envío se coordina con el cliente (flujo Otro lugar)
 * @returns {Promise<void>}
 */
export function mostrarModalExitoPedido({ codigoPedido = "PEDIDO #0001", urlWhatsApp = "", envioACoordinar = false } = {}) {
  return new Promise((resolve) => {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "admin-modal";
    modalOverlay.style.zIndex = "10000";

    const textoMensaje = envioACoordinar
      ? "En la brevedad nos vamos a comunicar con vos para coordinar el presupuesto de envío. Cualquier otra consulta, escribinos por WhatsApp."
      : "El envío será realizado lo antes posible. Cualquier otra duda, podés comunicarte con nosotros.";

    modalOverlay.innerHTML = `
      <div class="modal-contenido" style="max-width: 480px; text-align: center;">
        <div class="modal-cabecera" style="justify-content: center; position: relative;">
          <h3><i class="bi bi-check-circle-fill" style="color: #2b8a3e;"></i> ¡Pedido reservado correctamente!</h3>
          <button type="button" class="modal-cerrar" style="position: absolute; right: 18px;" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-cuerpo" style="align-items: center; text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 8px; background-color: #e6f4ea; color: #137333; font-weight: 700; font-size: 1.15rem; padding: 8px 20px; border-radius: 20px; margin: 6px 0 14px 0; font-family: var(--fuente-titulo);">
            <i class="bi bi-receipt"></i> ${escaparHtml(codigoPedido)}
          </div>
          
          <p class="modal-dialogo-texto" style="font-size: 1.05rem; line-height: 1.5; color: var(--color-carbon); margin: 6px 0 16px 0;">
            ${escaparHtml(textoMensaje)}
          </p>

          <div style="width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
            ${urlWhatsApp ? `
              <a 
                href="${urlWhatsApp}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="boton-guardar btn-ir-whatsapp" 
                style="background-color: #25d366; justify-content: center; font-size: 1rem; padding: 12px 20px; text-decoration: none;"
              >
                💬 Consultar por WhatsApp
              </a>
            ` : ""}
            <button type="button" class="boton-cancelar btn-cerrar-exito" style="width: 100%; justify-content: center;">
              Aceptar
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
