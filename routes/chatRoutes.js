const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chatController');
const chatProductosController = require('../controllers/chatProductosController');

router.post('/', chatController.enviarMensaje);

router.get('/products', chatProductosController.buscarProductos);

module.exports = router;