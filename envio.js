/* ==========================================================================
   Alfa Materiales Eldorado — envio.js
   Módulo interactivo de selección de destino, fletes y cálculo de envíos
   ========================================================================== */

import { 
  configEnvios, 
  obtenerInfoDepartamento, 
  validarYCalcularEnvio, 
  formatearPrecio 
} from './pedidos-utils.js';

import { obtenerCarrito } from './carrito.js';

// Estado reactivo del destino seleccionado por el cliente
export let envioSeleccion = {
  tipoDestino: "eldorado",
  zonaEldorado: "km1_6",
  deptoOtro: "Eldorado",
  localidadOtro: "Colonia Victoria"
};

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

/**
 * Configura los eventos del selector principal (toggle), menús en cascada e inputs
 */
export function configurarModuloEnvios() {
  const moduloEnvio = document.getElementById("modulo-envio-fletes");
  if (!moduloEnvio) return;

  const btnToggleEldorado = document.getElementById("toggle-eldorado");
  const btnToggleOtro = document.getElementById("toggle-otro");
  const grupoEldorado = document.getElementById("grupo-zona-eldorado");
  const grupoMisiones = document.getElementById("grupo-zona-misiones");
  const selectZonaEldorado = document.getElementById("select-zona-eldorado");
  const selectDepto = document.getElementById("select-depto-misiones");
  const selectLocalidad = document.getElementById("select-localidad-misiones");
  const inputBarrioCalle = document.getElementById("input-barrio-calle");
  const errorBarrioCalle = document.getElementById("error-barrio-calle");

  // Poblar desplegable 1 (Departamentos / Zonas de Misiones) si aún no tiene opciones
  if (selectDepto && selectDepto.options.length === 0) {
    Object.entries(configEnvios.departamentos).forEach(([clave, info]) => {
      const opt = document.createElement("option");
      opt.value = clave;
      opt.textContent = info.nombre;
      selectDepto.appendChild(opt);
    });
  }

  // Función interna para poblar el desplegable 2 (Ciudades / Localidades) según depto
  function actualizarLocalidades(deptoClave) {
    if (!selectLocalidad) return;
    selectLocalidad.innerHTML = "";
    const deptoInfo = configEnvios.departamentos[deptoClave] || obtenerInfoDepartamento(deptoClave);
    if (deptoInfo && Array.isArray(deptoInfo.localidades)) {
      deptoInfo.localidades.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc;
        opt.textContent = loc;
        selectLocalidad.appendChild(opt);
      });
      envioSeleccion.localidadOtro = deptoInfo.localidades[0] || "";
    }
  }

  // Inicializar ciudades del primer departamento
  const primerDepto = selectDepto?.value || Object.keys(configEnvios.departamentos)[0];
  if (primerDepto) {
    envioSeleccion.deptoOtro = primerDepto;
    actualizarLocalidades(primerDepto);
  }

  // 1. Toggle: "📍 Soy de Eldorado"
  btnToggleEldorado?.addEventListener("click", () => {
    btnToggleEldorado.classList.add("activo");
    btnToggleOtro?.classList.remove("activo");
    if (grupoEldorado) grupoEldorado.style.display = "block";
    if (grupoMisiones) grupoMisiones.style.display = "none";
    envioSeleccion.tipoDestino = "eldorado";
    ejecutarValidacionEnvioUI();
  });

  // 2. Toggle: "🚚 Otro lugar (Misiones)"
  btnToggleOtro?.addEventListener("click", () => {
    btnToggleOtro.classList.add("activo");
    btnToggleEldorado?.classList.remove("activo");
    if (grupoEldorado) grupoEldorado.style.display = "none";
    if (grupoMisiones) grupoMisiones.style.display = "block";
    envioSeleccion.tipoDestino = "otro";
    envioSeleccion.deptoOtro = selectDepto?.value || Object.keys(configEnvios.departamentos)[0];
    envioSeleccion.localidadOtro = selectLocalidad?.value || "";
    ejecutarValidacionEnvioUI();
  });

  // Evento: Cambio en zona urbana de Eldorado
  selectZonaEldorado?.addEventListener("change", (e) => {
    envioSeleccion.zonaEldorado = e.target.value;
    ejecutarValidacionEnvioUI();
  });

  // Evento: Cambio en Departamento de Misiones (actualiza localidades dinámicamente)
  selectDepto?.addEventListener("change", (e) => {
    envioSeleccion.deptoOtro = e.target.value;
    actualizarLocalidades(e.target.value);
    ejecutarValidacionEnvioUI();
  });

  // Evento: Cambio en Localidad de Misiones
  selectLocalidad?.addEventListener("change", (e) => {
    envioSeleccion.localidadOtro = e.target.value;
    ejecutarValidacionEnvioUI();
  });

  // Evento: Limpiar estilo de error al escribir en Barrio y Calle
  inputBarrioCalle?.addEventListener("input", () => {
    if (errorBarrioCalle) errorBarrioCalle.style.display = "none";
    inputBarrioCalle.style.borderColor = "";
    inputBarrioCalle.style.backgroundColor = "";
  });
}

/**
 * Ejecuta validarYCalcularEnvio en tiempo real:
 * - Actualiza subtotales, costo de envío y total general
 * - Muestra u oculta la alerta visual explícita
 * - Habilita o deshabilita el botón de Confirmar Pedido según cumplimiento de reglas
 * @returns {Object|null} Resultado de la validación
 */
