// Alfa Materiales - Panel de Administración (Productos y Pedidos)
import { 
  db, 
  auth, 
  storage,
  ADMIN_EMAILS, 
  OperationType, 
  handleFirestoreError 
} from './firebase-init.js';

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

import { 
  mostrarAlertaModal, 
  mostrarConfirmacionModal 
} from './modal-dialogs.js';

import { 
  formatearCodigoPedido, 
  formatearPrecio,
  obtenerInfoDepartamento,
  ESTADOS_PEDIDO 
} from './pedidos-utils.js';

// Catálogo predeterminado para sincronización / siembra inicial
const CATALOGO_BASE = [
  { nombre: "Ladrillo hueco 8×18×25 Liviano (1ª)", precio: 330, imagen: "fotos/8x18x25 L.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo hueco 12×18×25 Livaino (1ª)", precio: 370, imagen: "fotos/12x18x25 L.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo hueco 12×18×25 Liviano (2ª)", precio: 330, imagen: "fotos/12x18x25 L.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo hueco 12×18×25 Visto (1ª)", precio: 495, imagen: "fotos/12x18x25 visto.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo hueco 12×18×25 Visto (2ª)", precio: 395, imagen: "fotos/12x18x25 visto.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo hueco 18×18×25 Liviano (1ª)", precio: 545, imagen: "fotos/18x18x25 nuevo.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo hueco 18×18×25 Liviano (2ª)", precio: 440, imagen: "fotos/18x18x25 nuevo.jpg", categoria: "ladrillos" },
  { nombre: "Medio ladrillo hueco 12×18 Liviano", precio: 250, imagen: "fotos/medio 12x18 L.jpg", categoria: "ladrillos" },
  { nombre: "Medio ladrillo hueco 12×18 Visto", precio: 280, imagen: "fotos/medio 12x18 V.jpg", categoria: "ladrillos" },
  { nombre: "Medio Ladrillo hueco 18×18 Liviano", precio: 320, imagen: "fotos/medio 18x18.jpg", categoria: "ladrillos" },
  { nombre: "Peine encadenado", precio: 500, imagen: "fotos/peinde para encadenado.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo macizo (1ª)", precio: 400, imagen: "fotos/macizo 1ra.jpg", categoria: "ladrillos" },
  { nombre: "Ladrillo macizo (2ª)", precio: 230, imagen: "fotos/macizo comun.jpg", categoria: "ladrillos" },
  { nombre: "Cemento holcim 25kg", precio: 8000, imagen: "fotos/cemento holcim.jpg", categoria: "aridos" },
  { nombre: "Plasticor 25kg", precio: 8000, imagen: "fotos/plasticor.jpg", categoria: "aridos" },
  { nombre: "Arena fina (m³)", precio: 55000, imagen: "fotos/bolson de arena.jpg", categoria: "aridos" },
  { nombre: "Ripio (m³)", precio: 55000, imagen: "fotos/bolson de ripio1.jpg", categoria: "aridos" },
  { nombre: "Alambron kg", precio: 4600, imagen: "fotos/alambron.png", categoria: "otros" },
  { nombre: "Alambre dulce kg", precio: 4600, imagen: "fotos/alambre dulce.webp", categoria: "otros" },
  { nombre: "Alambre galvanizado 14", precio: 5500, imagen: "fotos/alambre galvanizado 14.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 4,2", precio: 4000, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 6", precio: 7125, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 8", precio: 12375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 10", precio: 19500, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 12", precio: 27750, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 16", precio: 47500, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" },
  { nombre: "Barra de hierro 20", precio: 75375, imagen: "fotos/varilla de hierro.jpg", categoria: "otros" }
];

// Normaliza nombres para comparación de duplicados sin importar mayúsculas, tildes ni espacios extra
function normalizarNombre(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Genera un ID determinista y compatible con firestore.rules (^[a-zA-Z0-9_\-]+$)
function generarIdBaseCatalogo(item, index) {
  const num = String(index + 1).padStart(2, "0");
  const slug = item.nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 45);
  return `base_${num}_${slug}`;
}

// Estado local de la aplicación administrativa
let productosLista = [];
let pedidosLista = [];
let editandoProductoId = null; // para edición inline
let desuscribirProductos = null;
let desuscribirPedidos = null;


// Formateador de fechas
function formatearFecha(timestamp) {
  if (!timestamp) return "Reciente";
  const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// Mostrar notificaciones Toast
function mostrarToast(mensaje, tipo = "exito") {
  const toast = document.getElementById("admin-notificacion");
  if (!toast) return;
  toast.className = `admin-toast toast-${tipo}`;
  toast.innerHTML = `<i class="bi bi-${tipo === 'exito' ? 'check-circle-fill' : 'exclamation-triangle-fill'}"></i> ${mensaje}`;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 4000);
}

