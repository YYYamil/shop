# Plan de Mejoras - Shop para Emprendimientos

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `public/index.html` | Limpiar div de prueba, agregar estructura para menú hamburguesa, modal, toast |
| `public/css/store.css` | Estilos para toast, skeleton, modal, menú hamburguesa, badges, preview carrito, responsividad |
| `public/js/script.js` | Toast, skeleton, modal, debounce, badges, preview carrito |

---

## Tarea 1: Toast notification
**Archivos**: `public/css/store.css` + `public/js/script.js`
- Crear función `mostrarToast(mensaje)` que:
  - Crea un div `.toast` con el mensaje
  - Lo agrega al body
  - Lo elimina después de 2.5s con fade out
- Estilos: posición fija abajo-centro, fondo oscuro, texto blanco, border-radius, animación fade in/out
- Reemplazar `alert('Producto agregado')` por `mostrarToast('✓ Producto agregado al carrito')`
- Reemplazar `alert('Producto sin stock')` por `mostrarToast('✗ Producto sin stock')`
- Reemplazar `alert('Stock máximo alcanzado')` por `mostrarToast('✗ Stock máximo alcanzado')`

## Tarea 2: Limpiar HTML
**Archivo**: `public/index.html`
- Eliminar línea 113-115: `<div class="bg-black text-white p-4 rounded-xl">Tailwind funcionando</div>`

## Tarea 3: Skeleton loading
**Archivos**: `public/css/store.css` + `public/js/script.js`
- En `cargarProductos()`:
  - Antes del fetch, llamar a `mostrarSkeleton()`
  - Después del fetch, llamar a `ocultarSkeleton()`
- Función `mostrarSkeleton()`: llenar `#productos` con 6 divs `.skeleton-card`
- Función `ocultarSkeleton()`: limpiar `#productos`
- Estilos skeleton: fondo gris claro con animación de shimmer (gradiente móvil)

## Tarea 4: Modal lightbox
**Archivos**: `public/css/store.css` + `public/js/script.js`
- En `renderizarCarrusel()`, agregar `onclick="abrirModal(this.src)"` a cada `<img>`
- Función `abrirModal(src)`:
  - Crear div `.modal-overlay` con una `<img>` y botón cerrar
  - Agregar al body
  - Cerrar al hacer clic fuera o en la X
- Estilos modal: overlay negro semitransparente, imagen centrada con max-width/height, transición

## Tarea 5: Búsqueda con debounce
**Archivo**: `public/js/script.js`
- Crear variable `let timeoutBusqueda`
- En `buscarProductos()`:
  - Limpiar timeout anterior
  - Setear nuevo timeout de 300ms
  - Dentro del timeout: ejecutar la búsqueda actual
- Si no hay resultados, mostrar mensaje "No se encontraron productos" en la grilla

## Tarea 6: Menú hamburguesa responsive
**Archivos**: `public/index.html` + `public/css/store.css` + `public/js/script.js`
- En HTML: agregar botón hamburguesa (☰) en la navbar, antes del input de búsqueda
- Envolver input y carrito en un div `.nav-menu` que se oculta/muestra
- En CSS: `.nav-menu` oculto en mobile, visible al hacer clic en hamburguesa
- En JS: función `toggleMenu()` que alterna clase `.active` en `.nav-menu`

## Tarea 7: Badges en productos
**Archivo**: `public/js/script.js`
- En `renderizarProductos()`, dentro del template de cada producto:
  - Si `producto.descuento` existe: mostrar badge rojo con "-{descuento}%"
  - Si `producto.nuevo` es true: mostrar badge azul con "NUEVO"
- Estilos en CSS para `.badge-descuento` y `.badge-nuevo`

## Tarea 8: Preview del carrito al hover
**Archivos**: `public/css/store.css` + `public/js/script.js`
- En el HTML, el enlace del carrito debe tener un contenedor `.carrito-preview`
- En JS: al hacer hover sobre el carrito, mostrar un popup con los productos
- En CSS: `.carrito-preview` posicionado absoluto, oculto por defecto, visible en hover

## Tarea 9: Responsividad mobile
**Archivo**: `public/css/store.css`
- Mejorar media query existente `@media(max-width: 700px)`:
  - Hero: reducir padding y font-size
  - Productos grid: reducir gap y padding
  - Tarjetas de producto: mejor adaptación
  - Carrusel: altura reducida a 180px
  - Input búsqueda: ancho completo
  - Categorías: scroll horizontal si es necesario
