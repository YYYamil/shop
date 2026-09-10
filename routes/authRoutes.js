const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Login exclusivo para SuperAdmin (solo desde /superadmin/login.html)
router.post('/login/superadmin', authController.loginSuperAdmin);

// Login para admin de tienda (solo desde /:slug/admin/login.html)
router.post('/login/tienda', authController.loginTienda);

// Autodetección de tienda por usuario (login genérico /admin/login.html)
router.get('/tiendas-por-usuario', authController.tiendasDeUsuario);

router.get('/logout', authController.logout);

// Recuperación de contraseña (público, sin auth). Genera una contraseña nueva
// y la envía por correo (Fase 1).
router.post('/recuperar', authController.recuperarPassword);

// Verificar sesión actual
router.get('/verificar', authMiddleware, authController.verificar);

module.exports = router;