// Escapar HTML seguro
function escapar(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ==========================================================================
   Autenticación (Restringida a ADMIN_EMAILS)
   ========================================================================== */

function inicializarAuth() {
  const formLogin = document.getElementById("form-login");
  const inputEmail = document.getElementById("login-email");
  const inputPassword = document.getElementById("login-password");
  const btnLogout = document.getElementById("btn-cerrar-sesion");
  const btnCrearAdmin = document.getElementById("btn-crear-admin");
  const errorMsg = document.getElementById("login-error-msg");
  const successMsg = document.getElementById("login-success-msg");

  // Login submit
  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.style.display = "none";
    successMsg.style.display = "none";

    const email = inputEmail.value.trim().toLowerCase();
    if (!email || !password) {
      errorMsg.textContent = "Por favor, completá tu correo y contraseña.";
      errorMsg.style.display = "block";
      return;
    }

    if (!ADMIN_EMAILS.includes(email)) {
      errorMsg.textContent = "Este panel de administración es exclusivo para administradores autorizados.";
      errorMsg.style.display = "block";
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      formLogin.reset();
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      let mensaje = "No se pudo iniciar sesión. Verificá tu contraseña.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        mensaje = "Contraseña incorrecta. Podés solicitar un enlace de restablecimiento abajo.";
      } else if (err.code === "auth/user-not-found") {
        mensaje = "El usuario no fue encontrado en Firebase Auth.";
      } else if (err.code === "auth/invalid-email") {
        mensaje = "El correo electrónico no es válido según Firebase Authentication.";
      } else if (err.code === "auth/too-many-requests") {
        mensaje = "Demasiados intentos erróneos. Esperá unos minutos.";
      } else if (err.code === "auth/operation-not-allowed") {
        mensaje = "El proveedor de Email/Contraseña debe habilitarse en la consola de Firebase (Autenticación > Sign-in method). O podés hacer click en 'Ingresar con Google' para entrar directamente.";
      }
      errorMsg.textContent = mensaje;
      errorMsg.style.display = "block";
    }
  });

  // Enlace de restablecimiento de contraseña
  const btnReset = document.getElementById("btn-reset-password");
  btnReset?.addEventListener("click", async () => {
    errorMsg.style.display = "none";
    successMsg.style.display = "none";
    const email = inputEmail.value.trim();
    if (!email) {
      errorMsg.textContent = "Por favor, ingresá tu correo electrónico para restablecer la contraseña.";
      errorMsg.style.display = "block";
      return;
    }
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      errorMsg.textContent = "Este panel de administración es exclusivo para administradores autorizados.";
      errorMsg.style.display = "block";
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      successMsg.textContent = `Enviamos un correo de restablecimiento a ${email}. Revisá tu bandeja de entrada o spam para elegir tu nueva contraseña.`;
      successMsg.style.display = "block";
      mostrarToast("Correo de restablecimiento enviado");
    } catch (err) {
      console.error("Error al enviar email de restablecimiento:", err);
      errorMsg.textContent = `Error: ${err.message}`;
      errorMsg.style.display = "block";
    }
  });

  // Ingreso directo con Google
  const btnGoogle = document.getElementById("btn-google-login");
  btnGoogle?.addEventListener("click", async () => {
    errorMsg.style.display = "none";
    successMsg.style.display = "none";
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Error en Google Auth:", err);
      errorMsg.textContent = `No se pudo ingresar con Google: ${err.message}`;
      errorMsg.style.display = "block";
    }
  });

  // Cerrar sesión con modal personalizado
  btnLogout?.addEventListener("click", async () => {
    const confirmado = await mostrarConfirmacionModal({
      titulo: "Cerrar sesión",
      mensaje: "¿Estás seguro de que querés cerrar la sesión del panel de administración?",
      icono: "bi-box-arrow-right",
      textoConfirmar: "Cerrar sesión",
      textoCancelar: "Cancelar",
      esPeligro: false
    });
    if (confirmado) {
      await signOut(auth);
    }
  });

  // Listener de estado de autenticación
  onAuthStateChanged(auth, async (user) => {
    const vistaLogin = document.getElementById("vista-login");
    const vistaDashboard = document.getElementById("vista-dashboard");
    const navLoggedOut = document.getElementById("admin-nav-logged-out");
    const navLoggedIn = document.getElementById("admin-nav-logged-in");
    const userPill = document.getElementById("admin-user-pill");
    const userEmailSpan = document.getElementById("admin-user-email");

    if (user) {
      // Verificar si es un usuario autorizado
      const emailUsuario = (user.email || "").toLowerCase();
      if (!ADMIN_EMAILS.includes(emailUsuario)) {
        await mostrarAlertaModal({
          titulo: "Acceso denegado",
          mensaje: "Acceso denegado: este panel es exclusivo para administradores autorizados.",
          icono: "bi-shield-x",
          tipo: "error"
        });
        signOut(auth);
        return;
      }

      // Usuario autenticado
      vistaLogin.style.display = "none";
      vistaDashboard.style.display = "block";
      navLoggedOut.style.display = "none";
      navLoggedIn.style.display = "block";
      userPill.style.display = "block";
      userEmailSpan.textContent = user.email;

      iniciarSuscripciones();
    } else {
      // No autenticado
      vistaLogin.style.display = "block";
      vistaDashboard.style.display = "none";
      navLoggedOut.style.display = "block";
      navLoggedIn.style.display = "none";
      userPill.style.display = "none";

      detenerSuscripciones();
    }
  });
}

/* ==========================================================================
   Suscripciones en tiempo real a Firestore
   ========================================================================== */

function iniciarSuscripciones() {
  detenerSuscripciones();

  // 1. Suscripción a Productos
  const colProductos = collection(db, "productos");
  desuscribirProductos = onSnapshot(colProductos, (snapshot) => {
    productosLista = [];
    snapshot.forEach(docSnap => {
      productosLista.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    // Ordenar alfabéticamente por nombre
    productosLista.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    renderizarTablaProductos();

    // Si la base está completamente vacía, mostrar sugerencia de sincronización
    const btnSembrar = document.getElementById("btn-sembrar-catalogo");
    if (productosLista.length === 0 && btnSembrar) {
      btnSembrar.classList.add("destacado-pulse");
    } else if (btnSembrar) {
      btnSembrar.classList.remove("destacado-pulse");
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "productos");
  });

  // 2. Suscripción a Pedidos (Solo lectura, ordenados del más nuevo al más viejo)
  console.log("[ADMIN] Listener de pedidos iniciado");
  const qPedidos = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
  desuscribirPedidos = onSnapshot(qPedidos, (snapshot) => {
    console.log(`[ADMIN] Documentos recibidos: ${snapshot.size}`);
    console.log(`[ADMIN] Firestore contiene ${snapshot.size} pedidos`);
    pedidosLista = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const codigo = data.codigoPedido || (data.numeroPedido ? `PEDIDO #${String(data.numeroPedido).padStart(4, "0")}` : docSnap.id);
      console.log(`[ADMIN] Pedido recibido: ID=${docSnap.id} | ${codigo} | Cliente: ${data.clienteNombre || 'Sin nombre'} | Total: ${data.total}`);
      pedidosLista.push({
        id: docSnap.id,
        ...data
      });
    });

    renderizarPedidos();
  }, (error) => {
    console.error("[ADMIN] Error en listener de pedidos (/pedidos):", error.code, error.message, error);
    const contenedor = document.getElementById("contenedor-pedidos");
    if (contenedor) {
      contenedor.innerHTML = `
        <div class="empty-state-pedidos" style="border: 2px dashed #b3261e; background-color: #fff8f8; padding: 25px; border-radius: 8px;">
          <i class="bi bi-exclamation-octagon-fill" style="font-size: 2.5rem; color: #b3261e;"></i>
          <h3 style="color: #b3261e; margin: 10px 0;">Error al conectar con Firestore (/pedidos)</h3>
          <p style="color: #555; font-size: 0.95rem; margin-bottom: 8px;">Código de error: <strong>${error.code || 'desconocido'}</strong></p>
          <p style="color: #222; font-size: 0.85rem; font-family: monospace; background: #eee; padding: 10px; border-radius: 4px; word-break: break-all;">${error.message}</p>
        </div>
      `;
    }
  });
}

function detenerSuscripciones() {
  if (desuscribirProductos) {
    desuscribirProductos();
    desuscribirProductos = null;
  }
  if (desuscribirPedidos) {
    desuscribirPedidos();
    desuscribirPedidos = null;
  }
}

/* ==========================================================================
   Gestión de Pestañas (Tabs)
   ========================================================================== */

function inicializarTabs() {
  const botonesTab = document.querySelectorAll(".boton-tab");
  const tabContenidos = document.querySelectorAll(".admin-tab-content");

  botonesTab.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      botonesTab.forEach(b => b.classList.remove("active"));
      tabContenidos.forEach(tc => tc.style.display = "none");

      btn.classList.add("active");
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.style.display = "block";
    });
  });
}

/* ==========================================================================
   SECCIÓN 1: PRODUCTOS (TABLA EDITABLE: CREAR / EDITAR / ELIMINAR)
   ========================================================================== */

