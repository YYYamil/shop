const express = require('express');
const router = express.Router();

const superAdminController = require('../controllers/superAdminController');
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

module.exports = router;