export function ejecutarValidacionEnvioUI() {
  const carrito = obtenerCarrito();
  const moduloEnvio = document.getElementById("modulo-envio-fletes");
  const alertaDiv = document.getElementById("envio-alerta");
  const alertaMensaje = document.getElementById("envio-alerta-mensaje");
  const totalEl = document.querySelector(".carrito-total");
  const envioEl = document.querySelector(".carrito-envio");
  const btnConfirmar = document.querySelector(".carrito-acciones-derecha button");

  if (!moduloEnvio) return null;

  if (carrito.length === 0) {
    moduloEnvio.style.display = "none";
    if (btnConfirmar) btnConfirmar.disabled = true;
    return null;
  }

  // Asegurar visibilidad del módulo si hay productos
  moduloEnvio.style.display = "block";

  const subtotal = carrito.reduce((acc, item) => {
    return acc + Number(item.precio || 0) * Number(item.cantidad || 1);
  }, 0);

  // Flujo especial "Otro lugar (Misiones)": Coordinación directa de presupuesto de envío
  if (envioSeleccion.tipoDestino === "otro") {
    const deptoActualInfo = configEnvios.departamentos[envioSeleccion.deptoOtro] || obtenerInfoDepartamento(envioSeleccion.deptoOtro);
    const loc = envioSeleccion.localidadOtro || deptoActualInfo?.localidades?.[0] || "";
    const depto = deptoActualInfo?.nombre || envioSeleccion.deptoOtro || "Misiones";
    const mensajeCoordinar = "🚚 Nos vamos a comunicar con vos a la brevedad para coordinar el presupuesto de envío según tu localidad.";

    if (alertaDiv) {
      alertaDiv.style.display = "flex";
      alertaDiv.classList.remove("alerta-peligro");
      alertaDiv.classList.add("alerta-info");
    }
    if (alertaMensaje) {
      alertaMensaje.innerHTML = `<i class="bi bi-info-circle-fill" style="margin-right: 6px; color: #0284c7;"></i> ${mensajeCoordinar}`;
    }

    if (envioEl) {
      envioEl.textContent = mensajeCoordinar;
      envioEl.className = "carrito-envio info";
    }

    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.classList.remove("boton-deshabilitado");
    }

    if (totalEl) {
      totalEl.innerHTML = `
        <strong>Total: ${formatearPrecio(subtotal)}</strong>
        <span style="font-size: 0.85rem; color: var(--color-gris); font-weight: normal; margin-left: 6px;">(el envío se coordina aparte)</span>
      `;
    }

    return {
      valido: true,
      error: null,
      subtotal: subtotal,
      costoEnvio: 0,
      total: subtotal,
      envioACoordinar: true,
      esGratis: false,
      aviso: { texto: mensajeCoordinar, clase: "info" },
      datosEnvio: {
        tipoDestino: "otro",
        departamento: depto,
        localidad: loc,
        zonaEnvio: `${depto} — ${loc}`,
        costoEnvio: 0
      }
    };
  }

  // Flujo Eldorado: Cálculo automático de flete y montos mínimos
  const resultado = validarYCalcularEnvio({
    carrito,
    tipoDestino: envioSeleccion.tipoDestino,
    zonaEldorado: envioSeleccion.zonaEldorado,
    deptoOtro: envioSeleccion.deptoOtro,
    localidadOtro: envioSeleccion.localidadOtro
  });

  // 1. Manejo de Alerta Visual y Estado del Botón Confirmar
  if (!resultado.valido) {
    if (alertaDiv) {
      alertaDiv.style.display = "flex";
      alertaDiv.classList.remove("alerta-info");
      alertaDiv.classList.add("alerta-peligro");
    }
    if (alertaMensaje) {
      alertaMensaje.innerHTML = `<i class="bi bi-exclamation-triangle-fill" style="margin-right: 6px;"></i> ${escaparHtml(resultado.error)}`;
    }
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.classList.add("boton-deshabilitado");
    }
    if (envioEl) {
      envioEl.textContent = resultado.error;
      envioEl.className = "carrito-envio alerta";
    }
  } else {
    if (alertaDiv) {
      alertaDiv.style.display = "none";
      alertaDiv.classList.remove("alerta-peligro", "alerta-info");
    }
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.classList.remove("boton-deshabilitado");
    }
    if (envioEl) {
      envioEl.textContent = resultado.aviso.texto;
      envioEl.className = `carrito-envio ${resultado.aviso.clase}`;
    }
  }

  // 2. Desglose Financiero (Subtotal + Flete = Total a Pagar)
  if (totalEl) {
    if (resultado.costoEnvio > 0) {
      totalEl.innerHTML = `
        <span style="font-size: 0.88rem; color: var(--color-gris); font-weight: normal; margin-right: 6px;">
          (Subtotal: ${formatearPrecio(resultado.subtotal)} + Flete: ${formatearPrecio(resultado.costoEnvio)})
        </span> 
        <strong>Total: ${formatearPrecio(resultado.total)}</strong>
      `;
    } else {
      totalEl.innerHTML = `
        <strong>Total: ${formatearPrecio(resultado.total)}</strong>
        <span style="font-size: 0.85rem; color: #137333; font-weight: 700; margin-left: 6px;">(Envío gratis)</span>
      `;
    }
  }

  return resultado;
}
