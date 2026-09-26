# ALFA MATERIALES ELDORADO
## Plan de Implementación (Revisado)
### Validación server-side de precios y protección anti-fraude en pedidos

Este documento reemplaza al plan original propuesto para el proyecto. Conserva la arquitectura de fondo e incorpora las cuatro correcciones acordadas tras la revisión:
1. **Eliminación del endpoint espejo en `server.js`:** La lógica no se duplica en Express; se extrae el cálculo de precios y fletes a un módulo JS puro compartido (`pedidos-utils.js`) para garantizar consistencia.
2. **Cierre de `/contadores/pedidos` en Firestore:** Se bloquea la manipulación directa del contador desde el cliente, pasando a ser gestionado exclusivamente por la Cloud Function con el Admin SDK.
3. **Payload de auditoría unificado (`totalReportadoPorCliente`):** El cliente envía únicamente IDs de producto, cantidades, datos de entrega y el total calculado localmente para contrastación. El servidor jamás utiliza este valor para fijar el precio, sino exclusivamente para detectar intentos de adulteración o desfasajes de catálogo.
4. **Rate limiting concreto por teléfono:** Máximo 3 pedidos por `clienteTelefono` cada 10 minutos, gestionado con registro transaccional en Firestore.

---

## 1. Objetivo

Eliminar la vulnerabilidad crítica que permite a cualquier usuario manipular el precio de los productos en `localStorage` o escribir pedidos con precios alterados directamente mediante el SDK cliente de Firestore.
La solución traslada la autoridad de cálculo y registro a una Cloud Function callable (`crearPedido`) que usa el SDK de Firebase Admin, cierra la creación directa de pedidos y contadores en `firestore.rules`, y agrega App Check más control de frecuencia por número de teléfono.

---

## 2. Arquitectura y Flujo de Seguridad

```
[ Cliente / Carrito ]
       │
       ▼ (Envía: IDs, cantidades, datos de entrega y totalReportadoPorCliente)
  [ Firebase App Check (reCAPTCHA v3) ]
       │
       ▼
  [ Control de Frecuencia (Rate Limiting) por clienteTelefono: max 3 pedidos / 10 min ]
       │
       ▼
 [ Cloud Function: crearPedido (Admin SDK) ]
       ├── 1. Valida App Check y rate limiting por clienteTelefono
       ├── 2. Consulta /productos/{id} y obtiene precios oficiales de catálogo
       ├── 3. Recalcula Subtotal y Flete con tarifas oficiales de pedidos-utils.js
       ├── 4. Compara totalReportadoPorCliente vs totalCalculadoOficial
       │      └── Si difiere: flag revisionRequerida: true + auditoría
       ├── 5. Incrementa /contadores/pedidos y genera número/código correlativo
       └── 6. Escribe en /pedidos con estado: "pendiente" y serverTimestamp()
       │
       ▼
 [ firestore.rules ]
       ├── /pedidos/{id} -> allow create: if false; (o if isAdmin();)
       └── /contadores/pedidos -> allow update: if isAdmin();
```

---

## 3. Cambios Propuestos por Componente

### 3.1 Backend — Cloud Function `crearPedido` (`functions/index.js` & `functions/package.json`)
- El cliente envía exclusivamente:
  ```json
  {
    "items": [{ "id": "prod_123", "cantidad": 500 }],
    "tipoDestino": "eldorado",
    "departamento": "Eldorado",
    "localidad": "Eldorado",
    "zonaEnvio": "km1_4",
    "clienteNombre": "Juan Pérez",
    "clienteTelefono": "3751123456",
    "clienteDireccion": "Av. San Martín 123",
    "referencia": "Casa portón negro",
    "totalReportadoPorCliente": 185000
  }
  ```
- **Validaciones en el servidor:**
  - Consulta los documentos correspondientes en `/productos/{id}`. Si algún ítem no existe o no es válido, rechaza la operación con error descriptivo.
  - Calcula el subtotal multiplicando `precioOficial * cantidad`.
  - Valida y calcula el flete usando las reglas vigentes (zona Eldorado o departamento de Misiones).
  - Evalúa `totalReportadoPorCliente`:
    - Si existe una discrepancia significativa (> 1%), persiste:
      - `revisionRequerida: true`
      - `motivoRevision: "Discrepancia entre el total informado por el cliente y el catálogo oficial"`
      - `totalCalculadoOficial: ...`
      - `totalReportadoPorCliente: ...`
    - Si coincide con el cálculo del catálogo: `revisionRequerida: false`.
  - Incrementa atómicamente el correlativo en `/contadores/pedidos` y genera `numeroPedido` y `codigoPedido`.
  - Registra el documento en `/pedidos` con `estado: "pendiente"` y `createdAt: FieldValue.serverTimestamp()`.
  - Responde al cliente: `{ success: true, pedidoId, codigoPedido, total, subtotal, costoEnvio, revisionRequerida }`.

### 3.2 Entorno de Desarrollo y Módulo de Cálculo Compartido
- **Se descarta el endpoint espejo en `server.js`:** Evita tener dos implementaciones duplicadas de cálculo de precios y fletes que puedan divergir.
- **Módulo JS puro compartido (`pedidos-utils.js`):**
  - Contiene las funciones puras de cálculo de subtotal, validación de fletes por zona/departamento y reglas de redondeo.
  - Tanto el frontend (`carrito.js`), como la Cloud Function (`functions/index.js`) y el panel (`admin.js`) utilizan este mismo origen de verdad para las reglas de tarifación.

