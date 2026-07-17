const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const mercadopagoController = require('../controllers/mercadopagoController');

router.get('/status', mercadopagoController.getStatus);
router.get('/connect', authMiddleware, mercadopagoController.connect);
router.post('/disconnect', authMiddleware, mercadopagoController.disconnect);

module.exports = router;
