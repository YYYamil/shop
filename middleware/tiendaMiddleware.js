// middleware/tiendaMiddleware.js
// Detecta el slug de la tienda desde la URL y lo asigna a req.tiendaSlug
// También extrae tienda_id de la sesión si el usuario está autenticado

const db = require('../database/db');

function tiendaMiddleware(req, res, next) {
    // 0. Si la ruta es /superadmin, no aplicar lógica de tienda
    if (req.path.startsWith('/superadmin')) {
        req.tiendaId = null;
        req.tiendaSlug = null;
        return next();
    }

    const rutasConocidas = ['api', 'auth', 'productos', 'pedidos', 'categorias', 'uploads', 'css', 'js', 'admin', 'superadmin', 'carrito.html'];

    // --- FUNCIÓN AUXILIAR: detectar slug desde URL o Referer ---
    function detectarSlugDesdeUrl() {
        const pathParts = req.path.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            const pathSlug = pathParts[0];
            if (pathSlug && pathSlug.match(/^[a-z0-9-]+$/) && !rutasConocidas.includes(pathSlug)) {
                try {
                    const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(pathSlug);
                    if (tienda) return tienda;
                } catch (e) {}
            }
        }
        return null;
    }

    function detectarSlugDesdeReferer() {
        const referer = req.get('Referer') || '';
        if (referer) {
            const refererMatch = referer.match(/^\/([a-z0-9-]+)\//);
            if (refererMatch) {
                const refSlug = refererMatch[1];
                if (refSlug && refSlug.match(/^[a-z0-9-]+$/) && !rutasConocidas.includes(refSlug)) {
                    try {
                        const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(refSlug);
                        if (tienda) return tienda;
                    } catch (e) {}
                }
            }
        }
        return null;
    }

    // --- PASO 1: Detectar slug desde URL path (/:slug/...) ---
    // Esto tiene la MÁXIMA prioridad. Si se detecta un slug en la URL,
    // se actualiza la sesión si el usuario autenticado pertenece a esa tienda.
    const tiendaUrl = detectarSlugDesdeUrl();
    if (tiendaUrl) {
        req.tiendaId = tiendaUrl.id;
        req.tiendaSlug = tiendaUrl.slug;
        console.log('[TIENDA-MW] URL path: slug=' + tiendaUrl.slug + ' id=' + tiendaUrl.id);
        // Actualizar sesión si el usuario está autenticado y pertenece a esta tienda
        if (req.session && req.session.user && !req.session.user.es_superadmin) {
            if (req.session.user.tienda_id !== tiendaUrl.id) {
                req.session.user.tienda_id = tiendaUrl.id;
                req.session.user.tiendaSlug = tiendaUrl.slug;
                console.log('[TIENDA-MW] Sesión actualizada a tienda_id=' + tiendaUrl.id);
            }
        }
        return next();
    }

    // --- PASO 2: Detectar slug desde Referer header (para rutas API sin slug) ---
    // Tiene prioridad sobre la sesión porque el Referer refleja la tienda actual
    // desde la cual se hizo la petición AJAX.
    const tiendaRef = detectarSlugDesdeReferer();
    if (tiendaRef) {
        req.tiendaId = tiendaRef.id;
        req.tiendaSlug = tiendaRef.slug;
        console.log('[TIENDA-MW] Referer: slug=' + tiendaRef.slug + ' id=' + tiendaRef.id);
        // Actualizar sesión si el usuario está autenticado y pertenece a esta tienda
        if (req.session && req.session.user && !req.session.user.es_superadmin) {
            if (req.session.user.tienda_id !== tiendaRef.id) {
                req.session.user.tienda_id = tiendaRef.id;
                req.session.user.tiendaSlug = tiendaRef.slug;
                console.log('[TIENDA-MW] Sesión actualizada a tienda_id=' + tiendaRef.id);
            }
        }
        return next();
    }

    // --- PASO 3: Si el usuario está autenticado (NO superadmin), usar su tienda_id de la sesión ---
    if (req.session && req.session.user && req.session.user.tienda_id && !req.session.user.es_superadmin) {
        req.tiendaId = req.session.user.tienda_id;
        req.tiendaSlug = req.session.user.tiendaSlug;
        console.log('[TIENDA-MW] Sesión: tienda_id=' + req.session.user.tienda_id + ' user=' + req.session.user.usuario);
        return next();
    }

    // 3. Detectar slug desde query param (para rutas API: /productos/public?slug=tienda1)
    const slug = req.query.slug;
    if (slug) {
        try {
            const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(slug);
            if (tienda) {
                req.tiendaId = tienda.id;
                req.tiendaSlug = tienda.slug;
                console.log('[TIENDA-MW] Query param: slug=' + tienda.slug + ' id=' + tienda.id);
                return next();
            }
        } catch (e) {
            // Si la tabla no existe aún, continuar con tienda por defecto
        }
    }

    // 4. Fallback: tienda por defecto (sin log para no ensuciar la consola)
    try {
        const tiendaDefault = db.prepare('SELECT id, slug FROM tiendas WHERE slug = ?').get('tienda1');
        if (tiendaDefault) {
            req.tiendaId = tiendaDefault.id;
            req.tiendaSlug = tiendaDefault.slug;
        } else {
            req.tiendaId = 1;
            req.tiendaSlug = 'tienda1';
        }
    } catch (e) {
        req.tiendaId = 1;
        req.tiendaSlug = 'tienda1';
    }

    next();
}

module.exports = tiendaMiddleware;
