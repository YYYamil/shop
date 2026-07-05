# Plan de Refactorización Arquitectónica

## Objetivo

Eliminar completamente la arquitectura heredada de tienda única. La URL debe ser la única fuente de verdad para determinar la tienda activa. Toda la navegación pública debe permanecer siempre dentro del slug correspondiente.

**Backend no se modifica en esta etapa.**

---

## FASE 0: Análisis Completo

### Resumen de hallazgos

#### 1. Enlaces a `/` (deben cambiar a `/:slug/`)

| Archivo | Línea | Uso |
|---------|-------|-----|
| [`public/js/config.js`](../public/js/config.js) | 259 | `href="/"` en logo (con imagen) |
| [`public/js/config.js`](../public/js/config.js) | 269 | `href="/"` en logo (solo texto) |
| [`public/carrito.html`](../public/carrito.html) | 23 | `href="/"` en logo del header |
| [`public/carrito.html`](../public/carrito.html) | 28 | `href="/"` en botón "Volver" |
| [`public/carrito.html`](../public/carrito.html) | 61 | `href="/"` en carrito vacío "Ir a la tienda" |

#### 2. Enlaces a `/carrito.html` (deben cambiar a `/:slug/carrito.html`)

| Archivo | Línea | Uso |
|---------|-------|-----|
| [`public/carrito.html`](../public/carrito.html) | 32 | `href="/carrito.html"` en navbar |
| [`public/js/script.js`](../public/js/script.js) | 820 | `href="/carrito.html"` en preview carrito |

#### 3. Redirecciones

| Archivo | Línea | Código |
|---------|-------|--------|
| [`public/js/carrito.js`](../public/js/carrito.js) | 401 | `window.location = '/'` al finalizar compra |

#### 4. localStorage con clave global `'carrito'`

| Archivo | Línea | Operación |
|---------|-------|-----------|
| [`public/js/script.js`](../public/js/script.js) | 35-39 | `localStorage.getItem('carrito')` - lectura inicial |
| [`public/js/script.js`](../public/js/script.js) | 637-643 | `localStorage.setItem('carrito', ...)` - guardar |
| [`public/js/carrito.js`](../public/js/carrito.js) | 29-33 | `localStorage.getItem('carrito')` - lectura inicial |
| [`public/js/carrito.js`](../public/js/carrito.js) | 37-47 | `localStorage.setItem('carrito', ...)` - guardar |
| [`public/js/carrito.js`](../public/js/carrito.js) | 399 | `localStorage.removeItem('carrito')` - eliminar al finalizar |

#### 5. Funciones `obtenerSlug()`

| Archivo | Línea | Definición/Uso |
|---------|-------|----------------|
| [`public/js/config.js`](../public/js/config.js) | 7-12 | **Definición** de `obtenerSlug()` |
| [`public/js/config.js`](../public/js/config.js) | 29 | Uso en `cargarConfiguracion()` |
| [`public/js/config.js`](../public/js/config.js) | 352 | Uso en `renderizarCategorias()` |
| [`public/js/script.js`](../public/js/script.js) | 240 | Uso en `compartirProducto()` |
| [`public/js/script.js`](../public/js/script.js) | 324 | Uso en `cargarProductos()` |
| [`public/js/carrito.js`](../public/js/carrito.js) | 367 | Uso en `finalizarCompra()` |

#### 6. Fetch relacionados al carrito

| Archivo | Línea | URL |
|---------|-------|-----|
| [`public/js/carrito.js`](../public/js/carrito.js) | 368-369 | `POST /pedidos?slug=...` |

---

## FASE 1: Módulo Central de Contexto

### Archivo a crear: [`public/js/storeContext.js`](../public/js/storeContext.js)

**Justificación del nombre:** `storeContext.js` es más semántico que `slug.js` porque este módulo no solo obtiene el slug, sino que es el **único responsable** de todo el contexto de la tienda: rutas, almacenamiento del carrito, y cualquier otra responsabilidad futura.

