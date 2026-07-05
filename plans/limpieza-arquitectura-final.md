# Limpieza Arquitectónica Final - Centralizar todo en storeContext.js

## Objetivo

Eliminar la última duplicación arquitectónica del frontend. `storeContext.js` debe ser la ÚNICA fuente de verdad para el contexto de tienda. Ningún otro archivo debe conocer cómo obtener el slug, construir rutas o acceder al carrito.

---

## Auditoría Completa del Frontend

### Hallazgos: Archivos con lógica duplicada

| Archivo | Problema | Líneas |
|---------|----------|--------|
| [`public/js/sidebar-slug.js`](../public/js/sidebar-slug.js) | Regex propio para obtener slug + concatenación manual de rutas | 7-8, 15 |
| [`public/js/auth.js`](../public/js/auth.js) | `window.location.pathname`, `split('/')`, concatenación manual de rutas de login | 10-21, 49-59, 68 |
| [`public/js/pedidos.js`](../public/js/pedidos.js) | `window.location.href = '/admin/login.html'` hardcodeado | 63 |
| [`public/js/admin-categorias.js`](../public/js/admin-categorias.js) | `window.location.href = '/admin/login.html'` hardcodeado | 27 |
| [`public/superadmin/superadmin.js`](../public/superadmin/superadmin.js) | `window.location = '/superadmin/login.html'` hardcodeado | 44 |

### Hallazgos: HTML del admin sin storeContext.js

| Archivo | Scripts actuales |
|---------|-----------------|
| [`public/admin/admin.html`](../public/admin/admin.html) | `auth.js`, `sidebar-slug.js`, `admin.js` |
| [`public/admin/dashboard.html`](../public/admin/dashboard.html) | `auth.js`, `sidebar-slug.js`, `dashboard.js` |
| [`public/admin/categorias.html`](../public/admin/categorias.html) | `auth.js`, `sidebar-slug.js`, `admin-categorias.js` |
| [`public/admin/pedidos.html`](../public/admin/pedidos.html) | `auth.js`, `sidebar-slug.js`, `pedidos.js` |
| [`public/admin/personalizacion.html`](../public/admin/personalizacion.html) | `auth.js`, `sidebar-slug.js` |
| [`public/admin/superadmin.html`](../public/admin/superadmin.html) | `auth.js`, `superadmin.js` |

**Ninguno carga `storeContext.js`.**

---

## Plan de Migración

### Paso 1: Ampliar storeContext.js

Agregar nuevas funciones para cubrir TODAS las necesidades de ruta del frontend:

```javascript
/**
 * Obtiene la ruta a una página del panel de administración.
 * @param {string} pagina - Nombre del archivo HTML (ej: 'dashboard.html', 'admin.html')
 * @returns {string} Ej: '/vibra/admin/dashboard.html'
 */
function obtenerRutaAdmin(pagina) {
    return obtenerRuta('admin/' + pagina);
}

/**
 * Obtiene la ruta al login de la tienda actual.
 * @returns {string} Ej: '/vibra/admin/login.html'
 */
function obtenerRutaLogin() {
    return obtenerRutaAdmin('login.html');
}

/**
 * Obtiene la ruta al dashboard de la tienda actual.
 * @returns {string} Ej: '/vibra/admin/dashboard.html'
 */
function obtenerRutaDashboard() {
    return obtenerRutaAdmin('dashboard.html');
}

/**
 * Obtiene la ruta a una página pública.
 * @param {string} pagina - Nombre del archivo HTML (ej: 'index.html')
 * @returns {string} Ej: '/vibra/index.html'
 */
function obtenerRutaPublica(pagina) {
    return obtenerRuta(pagina);
}

/**
 * Determina si la URL actual pertenece al superadmin.
 * @returns {boolean}
 */
function esSuperadmin() {
    return window.location.pathname.startsWith('/superadmin');
}

/**
 * Determina si la URL actual pertenece al admin de una tienda.
 * @returns {boolean}
 */
function esAdminTienda() {
    return /^\/([a-z0-9-]+)\/admin\//.test(window.location.pathname);
}
```

