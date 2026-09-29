# Alfa Materiales Eldorado

Plataforma de comercio electrónico y gestión para venta de materiales de construcción en Eldorado y localidades de la provincia de Misiones.

---

## 🏗️ Arquitectura del Sistema

El proyecto opera con una arquitectura moderna de sitio estático con backend serverless y base de datos en la nube:

1. **Frontend Estático (Netlify):**
   - HTML5 semántico, CSS moderno y JavaScript modular (ESM).
   - Catálogo interactivo (`index.html`), carrito de compras con cotizador de fletes en tiempo real (`carrito.html`) y panel de administración (`admin.html`).
   - Sincronización en vivo con Firestore mediante escuchas en tiempo real (`onSnapshot`).

2. **Módulo Central de Negocio (`reglas-envio.js`):**
   - Funciones y constantes puras compartidas entre el cliente y el servidor.
   - Umbral de envío gratis (`$300.000`), cantidad mínima de ladrillos (`150`), zonas de Eldorado (`km1_6`, `km7_12`) y cálculo determinístico de fletes.
   - Garantiza que el carrito del cliente y la función serverless tasen exactamente bajo las mismas condiciones.

3. **Checkout Serverless (`netlify/functions/crear-pedido.mjs`):**
   - Función serverless en Netlify ejecutada con `esbuild`.
   - Única puerta de entrada para la creación de pedidos: consulta el catálogo oficial en Firestore, recalcula subtotales y flete oficial, audita discrepancias, aplica rate limiting por número telefónico (máximo 3 pedidos cada 10 minutos) y asigna un número correlativo transaccional (`PEDIDO #0001`).

4. **Base de Datos (Firebase Firestore):**
   - Colección `/productos`: Catálogo de materiales administrable con precios y fotos.
   - Colección `/pedidos`: Registro inmutable de compras con auditoría server-side.
   - Colección `/contadores`: Numeración correlativa transaccional de pedidos.
   - Colección `/rate_limits`: Control de tasa de creación de pedidos por cliente.
   - Reglas de seguridad (`firestore.rules`) que bloquean la creación/modificación de pedidos desde el cliente y protegen la administración con Firebase Auth.

5. **Almacenamiento y Optimización de Fotos (Cloudinary):**
   - Subida directa unsigned desde el panel de administración a Cloudinary (`CLOUDINARY_CLOUD_NAME = "kcsfxt0i"`, `CLOUDINARY_UPLOAD_PRESET = "productos_preset"`).
   - Compresión previa en el cliente y transformaciones automáticas en la entrega (`f_auto,q_auto,w_600`).

---

## 🚀 Despliegue y Desarrollo Local

### Desarrollo local:
```bash
npm install
npm run dev
```
El servidor de desarrollo local emula las Netlify Functions en `http://localhost:3000/.netlify/functions/crear-pedido` y sirve los archivos estáticos.

### Variables de entorno (en Netlify):
- `JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE`: Credenciales JSON de la cuenta de servicio de Firebase Admin SDK.
