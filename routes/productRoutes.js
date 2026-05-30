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

    (req, res, next) => {
        console.log('[DEBUG PUT] Content-Type:', req.headers['content-type']);
        console.log('[DEBUG PUT] body keys:', Object.keys(req.body));
        console.log('[DEBUG PUT] files:', req.files ? req.files.length : 0);
        next();
    },

    upload.any(),

    (req, res, next) => {
        console.log('[DEBUG PUT AFTER MULTER] body keys:', Object.keys(req.body));
        console.log('[DEBUG PUT AFTER MULTER] body:', JSON.stringify(req.body));
        console.log('[DEBUG PUT AFTER MULTER] files:', req.files ? req.files.length : 0);
        next();
    },

    productController.editarProducto

);

router.delete(

    '/:id',

    authMiddleware,

    productController.eliminarProducto

);



module.exports = router;