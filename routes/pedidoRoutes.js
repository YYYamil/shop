const express = require('express');

const router = express.Router();

const pedidoController = require('../controllers/pedidoController');
const mercadopagoController = require('../controllers/mercadopagoController');

const authMiddleware = require('../middleware/authMiddleware');



router.post(

    '/',

    pedidoController.crearPedido

);

router.post(

    '/mercadopago',

    mercadopagoController.crearPreferenciaDesdePedido

);

router.get(
    '/mercadopago/pedido/:id/status',
    mercadopagoController.getPedidoStatus
);

router.post(

    '/webhook/mercadopago',

    mercadopagoController.webhook

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



router.put(

    '/:id/notas',

    authMiddleware,

    pedidoController.actualizarNotas

);



module.exports = router;