// Redimensionar y comprimir imagen en el navegador del cliente antes de subir
async function comprimirImagenCliente(file, maxAncho = 1000, maxAlto = 1000, calidad = 0.82) {
  if (!file || !file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        // Si ya es chica y pesa menos de 100KB, no hace falta reescalar
        if (width <= maxAncho && height <= maxAlto && file.size < 100 * 1024) {
          resolve(file);
          return;
        }

        const escala = Math.min(maxAncho / width, maxAlto / height, 1);
        const targetW = Math.max(1, Math.round(width * escala));
        const targetH = Math.max(1, Math.round(height * escala));

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Exportar a WebP de alta compresión
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_") + ".webp";
            const archivoComprimido = new File([blob], safeName, { type: "image/webp" });
            console.log(`Foto comprimida: ${(file.size / 1024).toFixed(1)} KB -> ${(archivoComprimido.size / 1024).toFixed(1)} KB (-${(100 - (archivoComprimido.size / file.size) * 100).toFixed(0)}%)`);
            resolve(archivoComprimido);
          } else {
            // Fallback a JPEG si WebP no redujo tamaño
            canvas.toBlob((jpegBlob) => {
              if (jpegBlob && jpegBlob.size < file.size) {
                const baseName = file.name.replace(/\.[^/.]+$/, "");
                const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_") + ".jpg";
                const archivoJpeg = new File([jpegBlob], safeName, { type: "image/jpeg" });
                resolve(archivoJpeg);
              } else {
                resolve(file);
              }
            }, "image/jpeg", calidad);
          }
        }, "image/webp", calidad);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Eliminar archivo de Firebase Storage para evitar fotos huérfanas
async function eliminarImagenDeStorage(urlOPath) {
  if (!urlOPath || typeof urlOPath !== "string") return;

  const esUrlStorage = urlOPath.includes("firebasestorage.googleapis.com") || 
                       urlOPath.startsWith("gs://") || 
                       urlOPath.startsWith("productos/");

  if (!esUrlStorage) {
    // Es una foto estática local (ej: 'fotos/8x18x25 L.jpg'), no se borra
    return;
  }

  try {
    let storageRef;
    if (urlOPath.includes("/o/")) {
      const encodedPath = urlOPath.split("/o/")[1].split("?")[0];
      const decodedPath = decodeURIComponent(encodedPath);
      storageRef = ref(storage, decodedPath);
    } else {
      storageRef = ref(storage, urlOPath);
    }

    await deleteObject(storageRef);
    console.log("Foto eliminada de Firebase Storage:", urlOPath);
  } catch (err) {
    if (err.code === "storage/object-not-found") {
      console.warn("La imagen ya no existía en Storage.");
    } else {
      console.warn("No se pudo eliminar la imagen de Storage:", err);
    }
  }
}

