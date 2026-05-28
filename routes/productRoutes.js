const express = require('express');

const router = express.Router();

const upload = require('../middleware/uploadMiddleware');

const productController = require('../controllers/productController');

const authMiddleware = require('../middleware/authMiddleware');



// GET público - solo productos de categorías visibles (para frontend tienda)
router.get('/public', productController.getProductosPublic);

// GET - todos los productos (para admin)
router.get('/', productController.getProductos);

router.post(

    '/',

    authMiddleware,

    upload.any(),

    productController.crearProducto

);

router.put(

    '/:id',

    authMiddleware,

    upload.any(),

    productController.editarProducto

);

router.delete(

    '/:id',

    authMiddleware,

    productController.eliminarProducto

);



module.exports = router;