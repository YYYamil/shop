const express = require('express');

const router = express.Router();

const upload = require('../middleware/uploadMiddleware');

const productController = require('../controllers/productController');

const authMiddleware = require('../middleware/authMiddleware');



router.get('/', productController.getProductos);

router.post(

    '/',

    authMiddleware,

    upload.array('imagenes', 4),

    productController.crearProducto

);

router.put(

    '/:id',

    authMiddleware,

    upload.array('imagenes', 4),

    productController.editarProducto

);

router.delete(

    '/:id',

    authMiddleware,

    productController.eliminarProducto

);



module.exports = router;