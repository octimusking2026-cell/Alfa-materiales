# Security Specification - Alfa Materiales

## Data Invariants
1. **Productos (`/productos/{productoId}`)**:
   - Lectura pública: Cualquier usuario (incluso no autenticado) puede ver el catálogo de productos (`allow read: if true;`).
   - Modificación restringida: Solo el usuario administrador autenticado (`request.auth != null`) puede crear, modificar o eliminar productos.
   - Validación estricta: `nombre` (string 1-150 chars), `precio` (número >= 0), `categoria` (in ['ladrillos', 'aridos', 'otros']), `imagen` (string 1-500 chars).
   - Inmutabilidad de timestamps: `createdAt` se establece en la creación con `request.time`. `updatedAt` se actualiza con `request.time`.

2. **Pedidos (`/pedidos/{pedidoId}`)**:
   - Creación pública: Cualquier cliente desde el frontend público (incluso no autenticado) puede registrar un pedido (`allow create: if true` con validación exhaustiva de payload).
   - Confidencialidad absoluta: Ningún cliente no autenticado ni terceros pueden leer, listar, buscar (`get`, `list`), modificar ni eliminar ningún pedido (`allow read, update, delete: if isSignedIn();`).
   - Validación de Pedido: `items` (lista de 1 a 50 items), `total` (número >= 0), `createdAt` (`request.time`).

## Dirty Dozen Payloads (Designed to Fail)
1. **Unauthenticated Product Creation**: An unauthenticated user attempts to create a product. (Expected: PERMISSION_DENIED)
2. **Unauthenticated Product Deletion**: An unauthenticated user attempts to delete a product. (Expected: PERMISSION_DENIED)
3. **Invalid Product Category**: Authenticated user sends a product with category "electronica" instead of allowlisted categories. (Expected: PERMISSION_DENIED)
4. **Negative Product Price**: Authenticated user sends a product with price -500. (Expected: PERMISSION_DENIED)
5. **Ghost Field in Product**: Authenticated user sends `isAdmin: true` inside a product document. (Expected: PERMISSION_DENIED)
6. **Public Order Inspection (List)**: Unauthenticated visitor queries `/pedidos` to read other customers' orders. (Expected: PERMISSION_DENIED)
7. **Public Order Get**: Unauthenticated visitor tries to direct-read `/pedidos/{orderId}`. (Expected: PERMISSION_DENIED)
8. **Public Order Deletion**: Unauthenticated visitor tries to delete an order. (Expected: PERMISSION_DENIED)
9. **Order with Empty Items**: Client sends an order with an empty `items: []` list. (Expected: PERMISSION_DENIED)
10. **Order with Negative Total**: Client sends an order with `total: -100`. (Expected: PERMISSION_DENIED)
11. **Order with Fabricated Timestamp**: Client sends `createdAt: "1999-01-01"` instead of `request.time`. (Expected: PERMISSION_DENIED)
12. **Malicious ID Injection**: A write request with an ID longer than 128 characters or containing illegal characters. (Expected: PERMISSION_DENIED)