```javascript
/* ============================================
   storeContext.js - Módulo Central de Contexto
   ============================================
   Único responsable de la lógica relacionada
   con la tienda activa. La URL es la única
   fuente de verdad.
   
   Ningún otro archivo debe:
   - Construir rutas manualmente
   - Acceder a localStorage para el carrito
   - Extraer el slug directamente
   ============================================ */

/**
 * Obtiene el slug de la tienda desde la URL actual.
 * @returns {string|null} Ej: 'vibra' o null si no hay slug
 */
function obtenerSlug() {
    const match = window.location.pathname.match(/^\/([a-z0-9-]+)(?:\/|$)/);
    return match ? match[1] : null;
}

/**
 * Obtiene la URL base de la tienda actual.
 * @returns {string} Ej: '/vibra/' o '/' si no hay slug
 */
function obtenerBaseUrl() {
    const slug = obtenerSlug();
    return slug ? '/' + slug + '/' : '/';
}

/**
 * Construye una ruta pública respetando el contexto de la tienda.
 * Es la ÚNICA función autorizada para construir rutas.
 * 
 * @param {string} ruta - Ruta relativa (ej: 'carrito.html', 'admin/login.html')
 * @returns {string} Ruta completa con slug (ej: '/vibra/carrito.html')
 * 
 * Ejemplos:
 *   obtenerRuta('carrito.html')    → '/vibra/carrito.html'
 *   obtenerRuta('')                → '/vibra/'
 *   obtenerRuta('/')               → '/vibra/'
 */
function obtenerRuta(ruta) {
    const slug = obtenerSlug();
    if (!slug) return '/' + (ruta || '');
    
    // Limpiar la ruta
    ruta = (ruta || '').replace(/^\//, ''); // quitar slash inicial
    return ruta ? '/' + slug + '/' + ruta : '/' + slug + '/';
}

/**
 * Obtiene la ruta completa al carrito de la tienda actual.
 * @returns {string} Ej: '/vibra/carrito.html'
 */
function obtenerRutaCarrito() {
    return obtenerRuta('carrito.html');
}

// ============================================
// GESTIÓN DEL CARRITO (localStorage)
// ============================================

/**
 * Obtiene la clave de localStorage para el carrito de la tienda actual.
 * @returns {string} Ej: 'carrito_vibra'
 */
function obtenerClaveCarrito() {
    const slug = obtenerSlug();
    return 'carrito_' + (slug || 'default');
}

/**
 * Obtiene el carrito desde localStorage.
 * @returns {Array} Array de productos del carrito
 */
function obtenerCarrito() {
    try {
        return JSON.parse(localStorage.getItem(obtenerClaveCarrito())) || [];
    } catch (e) {
        return [];
    }
}

/**
 * Guarda el carrito en localStorage.
 * @param {Array} carrito - Array de productos
 */
function guardarCarrito(carrito) {
    localStorage.setItem(obtenerClaveCarrito(), JSON.stringify(carrito));
}

/**
 * Elimina el carrito de la tienda actual del localStorage.
 */
function eliminarCarrito() {
    localStorage.removeItem(obtenerClaveCarrito());
}
```

### Carga en HTML

**`public/index.html`** - Agregar ANTES que cualquier otro script:
```html
<script src="/js/storeContext.js?v=1"></script>
<script src="/js/config.js?v=6"></script>
<script src="/js/script.js?v=6"></script>
```

**`public/carrito.html`** - Agregar ANTES que cualquier otro script:
```html
<script src="/js/storeContext.js?v=1"></script>
<script src="/js/config.js?v=2"></script>
<script src="/js/carrito.js?v=2"></script>
```

---

## FASE 2: Migrar config.js

### Archivo: [`public/js/config.js`](../public/js/config.js)

**Cambio 2.1 - Eliminar función `obtenerSlug()` (líneas 7-12):**
Esta función se migra a `storeContext.js`. Eliminar la definición local.

**Cambio 2.2 - Reemplazar `href="/"` en logo con imagen (líneas 258-263):**
```javascript
// ANTES:
logo.innerHTML = `
    <a href="/" class="logo-link">
        <img src="${config.logo_imagen}" alt="${nombre}" class="${formaClase}">
        <span class="logo-nombre">${nombre}</span>
    </a>
`;

// DESPUÉS:
logo.innerHTML = `
    <a href="${obtenerBaseUrl()}" class="logo-link">
        <img src="${config.logo_imagen}" alt="${nombre}" class="${formaClase}">
        <span class="logo-nombre">${nombre}</span>
    </a>
`;
```

