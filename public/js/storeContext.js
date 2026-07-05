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

    // Limpiar la ruta: quitar slash inicial
    ruta = (ruta || '').replace(/^\//, '');
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

// ============================================
// RUTAS DEL PANEL DE ADMINISTRACIÓN
// ============================================

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
 * Construye una ruta usando un slug explícito (no de la URL).
 * Útil cuando el slug proviene del servidor (ej: login response).
 * @param {string} slug - Slug explícito (ej: 'vibra')
 * @param {string} ruta - Ruta relativa (ej: 'admin/dashboard.html')
 * @returns {string} Ej: '/vibra/admin/dashboard.html'
 */
function obtenerRutaConSlug(slug, ruta) {
    if (!slug) return '/' + (ruta || '');
    ruta = (ruta || '').replace(/^\//, '');
    return ruta ? '/' + slug + '/' + ruta : '/' + slug + '/';
}

// ============================================
// DETECCIÓN DE CONTEXTO
// ============================================

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

// ============================================
// SIDEBAR (prefijar links con slug)
// ============================================

/**
 * Prefija los links de navegación del sidebar con el slug actual.
 * Debe llamarse después de que el DOM esté listo (DOMContentLoaded).
 * Los links deben tener la clase 'nav-link' y href comenzando con '/admin/'.
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
