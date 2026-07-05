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
