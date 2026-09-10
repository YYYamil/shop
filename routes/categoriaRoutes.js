const express = require('express');

const router = express.Router();

const categoriaController = require('../controllers/categoriaController');

const authMiddleware = require('../middleware/authMiddleware');
const { requiereTiendaActiva } = require('../middleware/planEstadoMiddleware');



// GET público - solo categorías visibles (para frontend tienda)
router.get('/public', categoriaController.getCategoriasPublic);

// GET público (sin auth) - todas las categorías (para admin)
router.get('/', categoriaController.getCategorias);

// PUT requiere autenticación (admin)
router.put('/:id', authMiddleware, requiereTiendaActiva, categoriaController.actualizarCategoria);

// POST y DELETE requieren autenticación (admin)
router.post('/', authMiddleware, requiereTiendaActiva, categoriaController.crearCategoria);

router.delete('/:id', authMiddleware, requiereTiendaActiva, categoriaController.eliminarCategoria);



module.exports = router;