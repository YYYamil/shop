// middleware/authMiddleware.js
const db = require('../database/db');

function authMiddleware(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const user = req.session.user;

    // Si es superadmin: solo puede acceder a rutas /superadmin/ (NO a /:slug/admin/)
    if (user.es_superadmin) {
        const pathParts = req.path.split('/').filter(Boolean);
        if (pathParts.length >= 2 && pathParts[1] === 'admin') {
            return res.status(403).json({ error: 'El SuperAdmin no puede acceder a paneles de tienda' });
        }
        return next();
    }

    // Para admin de tienda: verificar que la ruta corresponda a su tienda
    // Extraer slug de la URL: /:slug/admin/...
    const pathParts = req.path.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[1] === 'admin') {
        const slugFromUrl = pathParts[0];
        // Buscar la tienda por slug
        const tienda = db.prepare('SELECT id, slug FROM tiendas WHERE slug = ?').get(slugFromUrl);
        if (!tienda) {
            return res.status(403).json({ error: 'Tienda no encontrada' });
        }
        // Verificar que el usuario pertenece a esta tienda
        if (user.tienda_id !== tienda.id) {
            return res.status(403).json({ error: 'No tienes acceso a esta tienda' });
        }
    }

    next();
}

module.exports = authMiddleware;