// middleware/authMiddleware.js
function authMiddleware(req, res, next) {
    if (req.session && req.session.user) {   // ← Cambiar a .user
        return next();
    }
    
    res.status(401).json({ 
        error: 'No autorizado' 
    });
}

module.exports = authMiddleware;