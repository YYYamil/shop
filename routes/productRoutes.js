const express = require('express');

const router = express.Router();

const multer = require('multer');

const path = require('path');

const productController = require('../controllers/productController');

const authMiddleware = require('../middleware/authMiddleware');



const storage = multer.diskStorage({

    destination: function(req, file, cb) {

        cb(null, 'uploads/');

    },

    filename: function(req, file, cb) {

        cb(

            null,

            Date.now() + path.extname(file.originalname)

        );

    }

});



const upload = multer({

    storage

});



router.get('/', productController.getProductos);

router.post(

    '/',

    authMiddleware,

    upload.single('imagen'),

    productController.crearProducto

);

router.put(

    '/:id',

    authMiddleware,

    upload.single('imagen'),

    productController.editarProducto

);

router.delete(

    '/:id',

    authMiddleware,

    productController.eliminarProducto

);



module.exports = router;