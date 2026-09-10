// routes/saasRoutes.js
// ============================================
// Rutas públicas del SaaS (self-service)
// ============================================

const express = require('express');
const router = express.Router();

const saasController = require('../controllers/saasController');
const mercadopagoController = require('../controllers/mercadopagoController');
const authMiddleware = require('../middleware/authMiddleware');

// Alta automática de tienda (flujo "Empezar Gratis")
router.post('/registro', saasController.registrarTienda);

// Disponibilidad de slug (validación en vivo del formulario)
router.get('/disponibilidad', saasController.checkDisponibilidad);

// Estado del plan de la tienda autenticada (panel del dueño, BLOQUE 3)
router.get('/plan', authMiddleware, saasController.getPlanEstado);

// BLOQUE 5 - Checkout de la mensualidad del plan (dueño autenticado).
// Genera la preferencia de pago con la cuenta GLOBAL del SuperAdmin.
router.post('/renovar', authMiddleware, mercadopagoController.crearCheckoutSuscripcionSaaS);

// Datos públicos de marketing del plan (landing dinámica, BLOQUE 4)
router.get('/info-publica', saasController.getInfoPublica);

module.exports = router;