### 3.3 Reglas de Seguridad (`firestore.rules`)
- **/pedidos/{pedidoId}:**
  - Modificar `allow create:` a:
    `allow create: if isAdmin();` (bloqueo total para clientes no administradores).
  - Al utilizar Firebase Admin SDK en la Cloud Function, las escrituras del backend omiten las reglas de seguridad automáticamente.
- **/contadores/pedidos:**
  - Cambiar `allow update:` a:
    `allow update: if isAdmin();`
  - Se elimina el permiso de incremento directo desde el cliente (`isValidContadorIncrement`), evitando que usuarios maliciosos inflen el número de pedido correlativo.
- Actualizar `firebase-blueprint.json` y sincronizar reglas con `deploy_firebase`.

### 3.4 Frontend del Carrito (`carrito.js` & `firebase-init.js`)
- **`firebase-init.js`:**
  - Inicializar Firebase Functions (`getFunctions(app)`) y exportar `const crearPedidoCallable = httpsCallable(functions, 'crearPedido')`.
  - Configurar Firebase App Check con reCAPTCHA v3.
- **`carrito.js`:**
  - **Aviso informativo previo (UX):** Antes de enviar el pedido, consulta los precios vigentes en `/productos` para alertar amigablemente al cliente si hubo cambios de precios mientras tenía la pestaña abierta.
  - **Invocación segura:** En lugar de llamar a `addDoc(collection(db, "pedidos"))`, llama a `crearPedidoCallable(...)` enviando IDs, cantidades, datos de entrega y `totalReportadoPorCliente`.
  - Ningún precio unitario viaja en el payload de confirmación.
  - Deshabilitar el botón y mostrar spinner de carga durante el procesamiento para evitar doble clic.

### 3.5 Control de Frecuencia (Rate Limiting) por `clienteTelefono`
- En la Cloud Function, antes de procesar el pedido, se consulta la colección `/rate_limits/{telefono}`.
- Umbral: **máximo 3 pedidos por número de teléfono en una ventana de 10 minutos**.
- Si el límite se excede, la función aborta con código `resource-exhausted`: *"Ya registramos pedidos recientes con este número. Por favor, esperá unos minutos o contactanos por WhatsApp"*.
- Si está dentro del límite, actualiza la marca temporal y el contador en la transacción.

### 3.6 Panel de Administración (`admin.js` & `styles.css`)
- **Detección de pedidos con `revisionRequerida: true`:**
  - En la tarjeta del listado: badge `⚠️ Precios ajustados / Revisión requerida`.
  - En el modal de detalle del pedido:
    - Alerta informativa en la parte superior: muestra el total oficial cobrable auditado junto al `totalReportadoPorCliente` para identificar discrepancias o intentos de adulteración de forma inmediata.
  - Filtro rápido en la barra de herramientas: opción `⚠️ Revisión requerida` en el selector de estados/filtros.
- **`styles.css`:**
  - Estilos visuales para el badge de advertencia y el contenedor de auditoría en el modal.

---

## 4. Puntos que Requieren tu Decisión

1. **Despliegue de Cloud Functions:** Requiere el plan Blaze (pago por uso con cuota gratuita) en el proyecto Firebase `alfa-materiales`.
2. **Cierre estricto en Firestore Rules:** Se aplica `allow create: if isAdmin();` en `/pedidos` y `allow update: if isAdmin();` en `/contadores/pedidos`.
3. **Umbral de Rate Limiting:** 3 pedidos cada 10 minutos por número de teléfono.

---

## 5. Plan de Verificación

### Pruebas Automatizadas y Linting
- Ejecutar `lint_applet` para confirmar que `firestore.rules` cumple estrictamente las políticas de Firebase.
- Ejecutar `compile_applet` sobre `carrito.js`, `admin.js`, `firebase-init.js` y `pedidos-utils.js`.

### Pruebas de Seguridad y Anti-Fraude (Manuales)
1. **Manipulación de localStorage:**
   - En la consola, modificar `localStorage.setItem('carrito', ...)` con precios a $1.
   - Confirmar el pedido: verificar que la Cloud Function ignora los precios locales, consulta el catálogo real de `/productos`, calcula el total correcto y graba el pedido con `revisionRequerida: true` y ambos totales registrados.
2. **Bloqueo de escritura directa en Firestore:**
   - Ejecutar `await addDoc(collection(db, "pedidos"), { ... })` en consola: debe arrojar error `permission-denied`.
3. **Bloqueo de manipulación de contadores:**
   - Ejecutar `await updateDoc(doc(db, "contadores", "pedidos"), { ... })` en consola: debe arrojar error `permission-denied`.
4. **Verificación de Rate Limiting:**
   - Enviar 4 pedidos consecutivos con el mismo teléfono en menos de 10 minutos: el cuarto pedido debe ser rechazado con el mensaje informativo de límite de pedidos.
5. **Visualización en Panel Admin:**
   - Confirmar que el pedido manipulado muestra el badge de advertencia y los detalles de auditoría en el modal.
