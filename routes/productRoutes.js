const express = require('express');

const router = express.Router();

const upload = require('../middleware/uploadMiddleware');

const productController = require('../controllers/productController');

const authMiddleware = require('../middleware/authMiddleware');
const { requiereTiendaActiva } = require('../middleware/planEstadoMiddleware');



// GET público - solo productos de categorías visibles (para frontend tienda)
router.get('/public', productController.getProductosPublic);

// GET - todos los productos (para admin)
router.get('/', productController.getProductos);

router.post(

    '/',

    authMiddleware,

    requiereTiendaActiva,

    upload.any(),

    productController.crearProducto

);

router.put(

    '/:id',

    authMiddleware,

    requiereTiendaActiva,

    upload.any(),

    productController.editarProducto

);

router.delete(

    '/:id',

    authMiddleware,

    requiereTiendaActiva,

    productController.eliminarProducto

);



module.exports = router;