// Subir imagen a Firebase Storage en carpeta productos/ con compresión previa y reporte de progreso
async function subirImagenAStorage(file, onProgress, onStatusText) {
  if (!file) throw new Error("No se seleccionó ningún archivo.");
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen válida.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("La imagen es demasiado pesada (máximo 20MB).");
  }

  if (onStatusText) {
    onStatusText("Comprimiendo y optimizando imagen...");
  }

  // 1. Compresión del lado del cliente
  const archivoOptimizado = await comprimirImagenCliente(file);
  const pesoKb = (archivoOptimizado.size / 1024).toFixed(0);
  const pesoOrigKb = (file.size / 1024).toFixed(0);

  if (onStatusText) {
    onStatusText(`Subiendo a productos/ (${pesoKb} KB en vez de ${pesoOrigKb} KB)...`);
  }

  const safeName = archivoOptimizado.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `productos/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, archivoOptimizado);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = snapshot.totalBytes > 0 
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 
          : 0;
        if (onProgress) onProgress(progress, pesoKb, pesoOrigKb);
      },
      (error) => {
        console.error("Error al subir a Firebase Storage:", error);
        let msg = `Error al subir imagen: ${error.message}`;
        if (error.code === 'storage/unauthorized') {
          msg = "No tenés permisos para subir archivos en Storage.";
        } else if (error.code === 'storage/bucket-not-found' || error.message.includes('does not exist')) {
          msg = "El almacenamiento de Firebase Storage aún no está activado en tu consola. Activá Firebase Storage en: https://console.firebase.google.com/project/alfa-materiales/storage";
        }
        reject(new Error(msg));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ downloadURL, pesoKb, pesoOrigKb });
        } catch (urlErr) {
          reject(urlErr);
        }
      }
    );
  });
}

function inicializarProductos() {
  const inputBuscar = document.getElementById("admin-buscar-producto");
  const selectCategoria = document.getElementById("admin-filtro-categoria");
  const btnNuevoModal = document.getElementById("btn-abrir-modal-nuevo");
  const btnSembrar = document.getElementById("btn-sembrar-catalogo");
  const modal = document.getElementById("modal-producto");
  const btnCerrarModal = document.getElementById("btn-cerrar-modal");
  const btnCancelarModal = document.getElementById("btn-cancelar-modal");
  const formProducto = document.getElementById("form-producto");
  const inputHiddenImg = document.getElementById("prod-imagen");
  const inputFile = document.getElementById("prod-file");
  const imgPreview = document.getElementById("img-preview");
  const wrapProgreso = document.getElementById("progreso-subida-wrap");
  const fillProgreso = document.getElementById("progreso-subida-fill");
  const pctProgreso = document.getElementById("progreso-subida-porcentaje");
  const txtProgreso = document.getElementById("progreso-subida-texto");
  const btnGuardarModal = document.getElementById("btn-guardar-producto");

  inputBuscar?.addEventListener("input", renderizarTablaProductos);
  selectCategoria?.addEventListener("change", renderizarTablaProductos);

  // Subida de imagen a Firebase Storage en modal Nuevo Producto
  inputFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vista previa inmediata con objectURL
    const objectUrl = URL.createObjectURL(file);
    imgPreview.src = objectUrl;

    wrapProgreso.style.display = "block";
    fillProgreso.style.width = "0%";
    pctProgreso.textContent = "0%";
    txtProgreso.innerHTML = `<i class="bi bi-hourglass-split"></i> Optimizando imagen...`;

    btnGuardarModal.disabled = true;
    btnGuardarModal.innerHTML = `<i class="bi bi-cloud-arrow-up spin"></i> Subiendo foto...`;

    try {
      const { downloadURL, pesoKb, pesoOrigKb } = await subirImagenAStorage(
        file, 
        (porcentaje) => {
          const pct = Math.round(porcentaje);
          fillProgreso.style.width = pct + "%";
          pctProgreso.textContent = pct + "%";
        },
        (textoEstado) => {
          txtProgreso.innerHTML = `<i class="bi bi-cloud-arrow-up spin"></i> ${textoEstado}`;
        }
      );

      inputHiddenImg.value = downloadURL;
      imgPreview.src = downloadURL;
      txtProgreso.innerHTML = `<i class="bi bi-check-circle-fill" style="color: #2b8a3e;"></i> ¡Optimizada (${pesoKb} KB) y subida a Storage!`;
      mostrarToast(`Foto comprimida de ${pesoOrigKb}KB a ${pesoKb}KB y subida`);
    } catch (err) {
      await mostrarAlertaModal({
        titulo: "Error al subir imagen",
        mensaje: err.message,
        icono: "bi-exclamation-triangle-fill",
        tipo: "error"
      });
      txtProgreso.innerHTML = `<i class="bi bi-exclamation-triangle-fill" style="color: #b3261e;"></i> Error al subir`;
    } finally {
      btnGuardarModal.disabled = false;
      btnGuardarModal.innerHTML = `<i class="bi bi-check-circle"></i> Guardar Producto`;
    }
  });

  imgPreview?.addEventListener("error", () => {
    imgPreview.src = "fotos/favicon-32.png";
  });

  // Abrir modal de nuevo producto
  btnNuevoModal?.addEventListener("click", () => {
    document.getElementById("modal-titulo").innerHTML = `<i class="bi bi-plus-circle"></i> Nuevo Producto`;
    formProducto.reset();
    document.getElementById("prod-id").value = "";
    inputHiddenImg.value = "";
    if (inputFile) inputFile.value = "";
    if (wrapProgreso) wrapProgreso.style.display = "none";
    imgPreview.src = "fotos/favicon-32.png";
    btnGuardarModal.disabled = false;
    btnGuardarModal.innerHTML = `<i class="bi bi-check-circle"></i> Guardar Producto`;
    modal.style.display = "flex";
  });

  // Cerrar modal
  const cerrarModal = () => { modal.style.display = "none"; };
  btnCerrarModal?.addEventListener("click", cerrarModal);
  btnCancelarModal?.addEventListener("click", cerrarModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });

  // Guardar producto desde modal (crear o editar)
  formProducto?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("prod-id").value.trim();
    const nombre = document.getElementById("prod-nombre").value.trim();
    const precio = Number(document.getElementById("prod-precio").value);
    const categoria = document.getElementById("prod-categoria").value;
    const imagen = inputHiddenImg.value.trim();

    if (!nombre || isNaN(precio) || precio < 0 || !categoria || !imagen) {
      await mostrarAlertaModal({
        titulo: "Campos requeridos",
        mensaje: "Por favor completá todos los campos requeridos y seleccioná una foto para subir a Storage.",
        icono: "bi-exclamation-circle-fill",
        tipo: "advertencia"
      });
      return;
    }

    try {
      if (id) {
        // Eliminar foto anterior en Storage si fue reemplazada
        const prodPrevio = productosLista.find(p => p.id === id);
        if (prodPrevio?.imagen && prodPrevio.imagen !== imagen) {
          await eliminarImagenDeStorage(prodPrevio.imagen);
        }

        // Actualizar existente
        const refDoc = doc(db, "productos", id);
        await updateDoc(refDoc, {
          nombre,
          precio,
          categoria,
          imagen,
          updatedAt: serverTimestamp()
        });
        mostrarToast(`Producto "${nombre}" actualizado correctamente.`);
      } else {
        // Crear nuevo
        await addDoc(collection(db, "productos"), {
          nombre,
          precio,
          categoria,
          imagen,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        mostrarToast(`Producto "${nombre}" creado con éxito.`);
      }
      cerrarModal();
    } catch (err) {
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, `productos/${id || ''}`);
    }
  });

  // Sembrar / sincronizar catálogo inicial de forma idempotente y robusta
  btnSembrar?.addEventListener("click", async () => {
    btnSembrar.disabled = true;
    btnSembrar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Verificando base...`;

    let snapshotActual;
    try {
      // 1. Lectura directa del estado actual de Firestore (sin depender de estado reactivo local)
      snapshotActual = await getDocs(collection(db, "productos"));
    } catch (err) {
      console.error("Error al consultar productos existentes en Firestore:", err);
      btnSembrar.disabled = false;
      btnSembrar.innerHTML = `<i class="bi bi-cloud-arrow-up"></i> Sincronizar catálogo base`;
      await mostrarAlertaModal({
        titulo: "Error de lectura",
        mensaje: `No se pudo consultar el catálogo en Firestore para verificar duplicados:\n[${err.code || 'error'}] ${err.message}`,
        icono: "bi-exclamation-triangle-fill",
        tipo: "error"
      });
      return;
    }

    const cantidadActual = snapshotActual.size;
    const textoConfirm = cantidadActual > 0 
      ? `Actualmente hay ${cantidadActual} productos en Firestore. ¿Deseás sincronizar los 27 productos base? Los que ya existan no se duplicarán.`
      : "¿Deseás cargar los 27 productos base del catálogo de Alfa Materiales en Firestore?";
    
    btnSembrar.disabled = false;
    btnSembrar.innerHTML = `<i class="bi bi-cloud-arrow-up"></i> Sincronizar catálogo base`;

    const confirmado = await mostrarConfirmacionModal({
      titulo: "Sincronizar Catálogo Base",
      mensaje: textoConfirm,
      icono: "bi-cloud-arrow-up",
      textoConfirmar: "Sincronizar",
      textoCancelar: "Cancelar",
      esPeligro: false
    });

    if (!confirmado) return;

    btnSembrar.disabled = true;
    btnSembrar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Sincronizando (0/27)...`;

    try {
      // 2. Mapear productos existentes por ID determinista y por nombre normalizado
      const idsExistentes = new Set();
      const nombresExistentes = new Set();

      snapshotActual.forEach(docSnap => {
        idsExistentes.add(docSnap.id);
        const data = docSnap.data();
        if (data?.nombre) {
          nombresExistentes.add(normalizarNombre(data.nombre));
        }
      });

      const omitidos = [];
      const itemsParaEscribir = [];

      CATALOGO_BASE.forEach((item, index) => {
        const docId = generarIdBaseCatalogo(item, index);
        const nombreNorm = normalizarNombre(item.nombre);

        if (idsExistentes.has(docId) || nombresExistentes.has(nombreNorm)) {
          omitidos.push({
            item,
            docId,
            motivo: idsExistentes.has(docId) ? "ID existente" : "Nombre ya registrado"
          });
        } else {
          itemsParaEscribir.push({ item, docId, index });
        }
      });

      if (itemsParaEscribir.length === 0) {
        mostrarToast(`El catálogo base ya está al día (${omitidos.length} productos conservados sin duplicar).`);
        return;
      }

      // 3. Ejecutar escrituras independientes con aislamiento de fallas por producto
      const promesas = itemsParaEscribir.map(({ item, docId }) => {
        return setDoc(doc(db, "productos", docId), {
          nombre: item.nombre,
          precio: item.precio,
          categoria: item.categoria,
          imagen: item.imagen,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        .then(() => ({ ok: true, item, docId }))
        .catch(err => {
          console.error(`Error escribiendo "${item.nombre}" (${docId}):`, err);
          return {
            ok: false,
            item,
            docId,
            code: err.code || "unknown",
            message: err.message || String(err)
          };
        });
      });

      const resultados = await Promise.all(promesas);

      const creados = resultados.filter(r => r.ok);
      const fallidos = resultados.filter(r => !r.ok);

      // 4. Diagnóstico y reporte detallado
      if (fallidos.length === 0) {
        mostrarToast(`Sincronización completa: ${creados.length} creados, ${omitidos.length} omitidos.`);
      } else {
        console.error("Fallas durante sincronización:", fallidos);
        const lineasError = fallidos.map(f => `• ${f.item.nombre}: [${f.code}] ${f.message}`).join("\n");
        await mostrarAlertaModal({
          titulo: "Sincronización parcial",
          mensaje: `Resultado de la sincronización:\n` +
                   `• Creados con éxito: ${creados.length}\n` +
                   `• Omitidos (ya existían): ${omitidos.length}\n` +
                   `• Fallidos: ${fallidos.length}\n\n` +
                   `Detalle de los errores reportados por Firebase:\n${lineasError}`,
          icono: "bi-exclamation-triangle-fill",
          tipo: "advertencia"
        });
      }
    } catch (err) {
      console.error("Error inesperado en sincronización:", err);
      handleFirestoreError(err, OperationType.WRITE, "productos");
    } finally {
      btnSembrar.disabled = false;
      btnSembrar.innerHTML = `<i class="bi bi-cloud-arrow-up"></i> Sincronizar catálogo base`;
    }
  });
}

// Renderizar tabla de productos con soporte para edición inline
function renderizarTablaProductos() {
  const tbody = document.getElementById("cuerpo-tabla-productos");
  const totalCountEl = document.getElementById("admin-total-productos");
  const inputBuscar = document.getElementById("admin-buscar-producto");
  const selectCategoria = document.getElementById("admin-filtro-categoria");

  if (!tbody) return;

  const termino = (inputBuscar?.value || "").toLowerCase().trim();
  const filtroCat = selectCategoria?.value || "todas";

  let filtrados = productosLista.filter(p => {
    const coincideNombre = (p.nombre || "").toLowerCase().includes(termino);
    const coincideCat = filtroCat === "todas" || p.categoria === filtroCat;
    return coincideNombre && coincideCat;
  });

  if (totalCountEl) totalCountEl.textContent = filtrados.length;

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--color-gris);">
          <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>
          No se encontraron productos. Podés crear uno con "+ Nuevo Producto" o sincronizar el catálogo base.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  filtrados.forEach(prod => {
    const esModoEdicionInline = editandoProductoId === prod.id;
    const tr = document.createElement("tr");
    tr.id = `fila-prod-${prod.id}`;
    tr.className = esModoEdicionInline ? "fila-edicion-activa" : "";

    if (esModoEdicionInline) {
      // FILA EN MODO EDICIÓN INLINE CON SUBIDA A FIREBASE STORAGE
      tr.innerHTML = `
        <td>
          <div class="subida-inline-contenedor">
            <img src="${prod.imagen}" id="inline-img-preview-${prod.id}" class="tabla-thumb" alt="${escapar(prod.nombre)}" onerror="this.src='fotos/favicon-32.png'">
            <label class="btn-subir-inline" for="inline-file-${prod.id}">
              <i class="bi bi-cloud-arrow-up"></i> Elegir foto
            </label>
            <input type="file" id="inline-file-${prod.id}" class="input-archivo-oculto" accept="image/*" data-id="${prod.id}">
            <input type="hidden" id="inline-imagen-${prod.id}" value="${escapar(prod.imagen)}">
            
            <div id="inline-progreso-wrap-${prod.id}" class="mini-barra-progreso" style="display: none;">
              <div id="inline-progreso-fill-${prod.id}" class="mini-barra-fill" style="width: 0%;"></div>
              <span id="inline-progreso-txt-${prod.id}" class="mini-barra-txt">0%</span>
            </div>
          </div>
        </td>
        <td>
          <input type="text" class="input-inline" id="inline-nombre-${prod.id}" value="${escapar(prod.nombre)}" style="width: 100%; font-weight: 600;" required>
        </td>
        <td>
          <select class="input-inline" id="inline-categoria-${prod.id}" style="width: 100%;">
            <option value="ladrillos" ${prod.categoria === 'ladrillos' ? 'selected' : ''}>Ladrillos</option>
            <option value="aridos" ${prod.categoria === 'aridos' ? 'selected' : ''}>Áridos y Aglomerantes</option>
            <option value="otros" ${prod.categoria === 'otros' ? 'selected' : ''}>Otros</option>
          </select>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-weight: bold;">$</span>
            <input type="number" class="input-inline" id="inline-precio-${prod.id}" value="${prod.precio}" min="0" step="1" style="width: 100px; font-weight: 700;">
          </div>
        </td>
        <td style="text-align: right;">
          <div class="botones-fila-acciones">
            <button class="btn-guardar-inline" data-id="${prod.id}" title="Guardar cambios">
              <i class="bi bi-check-lg"></i> Guardar
            </button>
            <button class="btn-cancelar-inline" data-id="${prod.id}" title="Cancelar">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </td>
      `;
    } else {
      // FILA EN MODO LECTURA CON BOTONES DE EDITAR Y ELIMINAR
      const badgeCategoria = {
        ladrillos: { label: "Ladrillos", clase: "badge-ladrillos" },
        aridos: { label: "Áridos", clase: "badge-aridos" },
        otros: { label: "Otros", clase: "badge-otros" }
      }[prod.categoria] || { label: prod.categoria, clase: "badge-otros" };

      tr.innerHTML = `
        <td>
          <img src="${prod.imagen}" class="tabla-thumb" alt="${escapar(prod.nombre)}" onerror="this.src='fotos/favicon-32.png'">
        </td>
        <td>
          <strong class="prod-nombre-tabla">${escapar(prod.nombre)}</strong>
        </td>
        <td>
          <span class="badge-cat ${badgeCategoria.clase}">${badgeCategoria.label}</span>
        </td>
        <td>
          <span class="prod-precio-tabla">${formatearPrecio(prod.precio)}</span>
        </td>
        <td style="text-align: right;">
          <div class="botones-fila-acciones">
            <button class="btn-accion-tabla btn-editar-fila" data-id="${prod.id}" title="Editar producto">
              <i class="bi bi-pencil-square"></i> Editar
            </button>
            <button class="btn-accion-tabla btn-eliminar-fila" data-id="${prod.id}" title="Eliminar producto">
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </td>
      `;
    }

    tbody.appendChild(tr);
  });

  // Event Listeners para las acciones de la tabla
  asignarEventosTabla();
}

function asignarEventosTabla() {
  const tbody = document.getElementById("cuerpo-tabla-productos");
  if (!tbody) return;

  // Subida de imagen a Firebase Storage en edición inline
  tbody.querySelectorAll(".input-archivo-oculto").forEach(fileInput => {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const id = fileInput.dataset.id;
      const imgPrev = document.getElementById(`inline-img-preview-${id}`);
      const inputHidden = document.getElementById(`inline-imagen-${id}`);
      const progWrap = document.getElementById(`inline-progreso-wrap-${id}`);
      const progFill = document.getElementById(`inline-progreso-fill-${id}`);
      const progTxt = document.getElementById(`inline-progreso-txt-${id}`);
      const btnGuardar = tbody.querySelector(`.btn-guardar-inline[data-id="${id}"]`);

      // Vista previa local inmediata
      imgPrev.src = URL.createObjectURL(file);
      if (progWrap) {
        progWrap.style.display = "flex";
        progFill.style.width = "0%";
        progTxt.textContent = "0%";
      }

      if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i>`;
      }

      try {
        const { downloadURL, pesoKb, pesoOrigKb } = await subirImagenAStorage(
          file, 
          (porcentaje) => {
            const pct = Math.round(porcentaje);
            if (progFill) progFill.style.width = pct + "%";
            if (progTxt) progTxt.textContent = pct + "%";
          }
        );

        if (inputHidden) inputHidden.value = downloadURL;
        imgPrev.src = downloadURL;
        if (progTxt) progTxt.textContent = `✓ ${pesoKb}KB`;
        mostrarToast(`Foto comprimida de ${pesoOrigKb}KB a ${pesoKb}KB y subida`);
      } catch (err) {
        await mostrarAlertaModal({
          titulo: "Error al subir imagen",
          mensaje: err.message,
          icono: "bi-exclamation-triangle-fill",
          tipo: "error"
        });
        if (progTxt) progTxt.textContent = "Error";
      } finally {
        if (btnGuardar) {
          btnGuardar.disabled = false;
          btnGuardar.innerHTML = `<i class="bi bi-check-lg"></i> Guardar`;
        }
      }
    });
  });

  // Click en Editar (abre modo inline)
  tbody.querySelectorAll(".btn-editar-fila").forEach(btn => {
    btn.addEventListener("click", () => {
      editandoProductoId = btn.dataset.id;
      renderizarTablaProductos();
    });
  });

  // Click en Cancelar edición inline
  tbody.querySelectorAll(".btn-cancelar-inline").forEach(btn => {
    btn.addEventListener("click", () => {
      editandoProductoId = null;
      renderizarTablaProductos();
    });
  });

  // Click en Guardar inline
  tbody.querySelectorAll(".btn-guardar-inline").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const inputNombre = document.getElementById(`inline-nombre-${id}`);
      const inputPrecio = document.getElementById(`inline-precio-${id}`);
      const selectCat = document.getElementById(`inline-categoria-${id}`);
      const inputImg = document.getElementById(`inline-imagen-${id}`);

      const nuevoNombre = inputNombre?.value.trim();
      const nuevoPrecio = Number(inputPrecio?.value);
      const nuevaCat = selectCat?.value;
      const nuevaImg = inputImg?.value.trim();

      if (!nuevoNombre || isNaN(nuevoPrecio) || nuevoPrecio < 0 || !nuevaCat || !nuevaImg) {
        await mostrarAlertaModal({
          titulo: "Datos incompletos",
          mensaje: "Por favor completá todos los campos requeridos correctamente.",
          icono: "bi-exclamation-circle-fill",
          tipo: "advertencia"
        });
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<i class="bi bi-arrow-repeat spin"></i>`;

      try {
        // Eliminar foto anterior en Storage si fue reemplazada
        const prodPrevio = productosLista.find(p => p.id === id);
        if (prodPrevio?.imagen && prodPrevio.imagen !== nuevaImg) {
          await eliminarImagenDeStorage(prodPrevio.imagen);
        }

        await updateDoc(doc(db, "productos", id), {
          nombre: nuevoNombre,
          precio: nuevoPrecio,
          categoria: nuevaCat,
          imagen: nuevaImg,
          updatedAt: serverTimestamp()
        });

        editandoProductoId = null;
        mostrarToast(`"${nuevoNombre}" actualizado.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `productos/${id}`);
      }
    });
  });

  // Click en Eliminar (elimina el archivo de Storage y el doc de Firestore)
  tbody.querySelectorAll(".btn-eliminar-fila").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const prod = productosLista.find(p => p.id === id);
      const nombre = prod ? prod.nombre : "este producto";

      const confirmado = await mostrarConfirmacionModal({
        titulo: "Eliminar producto",
        mensaje: `¿Estás seguro de que querés eliminar permanentemente "${nombre}" del catálogo? Esta acción no se puede deshacer.`,
        icono: "bi-trash-fill",
        textoConfirmar: "Eliminar",
        textoCancelar: "Cancelar",
        esPeligro: true
      });

      if (confirmado) {
        btn.disabled = true;
        try {
          // 1. Eliminar archivo en Firebase Storage si existe (evita fotos huérfanas)
          if (prod?.imagen) {
            await eliminarImagenDeStorage(prod.imagen);
          }

          // 2. Eliminar documento en Firestore
          await deleteDoc(doc(db, "productos", id));
          mostrarToast(`Producto y archivo eliminados.`);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `productos/${id}`);
        }
      }
    });
  });
}