**Cambio 2.3 - Reemplazar `href="/"` en logo solo texto (líneas 268-270):**
```javascript
// ANTES:
logo.innerHTML = `
    <a href="/" class="logo-link-solo">${nombre}</a>
`;

// DESPUÉS:
logo.innerHTML = `
    <a href="${obtenerBaseUrl()}" class="logo-link-solo">${nombre}</a>
`;
```

---

## FASE 3: Migrar script.js

### Archivo: [`public/js/script.js`](../public/js/script.js)

**Cambio 3.1 - Reemplazar lectura de localStorage (líneas 35-39):**
```javascript
// ANTES:
let carrito = JSON.parse(
    localStorage.getItem('carrito')
) || [];

// DESPUÉS:
let carrito = obtenerCarrito();
```

**Cambio 3.2 - Reemplazar escritura de localStorage en `agregarCarrito()` (líneas 637-643):**
```javascript
// ANTES:
localStorage.setItem(
    'carrito',
    JSON.stringify(carrito)
);

// DESPUÉS:
guardarCarrito(carrito);
```

**Cambio 3.3 - Reemplazar enlace del preview carrito (línea 820):**
```javascript
// ANTES:
html += `<a href="/carrito.html" class="carrito-preview-ver">Ver carrito</a>`;

// DESPUÉS:
html += `<a href="${obtenerRutaCarrito()}" class="carrito-preview-ver">Ver carrito</a>`;
```

---

## FASE 4: Migrar carrito.js

### Archivo: [`public/js/carrito.js`](../public/js/carrito.js)

**Cambio 4.1 - Reemplazar lectura de localStorage (líneas 29-33):**
```javascript
// ANTES:
let carrito = JSON.parse(
    localStorage.getItem('carrito')
) || [];

// DESPUÉS:
let carrito = obtenerCarrito();
```

**Cambio 4.2 - Reemplazar función `guardarCarrito()` (líneas 37-47):**
```javascript
// ANTES:
function guardarCarrito() {
    localStorage.setItem(
        'carrito',
        JSON.stringify(carrito)
    );
}

// DESPUÉS:
function guardarCarritoLocal() {
    guardarCarrito(carrito);
}
```

Y reemplazar TODAS las llamadas internas a `guardarCarrito()` por `guardarCarritoLocal()`.

**Cambio 4.3 - Reemplazar `localStorage.removeItem('carrito')` (línea 399):**
```javascript
// ANTES:
localStorage.removeItem('carrito');

// DESPUÉS:
eliminarCarrito();
```

**Cambio 4.4 - Reemplazar `window.location = '/'` (línea 401):**
```javascript
// ANTES:
window.location = '/';

// DESPUÉS:
window.location = obtenerBaseUrl();
```

**Cambio 4.5 - Simplificar fetch de pedidos (líneas 367-368):**
```javascript
// ANTES:
const slug = window.obtenerSlug ? obtenerSlug() : null;
const url = slug ? '/pedidos?slug=' + slug : '/pedidos';

// DESPUÉS:
const slug = obtenerSlug();
const url = slug ? '/pedidos?slug=' + slug : '/pedidos';
```
Ya no necesita el fallback `window.obtenerSlug` porque `storeContext.js` se carga siempre.

---

## FASE 5: Migrar carrito.html

### Archivo: [`public/carrito.html`](../public/carrito.html)

**No se usa JavaScript inline.** En su lugar, se agrega un pequeño script al final del `<body>` (después de cargar los JS) que reescribe los enlaces:

```html
<script src="/js/storeContext.js?v=1"></script>
<script src="/js/config.js?v=2"></script>
<script src="/js/carrito.js?v=2"></script>
<script>
    // Reescribir enlaces del HTML estático según el contexto de la tienda
    document.addEventListener('DOMContentLoaded', function() {
        var baseUrl = obtenerBaseUrl();
        var rutaCarrito = obtenerRutaCarrito();
        
        // Logo
        var logoLink = document.querySelector('.logo a');
        if (logoLink) logoLink.href = baseUrl;
        
        // Botón volver
        var btnVolver = document.querySelector('.btn-ir-tienda');
        if (btnVolver) btnVolver.href = baseUrl;
        
        // Enlace carrito en navbar
        var carritoLink = document.querySelector('.carrito-btn');
        if (carritoLink) carritoLink.href = rutaCarrito;
        
        // Carrito vacío - "Ir a la tienda"
        var vacioLink = document.querySelector('.carrito-vacio a');
        if (vacioLink) vacioLink.href = baseUrl;
    });
</script>
```

