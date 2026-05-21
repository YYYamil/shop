const express = require('express');

const router = express.Router();

const categoriaController = require('../controllers/categoriaController');

const authMiddleware = require('../middleware/authMiddleware');



router.get('/', categoriaController.getCategorias);

router.post('/', authMiddleware, categoriaController.crearCategoria);

router.delete('/:id', authMiddleware, categoriaController.eliminarCategoria);



module.exports = router;