/* ==========================================================================
   SECCIÓN 2: PEDIDOS (RESUMEN CORRELATIVO Y MODAL DE DETALLES)
   ========================================================================== */

function inicializarPedidos() {
  const inputBuscar = document.getElementById("admin-buscar-pedidos");
  const selectFiltroEstado = document.getElementById("admin-filtro-estado-pedidos");
  const btnRecargar = document.getElementById("btn-recargar-pedidos");

  inputBuscar?.addEventListener("input", renderizarPedidos);
  selectFiltroEstado?.addEventListener("change", renderizarPedidos);
  btnRecargar?.addEventListener("click", () => {
    mostrarToast("Actualizando pedidos...", "info");
    iniciarSuscripciones();
  });
}

// Obtiene el código visible correlativo asegurando no duplicación y retrocompatibilidad
function obtenerCodigoVisible(pedido, idx = 0) {
  if (pedido.codigoPedido) return pedido.codigoPedido;
  if (pedido.numeroPedido) return formatearCodigoPedido(pedido.numeroPedido);
  const fallbackNum = pedidosLista.length - idx;
  return `PEDIDO #${String(Math.max(1, fallbackNum)).padStart(4, "0")}`;
}

// Actualiza el estado de un pedido en Firestore
async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
  try {
    await updateDoc(doc(db, "pedidos", pedidoId), {
      estado: nuevoEstado,
      updatedAt: serverTimestamp()
    });
    const label = ESTADOS_PEDIDO[nuevoEstado]?.label || nuevoEstado;
    mostrarToast(`Estado actualizado a "${label}".`);
  } catch (err) {
    console.error("Error al actualizar estado del pedido:", err);
    mostrarToast("No se pudo actualizar el estado del pedido.", "error");
  }
}