---

## FASE 6: Validación

### Checklist

- [ ] `/:slug/` - Tienda carga correctamente
- [ ] **Logo** - Redirige a `/:slug/`
- [ ] **Agregar producto** - Se guarda en `carrito_{slug}` en localStorage
- [ ] **Contador** - Muestra solo items de esa tienda
- [ ] **Preview carrito** - "Ver carrito" apunta a `/:slug/carrito.html`
- [ ] **`/:slug/carrito.html`** - Carga correctamente
- [ ] **Modificar cantidades** - Actualiza solo `carrito_{slug}`
- [ ] **Eliminar producto** - Elimina solo de `carrito_{slug}`
- [ ] **Carrito vacío** - "Ir a la tienda" va a `/:slug/`
- [ ] **Finalizar compra** - Redirige a `/:slug/`
- [ ] **Cambiar de tienda** - Carritos independientes
- [ ] **Admin** - `/:slug/admin/...` funciona
- [ ] **Superadmin** - `/superadmin/` funciona
- [ ] **No existe clave global "carrito"** en localStorage
- [ ] **No hay llamadas directas a localStorage** fuera de storeContext.js

---

## FASE 7: Limpieza

Después de validar:

- [ ] Eliminar función `obtenerSlug()` duplicada de [`config.js`](../public/js/config.js)
- [ ] Verificar que no queden referencias a `localStorage` con clave `'carrito'`
- [ ] Verificar que no queden `href="/"` en navegación pública
- [ ] Verificar que no queden `window.location = '/'`

---

## FASE 8: Revisión del Backend (solo informe)

**Fecha:** 2026-07-04
**Estado:** Solo análisis, sin modificaciones.

### Archivo analizado: [`middleware/tiendaMiddleware.js`](../middleware/tiendaMiddleware.js)

#### Arquitectura actual (6 mecanismos de detección)

El middleware implementa 6 pasos secuenciales para determinar la tienda activa:

| Paso | Mecanismo | Prioridad | Descripción |
|------|-----------|-----------|-------------|
| 1 | URL path (`/:slug/...`) | Máxima | Detecta slug directamente del path de la petición |
| 2 | Referer header | Alta | Para peticiones API/AJAX sin slug en URL |
| 3 | Sesión de usuario autenticado | Media | Usa `req.session.user.tienda_id` |
| 4 | Sesión de visitante | Media-baja | Usa `req.session.tiendaSlugVisitante` (guardado en paso 1 o 2) |
| 5 | Query param (`?slug=...`) | Baja | Para rutas API como `/productos/public?slug=tienda1` |
| 6 | Fallback a tienda por defecto | Mínima | Usa `tienda1` como último recurso |

#### Análisis de cada mecanismo

**Paso 1 (URL path):** ✅ Sigue siendo necesario. Es el mecanismo principal y el que tiene máxima prioridad. Detecta el slug de rutas como `/:slug/`, `/:slug/admin/...`, etc.

**Paso 2 (Referer):** ⚠️ **Potencialmente obsoleto.** Este mecanismo existe porque antes las peticiones AJAX a APIs (como `POST /pedidos`) no tenían el slug en la URL. Con la migración frontend, las rutas ahora se construyen con `obtenerRuta()` que incluye el slug. Sin embargo, las rutas del backend (`/pedidos`, `/productos`, etc.) aún no están bajo `/:slug/api/...`, por lo que el Referer sigue siendo útil para peticiones que no incluyen slug en la URL.

**Paso 3 (Sesión usuario):** ✅ Necesario para usuarios autenticados en el admin que navegan entre páginas.

**Paso 4 (Sesión visitante):** ⚠️ **Potencialmente obsoleto.** Este mecanismo almacena el slug en sesión cuando un visitante entra por primera vez, para que recursos estáticos (JS, CSS, imágenes) puedan saber a qué tienda pertenecen. Con la migración frontend, el slug se obtiene directamente de la URL via `obtenerSlug()`, por lo que este mecanismo podría no ser necesario para recursos estáticos.