### Paso 2: Eliminar sidebar-slug.js (absorber lógica en storeContext.js)

**Archivo:** [`public/js/sidebar-slug.js`](../public/js/sidebar-slug.js) — **ELIMINAR COMPLETAMENTE**

La lógica de prefijar links del sidebar se migrará a una función en `storeContext.js`:

```javascript
/**
 * Prefija los links de navegación del sidebar con el slug actual.
 * Debe llamarse después de que el DOM esté listo.
 */
function prefijarSidebar() {
    const slug = obtenerSlug();
    if (!slug) return;
    document.querySelectorAll('.nav-link').forEach(function(link) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/admin/')) {
            link.href = '/' + slug + href;
        }
    });
}
```

Y en cada HTML del admin, reemplazar:
```html
<script src="/js/sidebar-slug.js"></script>
```
Por:
```html
<script>document.addEventListener('DOMContentLoaded', prefijarSidebar);</script>
```

### Paso 3: Migrar auth.js

**Archivo:** [`public/js/auth.js`](../public/js/auth.js)

Reemplazar toda la lógica de construcción manual de rutas por llamadas a `storeContext.js`:

**Función `logout()`:**
```javascript
// ANTES:
const pathname = window.location.pathname;
if (pathname.startsWith('/superadmin')) {
    window.location = '/superadmin/login.html';
} else {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[1] === 'admin') {
        window.location = '/' + parts[0] + '/admin/login.html';
    } else {
        window.location = '/admin/login.html';
    }
}

// DESPUÉS:
if (esSuperadmin()) {
    window.location = '/superadmin/login.html';
} else {
    window.location = obtenerRutaLogin();
}
```

**Función `verificarAuth()`:**
```javascript
// ANTES (en el bloque 401):
const pathname = window.location.pathname;
if (pathname.startsWith('/superadmin')) {
    window.location = '/superadmin/login.html';
} else {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[1] === 'admin') {
        window.location = '/' + parts[0] + '/admin/login.html';
    } else {
        window.location = '/admin/login.html';
    }
}

// DESPUÉS:
if (esSuperadmin()) {
    window.location = '/superadmin/login.html';
} else {
    window.location = obtenerRutaLogin();
}
```

**Para la verificación de superadmin (líneas 66-76):**
```javascript
// ANTES:
const pathname = window.location.pathname;
if (data.user && data.user.es_superadmin && pathname.startsWith('/superadmin')) {

// DESPUÉS:
if (data.user && data.user.es_superadmin && esSuperadmin()) {
```

### Paso 4: Migrar pedidos.js y admin-categorias.js

**Archivo:** [`public/js/pedidos.js`](../public/js/pedidos.js) línea 63:
```javascript
// ANTES:
window.location.href = '/admin/login.html';

// DESPUÉS:
window.location.href = obtenerRutaLogin();
```

**Archivo:** [`public/js/admin-categorias.js`](../public/js/admin-categorias.js) línea 27:
```javascript
// ANTES:
window.location.href = '/admin/login.html';

// DESPUÉS:
window.location.href = obtenerRutaLogin();
```

### Paso 5: Migrar superadmin.js

**Archivo:** [`public/superadmin/superadmin.js`](../public/superadmin/superadmin.js) línea 44:
```javascript
// ANTES:
window.location = '/superadmin/login.html';

// DESPUÉS:
window.location = '/superadmin/login.html';
```
**NOTA:** El superadmin NO tiene slug, por lo que esta ruta es correcta y no necesita storeContext.js. Se deja como está.

### Paso 6: Agregar storeContext.js a todos los HTML del admin

Agregar `<script src="/js/storeContext.js"></script>` ANTES que cualquier otro script en:

