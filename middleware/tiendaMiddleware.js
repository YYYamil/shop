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

    // 1. Detectar slug desde URL path (/:slug/...)
    // IMPORTANTE: Esto va ANTES de la sesión para que cuando el superadmin
    // visite /deportes-rodriguez/admin/personalizacion.html, se use el slug
    // de la URL en lugar del tienda_id de su sesión (que es de tienda1).
    const pathParts = req.path.split('/').filter(Boolean);
    if (pathParts.length > 0) {
        const pathSlug = pathParts[0];
        // Validar que parezca un slug de tienda (letras, números, guiones)
        // PERO no debe ser una ruta conocida del sistema
        const rutasConocidas = ['api', 'auth', 'productos', 'pedidos', 'categorias', 'uploads', 'css', 'js', 'admin', 'superadmin', 'carrito.html'];
        if (pathSlug && pathSlug.match(/^[a-z0-9-]+$/) && !rutasConocidas.includes(pathSlug)) {
            try {
                const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(pathSlug);
                if (tienda) {
                    req.tiendaId = tienda.id;
                    req.tiendaSlug = tienda.slug;
                    console.log('[TIENDA-MW] URL path: slug=' + tienda.slug + ' id=' + tienda.id);
                    return next();
                }
            } catch (e) {
                // Si la tabla no existe aún, continuar
            }
        }
    }

    // 2. Si el usuario está autenticado (NO superadmin) y NO se detectó slug en la URL, usar su tienda_id de la sesión
    if (req.session && req.session.user && req.session.user.tienda_id && !req.session.user.es_superadmin) {
        req.tiendaId = req.session.user.tienda_id;
        req.tiendaSlug = req.session.user.tiendaSlug;
        console.log('[TIENDA-MW] Sesión: tienda_id=' + req.session.user.tienda_id + ' user=' + req.session.user.usuario);
        return next();
    }

    // 2b. Detectar slug desde Referer header (para rutas API como POST /api/config/logo)
    // Cuando el admin está en /deportes-rodriguez/admin/personalizacion.html y hace un fetch
    // a /api/config/logo, el Referer contiene el slug en la URL.
    const referer = req.get('Referer') || '';
    if (referer) {
        const refererMatch = referer.match(/^\/([a-z0-9-]+)\//);
        if (refererMatch) {
            const refSlug = refererMatch[1];
            if (refSlug && refSlug.match(/^[a-z0-9-]+$/) && !rutasConocidas.includes(refSlug)) {
                try {
                    const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(refSlug);
                    if (tienda) {
                        req.tiendaId = tienda.id;
                        req.tiendaSlug = tienda.slug;
                        console.log('[TIENDA-MW] Referer: slug=' + tienda.slug + ' id=' + tienda.id);
                        return next();
                    }
                } catch (e) {
                    // Si la tabla no existe aún, continuar
                }
            }
        }
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

    // 4. Fallback: tienda por defecto
    try {
        const tiendaDefault = db.prepare('SELECT id, slug FROM tiendas WHERE slug = ?').get('tienda1');
        if (tiendaDefault) {
            req.tiendaId = tiendaDefault.id;
            req.tiendaSlug = tiendaDefault.slug;
            console.log('[TIENDA-MW] Fallback: slug=' + tiendaDefault.slug + ' id=' + tiendaDefault.id);
        } else {
            req.tiendaId = 1;
            req.tiendaSlug = 'tienda1';
            console.log('[TIENDA-MW] Fallback hardcode: tienda1');
        }
    } catch (e) {
        req.tiendaId = 1;
        req.tiendaSlug = 'tienda1';
        console.log('[TIENDA-MW] Fallback error: tienda1');
    }

    next();
}

module.exports = tiendaMiddleware;
