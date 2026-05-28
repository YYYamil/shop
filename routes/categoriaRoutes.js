const express = require('express');

const router = express.Router();

const categoriaController = require('../controllers/categoriaController');

const authMiddleware = require('../middleware/authMiddleware');



// GET público (sin auth) - para mostrar categorías en la tienda
router.get('/', categoriaController.getCategorias);

// POST y DELETE requieren autenticación (admin)
router.post('/', authMiddleware, categoriaController.crearCategoria);

router.delete('/:id', authMiddleware, categoriaController.eliminarCategoria);



module.exports = router;