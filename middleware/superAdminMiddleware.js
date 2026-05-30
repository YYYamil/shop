// middleware/superAdminMiddleware.js
// Verifica que el usuario autenticado sea superadmin

function superAdminMiddleware(req, res, next) {
    if (req.session && req.session.user && req.session.user.es_superadmin) {
        return next();
    }

    res.status(403).json({
        error: 'Acceso denegado. Se requieren permisos de superadmin.'
    });
}

module.exports = superAdminMiddleware;
