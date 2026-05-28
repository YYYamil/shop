const express = require('express');

const router = express.Router();

const categoriaController = require('../controllers/categoriaController');

const authMiddleware = require('../middleware/authMiddleware');



// GET público - solo categorías visibles (para frontend tienda)
router.get('/public', categoriaController.getCategoriasPublic);

// GET público (sin auth) - todas las categorías (para admin)
router.get('/', categoriaController.getCategorias);

// PUT requiere autenticación (admin)
router.put('/:id', authMiddleware, categoriaController.actualizarCategoria);

// POST y DELETE requieren autenticación (admin)
router.post('/', authMiddleware, categoriaController.crearCategoria);

router.delete('/:id', authMiddleware, categoriaController.eliminarCategoria);



module.exports = router;