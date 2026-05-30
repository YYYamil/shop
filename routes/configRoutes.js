const express = require('express');
const router = express.Router();

const upload = require('../middleware/uploadMiddleware');
const configController = require('../controllers/configController');
const authMiddleware = require('../middleware/authMiddleware');

// Pública - Obtener toda la configuración (usa slug de query param o middleware)
router.get('/', configController.getConfig);

// Pública - Obtener configuración por slug en la ruta (más confiable)
router.get('/slug/:slug', configController.getConfigBySlug);

// Requiere auth - Obtener configuración con metadatos para el panel admin
router.get('/admin', authMiddleware, configController.getConfigAdmin);

// Requiere auth - Actualizar un valor específico
router.put('/:clave', authMiddleware, configController.updateConfig);

// Requiere auth - Subir imagen de logo
router.post('/logo', authMiddleware, upload.single('logo'), configController.uploadLogo);

// Requiere auth - Subir imagen de hero
router.post('/hero-imagen', authMiddleware, upload.single('hero'), configController.uploadHero);

module.exports = router;
