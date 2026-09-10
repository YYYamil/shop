const express = require('express');
const router = express.Router();

const superAdminController = require('../controllers/superAdminController');
const mercadopagoController = require('../controllers/mercadopagoController');
const authMiddleware = require('../middleware/authMiddleware');
const superAdminMiddleware = require('../middleware/superAdminMiddleware');

// Todas las rutas de superadmin requieren autenticación + ser superadmin
router.use(authMiddleware, superAdminMiddleware);

// Tiendas
router.get('/tiendas', superAdminController.getTiendas);
router.post('/tiendas', superAdminController.crearTienda);
router.put('/tiendas/:id', superAdminController.actualizarTienda);
router.delete('/tiendas/:id', superAdminController.eliminarTienda);

// Usuarios
router.get('/usuarios', superAdminController.getUsuarios);
router.post('/usuarios', superAdminController.crearUsuario);
router.put('/usuarios/:id', superAdminController.actualizarUsuario);
router.delete('/usuarios/:id', superAdminController.eliminarUsuario);

// Backups
router.get('/backups', superAdminController.listarBackups);
router.post('/backups', superAdminController.crearBackup);
router.post('/backups/tienda/:id', superAdminController.backupTienda);
router.delete('/backups/:nombre', superAdminController.eliminarBackup);
router.get('/backups/:nombre/download', superAdminController.descargarBackup);

// Cuenta de cobro del SaaS (SuperAdmin Mercado Pago) - BLOQUE 5
router.get('/mp-plataforma/status', mercadopagoController.getPlataformaMpStatus);
router.get('/mp-plataforma/connect', mercadopagoController.connectPlataforma);
router.post('/mp-plataforma/disconnect', mercadopagoController.disconnectPlataforma);

// Config SaaS global (BLOQUE 4)
router.get('/saas-config', superAdminController.getSaasConfig);
router.put('/saas-config', superAdminController.updateSaasConfig);

// Eventos / auditoría (BLOQUE 4)
router.get('/eventos', superAdminController.getEventos);

module.exports = router;
