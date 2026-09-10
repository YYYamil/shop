const express = require('express');

const router = express.Router();

const pedidoController = require('../controllers/pedidoController');
const mercadopagoController = require('../controllers/mercadopagoController');

const authMiddleware = require('../middleware/authMiddleware');
const { requiereTiendaActiva } = require('../middleware/planEstadoMiddleware');



router.post(

    '/',

    requiereTiendaActiva,

    pedidoController.crearPedido

);

router.post(

    '/mercadopago',

    requiereTiendaActiva,

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

    requiereTiendaActiva,

    pedidoController.cambiarEstado

);



router.delete(
    '/:id',
    authMiddleware,
    requiereTiendaActiva,
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

    requiereTiendaActiva,

    pedidoController.actualizarNotas

);



module.exports = router;
