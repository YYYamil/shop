const express = require('express');

const router = express.Router();

const pedidoController = require('../controllers/pedidoController');

const authMiddleware = require('../middleware/authMiddleware');



router.post(

    '/',

    pedidoController.crearPedido

);



router.get(

    '/',

    authMiddleware,

    pedidoController.getPedidos

);



router.put(

    '/:id',

    authMiddleware,

    pedidoController.cambiarEstado

);



router.delete(
    '/:id',
    authMiddleware,
    pedidoController.eliminarPedido
);



router.get(

    '/:id/items',

    authMiddleware,

    pedidoController.getItemsPedido

);



module.exports = router;