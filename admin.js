// Alfa Materiales - Panel de Administración (Productos y Pedidos)
import { 
  db, 
  auth, 
  storage,
  ADMIN_EMAIL, 
  OperationType, 
  handleFirestoreError 
} from './firebase-init.js';

import { 
  collection, 
  doc, 
  getDocs, 
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

// Estado local de la aplicación administrativa
let productosLista = [];
let pedidosLista = [];
let editandoProductoId = null; // para edición inline
let desuscribirProductos = null;
let desuscribirPedidos = null;

// Formateador de precios en Pesos Argentinos
function formatearPrecio(num) {
  return Number(num || 0).toLocaleString("es-AR", { 
    style: "currency", 
    currency: "ARS", 
    minimumFractionDigits: 0 
  });
}

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
   Autenticación (Restringida a ADMIN_EMAIL)
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
    const password = inputPassword.value;

    if (email !== ADMIN_EMAIL.toLowerCase()) {
      errorMsg.textContent = `Este panel de administración es exclusivo para ${ADMIN_EMAIL}.`;
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
    const email = inputEmail.value.trim() || ADMIN_EMAIL;
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

  // Ingreso directo con Google (octimusking2026@gmail.com)
  const btnGoogle = document.getElementById("btn-google-login");
  btnGoogle?.addEventListener("click", async () => {
    errorMsg.style.display = "none";
    successMsg.style.display = "none";
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
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
      // Verificar si es el usuario autorizado
      if (user.email && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await mostrarAlertaModal({
          titulo: "Acceso denegado",
          mensaje: `Acceso denegado: solo ${ADMIN_EMAIL} tiene permisos de administración.`,
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
  const qPedidos = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
  desuscribirPedidos = onSnapshot(qPedidos, (snapshot) => {
    pedidosLista = [];
    snapshot.forEach(docSnap => {
      pedidosLista.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    renderizarPedidos();
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "pedidos");
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
          msg = "El almacenamiento de Firebase Storage aún no está activado en tu consola. Activá Firebase Storage en: https://console.firebase.google.com/project/orbital-virtue-bds98/storage";
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

  // Sembrar catálogo inicial
  btnSembrar?.addEventListener("click", async () => {
    const textoConfirm = productosLista.length > 0 
      ? `Ya existen ${productosLista.length} productos en la base de datos. ¿Deseás sincronizar y agregar los 27 productos base del catálogo en Firestore?`
      : "¿Deseás cargar los 27 productos base del catálogo de Alfa Materiales en Firestore?";
    
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
    btnSembrar.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> Sincronizando...`;

    try {
      let agregados = 0;
      for (const item of CATALOGO_BASE) {
        // Evitar duplicar exactamente por nombre
        const yaExiste = productosLista.some(p => p.nombre.toLowerCase() === item.nombre.toLowerCase());
        if (!yaExiste) {
          await addDoc(collection(db, "productos"), {
            nombre: item.nombre,
            precio: item.precio,
            categoria: item.categoria,
            imagen: item.imagen,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          agregados++;
        }
      }
      mostrarToast(`Sincronización completa: ${agregados} productos agregados.`);
    } catch (err) {
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
   SECCIÓN 2: PEDIDOS (SOLO LECTURA, DEL MÁS NUEVO AL MÁS VIEJO)
   ========================================================================== */

function inicializarPedidos() {
  const inputBuscar = document.getElementById("admin-buscar-pedidos");
  const btnRecargar = document.getElementById("btn-recargar-pedidos");

  inputBuscar?.addEventListener("input", renderizarPedidos);
  btnRecargar?.addEventListener("click", () => {
    mostrarToast("Actualizando pedidos...", "info");
    iniciarSuscripciones();
  });
}

function renderizarPedidos() {
  const contenedor = document.getElementById("contenedor-pedidos");
  const contadorEl = document.getElementById("admin-pedidos-count");
  const contadorBadge = document.getElementById("contador-pedidos");
  const inputBuscar = document.getElementById("admin-buscar-pedidos");

  if (!contenedor) return;

  const termino = (inputBuscar?.value || "").toLowerCase().trim();

  let filtrados = pedidosLista.filter(ped => {
    if (!termino) return true;
    const clienteStr = (ped.clienteNombre || "").toLowerCase();
    const idStr = (ped.id || "").toLowerCase();
    const itemsStr = (ped.items || []).map(i => i.nombre || "").join(" ").toLowerCase();
    return clienteStr.includes(termino) || idStr.includes(termino) || itemsStr.includes(termino);
  });

  if (contadorEl) contadorEl.textContent = pedidosLista.length;
  if (contadorBadge) contadorBadge.textContent = pedidosLista.length;

  if (filtrados.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-state-pedidos">
        <i class="bi bi-receipt-cutoff" style="font-size: 3rem; color: var(--color-gris);"></i>
        <h3>No hay pedidos registrados</h3>
        <p>Cuando un cliente realice una compra desde el carrito público, los pedidos aparecerán aquí automáticamente en tiempo real.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = "";

  filtrados.forEach((pedido, idx) => {
    const card = document.createElement("article");
    card.className = "tarjeta-pedido";

    const fechaFormateada = formatearFecha(pedido.createdAt);
    const totalItems = (pedido.items || []).reduce((acc, i) => acc + (i.cantidad || 0), 0);

    let itemsHtml = "";
    if (Array.isArray(pedido.items) && pedido.items.length > 0) {
      itemsHtml = `
        <table class="tabla-items-pedido">
          <thead>
            <tr>
              <th>Producto</th>
              <th style="text-align: center; width: 90px;">Cantidad</th>
              <th style="text-align: right; width: 130px;">Precio Unit.</th>
              <th style="text-align: right; width: 140px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.items.map(item => {
              const cant = item.cantidad || 1;
              const precio = item.precio || 0;
              const subtotal = cant * precio;
              return `
                <tr>
                  <td><strong>${escapar(item.nombre)}</strong></td>
                  <td style="text-align: center;">${cant}</td>
                  <td style="text-align: right;">${formatearPrecio(precio)}</td>
                  <td style="text-align: right; font-weight: 600;">${formatearPrecio(subtotal)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    } else {
      itemsHtml = `<p style="color: var(--color-gris); font-style: italic;">Sin detalle de items.</p>`;
    }

    const clienteInfo = pedido.clienteNombre || pedido.clienteTelefono || pedido.clienteDireccion
      ? `
        <div class="pedido-cliente-bloque">
          <i class="bi bi-person-circle"></i>
          <div>
            <strong>${escapar(pedido.clienteNombre || "Cliente web")}</strong>
            ${pedido.clienteTelefono ? ` • <span>Tel: ${escapar(pedido.clienteTelefono)}</span>` : ""}
            ${pedido.clienteDireccion ? ` • <span>Dir: ${escapar(pedido.clienteDireccion)}</span>` : ""}
          </div>
        </div>
      `
      : "";

    card.innerHTML = `
      <header class="pedido-cabecera">
        <div class="pedido-meta">
          <span class="pedido-num-tag">#${pedido.id.slice(0, 7)}</span>
          <span class="pedido-fecha"><i class="bi bi-calendar3"></i> ${fechaFormateada}</span>
          <span class="pedido-badge-items"><i class="bi bi-box-seam"></i> ${totalItems} unidad${totalItems === 1 ? '' : 'es'}</span>
        </div>
        <div class="pedido-badge-solo-lectura" title="Esta sección es de solo lectura">
          <i class="bi bi-eye"></i> Solo lectura
        </div>
      </header>

      ${clienteInfo}

      <div class="pedido-detalle-items">
        ${itemsHtml}
      </div>

      <footer class="pedido-pie">
        <div class="pedido-estado-tag">
          <span class="punto-estado"></span> Recibido
        </div>
        <div class="pedido-total-box">
          <small>TOTAL DEL PEDIDO</small>
          <strong>${formatearPrecio(pedido.total)}</strong>
        </div>
      </footer>
    `;

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
