const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Login exclusivo para SuperAdmin (solo desde /superadmin/login.html)
router.post('/login/superadmin', authController.loginSuperAdmin);

// Login para admin de tienda (solo desde /:slug/admin/login.html)
router.post('/login/tienda', authController.loginTienda);

router.get('/logout', authController.logout);

// Verificar sesión actual
router.get('/verificar', authMiddleware, authController.verificar);

module.exports = router;