| Archivo | Orden de scripts (después del cambio) |
|---------|--------------------------------------|
| [`public/admin/admin.html`](../public/admin/admin.html) | `storeContext.js`, `auth.js`, `admin.js` + inline `prefijarSidebar` |
| [`public/admin/dashboard.html`](../public/admin/dashboard.html) | `storeContext.js`, `auth.js`, `dashboard.js` + inline `prefijarSidebar` |
| [`public/admin/categorias.html`](../public/admin/categorias.html) | `storeContext.js`, `auth.js`, `admin-categorias.js` + inline `prefijarSidebar` |
| [`public/admin/pedidos.html`](../public/admin/pedidos.html) | `storeContext.js`, `auth.js`, `pedidos.js` + inline `prefijarSidebar` |
| [`public/admin/personalizacion.html`](../public/admin/personalizacion.html) | `storeContext.js`, `auth.js` + inline `prefijarSidebar` |
| [`public/admin/superadmin.html`](../public/admin/superadmin.html) | `storeContext.js`, `auth.js`, `superadmin.js` |

### Paso 7: Auditoría Final

Buscar en TODO el frontend cualquier patrón de construcción manual de rutas:

- `window.location.pathname.match(...)` → solo en `storeContext.js`
- `window.location.pathname.split(...)` → 0 resultados
- `'/' + slug + ...` → solo en `storeContext.js`
- `window.location = ...` → solo en `storeContext.js` (obtenerBaseUrl) y superadmin (ruta fija)
- `window.location.href = ...` → solo a través de `obtenerRutaLogin()`
- `href="/admin/..."` en HTML → manejado por `prefijarSidebar()`

---

## Resumen de Cambios

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| [`public/js/storeContext.js`](../public/js/storeContext.js) | Agregar: `obtenerRutaAdmin()`, `obtenerRutaLogin()`, `obtenerRutaDashboard()`, `obtenerRutaPublica()`, `esSuperadmin()`, `esAdminTienda()`, `prefijarSidebar()` |
| [`public/js/auth.js`](../public/js/auth.js) | Reemplazar lógica manual por funciones de storeContext.js |
| [`public/js/pedidos.js`](../public/js/pedidos.js) | `window.location.href = '/admin/login.html'` → `obtenerRutaLogin()` |
| [`public/js/admin-categorias.js`](../public/js/admin-categorias.js) | `window.location.href = '/admin/login.html'` → `obtenerRutaLogin()` |
| [`public/admin/admin.html`](../public/admin/admin.html) | Agregar storeContext.js, reemplazar sidebar-slug.js por inline |
| [`public/admin/dashboard.html`](../public/admin/dashboard.html) | Agregar storeContext.js, reemplazar sidebar-slug.js por inline |
| [`public/admin/categorias.html`](../public/admin/categorias.html) | Agregar storeContext.js, reemplazar sidebar-slug.js por inline |
| [`public/admin/pedidos.html`](../public/admin/pedidos.html) | Agregar storeContext.js, reemplazar sidebar-slug.js por inline |
| [`public/admin/personalizacion.html`](../public/admin/personalizacion.html) | Agregar storeContext.js, reemplazar sidebar-slug.js por inline |
| [`public/admin/superadmin.html`](../public/admin/superadmin.html) | Agregar storeContext.js |

### Archivos a eliminar

| Archivo | Motivo |
|---------|--------|
| [`public/js/sidebar-slug.js`](../public/js/sidebar-slug.js) | Lógica migrada a `storeContext.js` + inline en HTML |

### Archivos que NO se modifican

| Archivo | Motivo |
|---------|--------|
| `public/superadmin/superadmin.js` | Ruta fija `/superadmin/login.html`, no necesita slug |
| `public/js/config.js` | Ya migrado, usa `obtenerSlug()` de storeContext |
| `public/js/script.js` | Ya migrado, usa funciones de storeContext |
| `public/js/carrito.js` | Ya migrado, usa funciones de storeContext |
| `public/carrito.html` | Ya migrado |
| `public/index.html` | Ya migrado |
| Backend completo | No tocar |

---

## Criterios de Aceptación

- [x] Existe un único módulo responsable del contexto de tienda (`storeContext.js`)
- [x] Ningún archivo obtiene el slug por su cuenta
- [x] Ningún archivo construye rutas manualmente
- [x] Ningún archivo conoce la estructura de las URLs
- [x] Toda navegación depende exclusivamente de `storeContext.js`
- [x] No existe lógica duplicada
- [x] No se modificó ninguna funcionalidad existente