// Modal completo de detalles del pedido
function abrirModalDetallePedido(pedido, codigo) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "admin-modal";
  modalOverlay.style.zIndex = "10000";

  const fechaFormateada = formatearFecha(pedido.createdAt);
  const estadoClave = (pedido.estado || "pendiente").toLowerCase();
  const esCoordinar = pedido.envioACoordinar === true || String(pedido.tipoDestino || "").toLowerCase() === "otro";
  const destinoTexto = pedido.zonaEnvio || `${pedido.departamento || 'Misiones'} — ${pedido.localidad || ''}`;
  
  // Buscar información interna del departamento para sugerir precio de referencia al operador
  const infoDepto = esCoordinar ? obtenerInfoDepartamento(pedido.departamento || pedido.zonaEnvio) : null;
  const fleteReferencia = infoDepto?.costoFleteReferencia;

  // Calcular o recuperar subtotal y costo de envío
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const subtotalCalc = typeof pedido.subtotal === "number" 
    ? pedido.subtotal 
    : items.reduce((acc, i) => acc + (Number(i.precio || 0) * Number(i.cantidad || 1)), 0);
  
  const totalCalc = Number(pedido.total || subtotalCalc);
  const costoEnvioCalc = typeof pedido.costoEnvio === "number"
    ? pedido.costoEnvio
    : Math.max(0, totalCalc - subtotalCalc);

  modalOverlay.innerHTML = `
    <div class="modal-contenido" style="max-width: 680px; width: 92%;">
      <div class="modal-cabecera">
        <h3 style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <i class="bi bi-receipt" style="color: var(--color-naranja);"></i> 
          ${escapar(codigo)}
          ${esCoordinar ? `<span class="badge-envio-coordinar" style="font-size: 0.78rem;"><i class="bi bi-telephone-outbound-fill"></i> A coordinar</span>` : ''}
        </h3>
        <button type="button" class="modal-cerrar" aria-label="Cerrar">&times;</button>
      </div>

      <div class="modal-detalle-pedido-cuerpo">
        <!-- Tabla de Productos y Precios Congelados (Prioridad de preparación) -->
        <div style="overflow-x: auto;">
          <table class="tabla-items-pedido" style="margin-bottom: 0;">
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align: center; width: 80px;">Cant.</th>
                <th style="text-align: right; width: 130px;">Precio Unit.</th>
                <th style="text-align: right; width: 140px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${items.length > 0 ? items.map(item => {
                const cant = Number(item.cantidad || 1);
                const precio = Number(item.precio || 0);
                const sub = typeof item.subtotal === "number" ? item.subtotal : cant * precio;
                return `
                  <tr>
                    <td><strong>${escapar(item.nombre || "Producto")}</strong></td>
                    <td style="text-align: center;">${cant}</td>
                    <td style="text-align: right;">${formatearPrecio(precio)}</td>
                    <td style="text-align: right; font-weight: 600;">${formatearPrecio(sub)}</td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="4" style="text-align: center; color: var(--color-gris);">Sin productos registrados.</td></tr>`}
            </tbody>
          </table>
        </div>

        ${esCoordinar ? `
          <!-- Banner de Aviso de Seguimiento Telefónico con Guía de Referencia Interna -->
          <div class="banner-coordinar-modal">
            <i class="bi bi-telephone-inbound-fill"></i>
            <div style="width: 100%;">
              <strong>Seguimiento de envío requerido:</strong> Este pedido tiene entrega a convenir a <strong>${escapar(destinoTexto)}</strong>.<br>
              Comunicate con el cliente al <strong>${escapar(pedido.clienteTelefono || "Sin teléfono")}</strong> para presupuestar el flete y acordar la entrega.
              
              ${fleteReferencia ? `
                <div style="margin-top: 8px; padding: 7px 12px; background-color: #ffffff; border-radius: 4px; border: 1px dashed #93c5fd; font-size: 0.88rem; color: #0369a1; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                  <span><i class="bi bi-tag-fill" style="color: var(--color-naranja); margin-right: 4px;"></i> <strong>Tarifa base de referencia interna (${escapar(infoDepto.nombre)}):</strong></span>
                  <strong style="font-size: 0.95rem; color: #0c4a6e; background-color: #f0f9ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd;">${formatearPrecio(fleteReferencia)}</strong>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Bloque de Estado del Pedido -->
        <div class="detalle-bloque-estado">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="bi bi-toggles" style="font-size: 1.1rem; color: var(--color-naranja);"></i>
            <strong>Estado del Pedido:</strong>
          </div>
          <select id="modal-select-estado" class="select-estado-pedido">
            <option value="pendiente" ${estadoClave === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="entregado" ${estadoClave === 'entregado' ? 'selected' : ''}>Entregado</option>
            <option value="cancelado" ${estadoClave === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>

        <!-- Bloque Datos del Cliente y Entrega -->
        <div class="detalle-bloque-cliente">
          <div><i class="bi bi-person-fill" style="color: var(--color-naranja); margin-right: 6px;"></i><strong>Nombre del Cliente:</strong> ${escapar(pedido.clienteNombre || "Sin especificar")}</div>
          <div><i class="bi bi-telephone-fill" style="color: var(--color-naranja); margin-right: 6px;"></i><strong>Teléfono:</strong> <a href="tel:${escapar(pedido.clienteTelefono || '')}" style="color: inherit; text-decoration: underline; font-weight: 600;">${escapar(pedido.clienteTelefono || "Sin especificar")}</a></div>
          <div><i class="bi bi-geo-alt-fill" style="color: var(--color-naranja); margin-right: 6px;"></i><strong>Dirección de entrega:</strong> ${escapar(pedido.direccion || pedido.clienteDireccion || "Sin especificar")}</div>
          ${pedido.zonaEnvio || pedido.departamento ? `<div><i class="bi bi-truck" style="color: var(--color-naranja); margin-right: 6px;"></i><strong>Zona de entrega / Destino:</strong> ${escapar(destinoTexto)}</div>` : ''}
          ${pedido.referencia ? `<div><i class="bi bi-card-text" style="color: var(--color-naranja); margin-right: 6px;"></i><strong>Detalles / Referencias:</strong> ${escapar(pedido.referencia)}</div>` : ''}
          <div><i class="bi bi-calendar3" style="color: var(--color-naranja); margin-right: 6px;"></i><strong>Fecha y hora:</strong> ${escapar(fechaFormateada)}</div>
        </div>

        <!-- Desglose Financiero -->
        <div class="detalle-desglose-totales">
          <div>Subtotal: <strong>${formatearPrecio(subtotalCalc)}</strong></div>
          <div>Costo de envío: <strong>${esCoordinar ? "A coordinar con el cliente (a convenir)" : (costoEnvioCalc === 0 ? "Gratis ($0)" : formatearPrecio(costoEnvioCalc))}</strong></div>
          <div class="linea-total-destacada">TOTAL: ${formatearPrecio(totalCalc)}</div>
        </div>
      </div>

      <div class="modal-pie" style="padding: 14px 24px; border-top: 1px solid #eee8df; justify-content: flex-end;">
        <button type="button" class="boton-guardar btn-cerrar-modal-detalle" style="padding: 10px 24px;">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const selectEstado = modalOverlay.querySelector("#modal-select-estado");
  selectEstado?.addEventListener("change", (e) => {
    cambiarEstadoPedido(pedido.id, e.target.value);
  });

  const cerrarModal = () => {
    document.removeEventListener("keydown", onKeyDown);
    modalOverlay.remove();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cerrarModal();
    }
  };

  document.addEventListener("keydown", onKeyDown);
  modalOverlay.querySelector(".modal-cerrar")?.addEventListener("click", cerrarModal);
  modalOverlay.querySelector(".btn-cerrar-modal-detalle")?.addEventListener("click", cerrarModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) cerrarModal();
  });
}

function renderizarPedidos() {
  const contenedor = document.getElementById("contenedor-pedidos");
  const contadorEl = document.getElementById("admin-pedidos-count");
  const contadorBadge = document.getElementById("contador-pedidos");
  const inputBuscar = document.getElementById("admin-buscar-pedidos");
  const selectFiltroEstado = document.getElementById("admin-filtro-estado-pedidos");

  if (!contenedor) return;

  const termino = (inputBuscar?.value || "").toLowerCase().trim();
  const filtroEstado = (selectFiltroEstado?.value || "todos").toLowerCase();

  let filtrados = pedidosLista.filter((ped, idx) => {
    const estadoClave = (ped.estado || "pendiente").toLowerCase();
    const esCoordinar = ped.envioACoordinar === true || String(ped.tipoDestino || "").toLowerCase() === "otro";

    // Filtro especial 'coordinar' o por estado: 'todos', 'pendiente', 'entregado' o 'cancelado'
    if (filtroEstado === "coordinar") {
      if (!esCoordinar) return false;
    } else if (filtroEstado !== "todos" && estadoClave !== filtroEstado) {
      return false;
    }

    if (!termino) return true;
    const codigo = obtenerCodigoVisible(ped, idx).toLowerCase();
    const clienteStr = (ped.clienteNombre || "").toLowerCase();
    const telStr = (ped.clienteTelefono || "").toLowerCase();
    const dirStr = (ped.clienteDireccion || "").toLowerCase();
    const zonaStr = (ped.zonaEnvio || ped.departamento || "").toLowerCase();
    const idStr = (ped.id || "").toLowerCase();
    const itemsStr = (ped.items || []).map(i => i.nombre || "").join(" ").toLowerCase();
    return codigo.includes(termino) || clienteStr.includes(termino) || telStr.includes(termino) || dirStr.includes(termino) || zonaStr.includes(termino) || idStr.includes(termino) || itemsStr.includes(termino);
  });

  if (contadorEl) {
    if (filtroEstado === "todos") {
      contadorEl.textContent = pedidosLista.length;
    } else {
      contadorEl.textContent = `${filtrados.length} (de ${pedidosLista.length})`;
    }
  }
  if (contadorBadge) contadorBadge.textContent = pedidosLista.length;

  console.log(`[ADMIN] Pedidos renderizados: ${filtrados.length} (Filtro: ${filtroEstado})`);

  if (filtrados.length === 0) {
    const estadoLabel = selectFiltroEstado?.options[selectFiltroEstado.selectedIndex]?.text || filtroEstado;
    const mensajeVacio = filtroEstado !== "todos"
      ? `No se encontraron pedidos con el filtro "${estadoLabel}".`
      : "Cuando un cliente confirme un pedido desde el carrito, aparecerá aquí en tiempo real con su número correlativo y detalle completo.";
    contenedor.innerHTML = `
      <div class="empty-state-pedidos">
        <i class="bi bi-receipt-cutoff" style="font-size: 3rem; color: var(--color-gris);"></i>
        <h3>${filtroEstado !== "todos" ? `Sin pedidos (${estadoLabel})` : "No hay pedidos registrados"}</h3>
        <p>${mensajeVacio}</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = "";

  filtrados.forEach((pedido, idx) => {
    const card = document.createElement("article");
    const esCoordinar = pedido.envioACoordinar === true || String(pedido.tipoDestino || "").toLowerCase() === "otro";
    card.className = `tarjeta-pedido tarjeta-pedido-resumen ${esCoordinar ? 'tarjeta-pedido-coordinar' : ''}`;

    const codigo = obtenerCodigoVisible(pedido, idx);
    const fechaFormateada = formatearFecha(pedido.createdAt);
    const estadoClave = (pedido.estado || "pendiente").toLowerCase();
    const estadoInfo = ESTADOS_PEDIDO[estadoClave] || { label: pedido.estado || "Pendiente", icono: "bi-clock-history" };
    const destinoTexto = pedido.zonaEnvio || `${pedido.departamento || 'Misiones'} — ${pedido.localidad || ''}`;

    // Buscar tarifa orientativa interna para el operador
    const infoDepto = esCoordinar ? obtenerInfoDepartamento(pedido.departamento || pedido.zonaEnvio) : null;
    const fleteReferencia = infoDepto?.costoFleteReferencia;

    const totalUnidades = (pedido.items || []).reduce((acc, i) => acc + Number(i.cantidad || 1), 0);

    card.innerHTML = `
      <header class="pedido-cabecera" style="margin-bottom: 6px; padding-bottom: 8px;">
        <div class="pedido-meta">
          <span class="pedido-num-tag">${escapar(codigo)}</span>
          <span class="badge-estado badge-estado-${estadoClave}">
            <i class="bi ${estadoInfo.icono}"></i> ${estadoInfo.label}
          </span>
          ${esCoordinar ? `
            <span class="badge-envio-coordinar" title="Envío a convenir fuera de Eldorado — Llamar para cotizar">
              <i class="bi bi-telephone-outbound-fill"></i> A coordinar
            </span>
          ` : ''}
        </div>
        <span class="pedido-fecha"><i class="bi bi-calendar3"></i> ${fechaFormateada}</span>
      </header>

      <div class="pedido-resumen-grid">
        <div class="pedido-resumen-item">
          <i class="bi bi-person-fill"></i>
          <div><strong>Cliente:</strong> ${escapar(pedido.clienteNombre || "Cliente web")} (${escapar(pedido.clienteTelefono || "Sin tel.")})</div>
        </div>
        <div class="pedido-resumen-item">
          <i class="bi bi-geo-alt-fill"></i>
          <div><strong>Dirección:</strong> ${escapar(pedido.clienteDireccion || pedido.direccion || "Sin dirección")}</div>
        </div>
        <div class="pedido-resumen-item">
          <i class="bi bi-cash-stack"></i>
          <div><strong>Total productos:</strong> <span style="font-weight: 700; color: var(--color-naranja-oscuro);">${formatearPrecio(pedido.total)}</span></div>
        </div>
        ${esCoordinar ? `
          <div class="pedido-resumen-item item-coordinar-aviso">
            <i class="bi bi-telephone-forward-fill"></i>
            <div>
              <strong>Flete a convenir:</strong> ${escapar(destinoTexto)}
              ${fleteReferencia ? `<span class="tag-ref-interna" title="Tarifa orientativa interna para el operador"><i class="bi bi-tag-fill" style="color: var(--color-naranja);"></i> Ref. base: ${formatearPrecio(fleteReferencia)}</span>` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <footer class="pedido-resumen-acciones">
        <button class="boton-accion-secundario btn-ver-detalles-pedido" data-id="${pedido.id}">
          <i class="bi bi-eye"></i> Ver detalles (${totalUnidades} u.)
        </button>

        <div style="display: flex; align-items: center; gap: 8px;">
          <small style="color: var(--color-gris); font-weight: 600;">Estado:</small>
          <select class="select-estado-pedido select-estado-rapido" data-id="${pedido.id}">
            <option value="pendiente" ${estadoClave === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="entregado" ${estadoClave === 'entregado' ? 'selected' : ''}>Entregado</option>
            <option value="cancelado" ${estadoClave === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
      </footer>
    `;

    // Event listener para el botón "Ver detalles"
    card.querySelector(".btn-ver-detalles-pedido")?.addEventListener("click", () => {
      abrirModalDetallePedido(pedido, codigo);
    });

    // Event listener para el selector rápido de estado
    card.querySelector(".select-estado-rapido")?.addEventListener("change", (e) => {
      cambiarEstadoPedido(pedido.id, e.target.value);
    });

    contenedor.appendChild(card);
  });
}

/* ==========================================================================
   Inicialización General
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  inicializarAuth();
  inicializarTabs();
  inicializarProductos();
  inicializarPedidos();
});