**Paso 5 (Query param):** ⚠️ **Potencialmente obsoleto a futuro.** Actualmente, rutas como `/productos/public?slug=tienda1` se usan desde `cargarProductos()` en script.js. Si en el futuro las APIs se migran a `/:slug/api/productos/public`, este mecanismo dejaría de ser necesario.

**Paso 6 (Fallback):** ⚠️ **Obsoleto para frontend.** Con `storeContext.js`, si no hay slug en la URL, `obtenerSlug()` devuelve `null` y las rutas se construyen sin slug. El frontend ya no depende de una tienda por defecto.

#### Recomendaciones (para una futura fase)

1. **Eliminar Paso 2 (Referer):** Cuando las rutas API se migren a `/:slug/api/...`, el Referer ya no será necesario porque el slug estará siempre en la URL de la petición.
2. **Eliminar Paso 4 (Sesión visitante):** El frontend ya no necesita que el servidor recuerde el slug del visitante, ya que `obtenerSlug()` lo extrae directamente de la URL.
3. **Eliminar o simplificar Paso 6 (Fallback):** Si no hay slug, el middleware debería devolver `null` en lugar de asumir `tienda1`.
4. **Migrar rutas API a `/:slug/api/...`:** Este es el cambio más grande. Implicaría modificar `server.js` para agregar rutas como `/:slug/api/productos`, `/:slug/api/pedidos`, etc., y que los controladores ya no necesiten detectar el slug por otros medios.

#### Conclusión

El backend actual funciona correctamente con la migración frontend. Los pasos 1, 3 y 5 siguen siendo necesarios. Los pasos 2, 4 y 6 son redundantes para el nuevo frontend pero no causan problemas. Se recomienda revisarlos en una fase futura cuando se decida migrar las rutas API a `/:slug/api/...`.

**No se realizaron modificaciones en esta fase.**

---

## Resumen de Archivos

### Archivo nuevo
| Archivo | Propósito |
|---------|-----------|
| [`public/js/storeContext.js`](../public/js/storeContext.js) | Módulo central de contexto de tienda |

### Archivos a modificar
| Archivo | Cambios |
|---------|---------|
| [`public/index.html`](../public/index.html) | Agregar `<script src="/js/storeContext.js">` |
| [`public/carrito.html`](../public/carrito.html) | Agregar storeContext.js + script de reescritura de enlaces |
| [`public/js/config.js`](../public/js/config.js) | Eliminar `obtenerSlug()` duplicada + `href="/"` → `obtenerBaseUrl()` |
| [`public/js/script.js`](../public/js/script.js) | `localStorage` → `obtenerCarrito()`/`guardarCarrito()` + preview link → `obtenerRutaCarrito()` |
| [`public/js/carrito.js`](../public/js/carrito.js) | `localStorage` → funciones storeContext + redirect → `obtenerBaseUrl()` |

### Archivos que NO se modifican
| Archivo | Motivo |
|---------|--------|
| `middleware/tiendaMiddleware.js` | Backend, revisión póstuma |
| Todos los controladores | Backend, no tocar |
| Todas las rutas | Backend, no tocar |
| `public/js/auth.js` | Autenticación, no tocar |
| `public/js/admin.js` | Admin, no necesita cambios |
| `public/js/pedidos.js` | No relacionado |
| `public/js/dashboard.js` | No relacionado |
| `public/admin/*.html` | Admin, ya usan slug |

### Cambio adicional en backend (solo routing público)

Se agregó una ruta en [`server.js`](../server.js) para servir páginas HTML públicas bajo `/:slug/:file`:

```javascript
// /:slug/:file - Sirve páginas HTML públicas de una tienda específica
// Ej: /tienda1/carrito.html, /tienda1/index.html
app.get('/:slug/:file', (req, res, next) => {
    const { slug, file } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    // Solo servir archivos HTML públicos (no admin, no rutas conocidas)
    const rutasConocidas = ['admin', 'api', 'auth', 'superadmin', 'uploads'];
    if (rutasConocidas.includes(file)) {
        return next();
    }
    if (!file.endsWith('.html')) {
        return next();
    }
    const filePath = path.join(__dirname, 'public', file);
    if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(filePath);
    } else {
        next();
    }
});
```

Esta ruta se registra ANTES de `/:slug/` y `/:slug` para que Express la matchee primero. Solo sirve archivos `.html` públicos y excluye rutas conocidas como `admin`, `api`, `auth`, etc.
