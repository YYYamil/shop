const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.get('/logout', authController.logout);

// ← Esta ruta debe tener el middleware
router.get('/verificar', authMiddleware, authController.verificar);

module.exports = router;