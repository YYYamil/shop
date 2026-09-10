// middleware/planEstadoMiddleware.js
// ============================================
// ESTADO DE PLAN POR TIENDA (BLOQUE 3)
// ============================================
// Adjunta a `req` el estado comercial DERIVADO de la tienda actual
// (demo / activo / suspendido) + datos del plan, calculados por calendario
// con utils/saasUtils.obtenerEstadoTienda(). No filtra por activo = 1 porque
// necesita detectar también tiendas suspendidas por vencimiento de prueba o
// suscripción (no solo por baja manual), de modo que el candado de escritura
// y los banners del panel funcionen en todos los casos.

const db = require('../database/db');
const { ESTADOS, obtenerEstadoTienda, etiquetaEstado } = require('../utils/saasUtils');

// ------------------------------------------------------------------
// 1. Carga el estado/plan de la tienda detectada por tiendaMiddleware
//    (req.tiendaId) o de la sesión del usuario autenticado. Es un
//    middleware de solo lectura: nunca bloquea; solo enriquece req.
// ------------------------------------------------------------------
function cargarPlanEstado(req, res, next) {
    const tiendaId =
        req.tiendaId ||
        (req.session && req.session.user && !req.session.user.es_superadmin
            ? req.session.user.tienda_id
            : null);

    if (!tiendaId) {
        // Rutas globales del SaaS / superadmin / sin contexto de tienda
        return next();
    }

    try {
        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) return next();

        const estado = obtenerEstadoTienda(tienda);
        const esIlimitado = String(tienda.plan || 'ilimitado') === 'ilimitado';

        // Fila completa de la tienda (útil para vistas y para el guard)
        req.tienda = tienda;
        req.tiendaEstado = estado.estado;

        req.planInfo = {
            plan: estado.plan || 'ilimitado',
            estado: estado.estado,
            etiqueta: etiquetaEstado(tienda),
            diasRestantes: estado.diasRestantes,
            trialFin: tienda.trial_fin || null,
            suscripcionFin: tienda.suscripcion_fin || null,
            // Fecha límite relevante según el estado actual
            fechaFin:
                estado.estado === ESTADOS.DEMO
                    ? tienda.trial_fin || null
                    : !esIlimitado
                        ? tienda.suscripcion_fin || null
                        : null,
            esIlimitado,
        };
    } catch (e) {
        console.warn('[PLAN-MW] No se pudo evaluar el plan de la tienda ' + tiendaId + ':', e.message);
    }

    next();
}

// ------------------------------------------------------------------
// 2. Guard de escritura: rechaza mutaciones si la tienda está SUSPENDIDA.
//    Se compone DESPUÉS de authMiddleware en las rutas que modifican
//    datos (productos, pedidos, categorías, config, etc.). Las lecturas
//    siguen permitidas para que el dueño pueda ver su panel aunque no
//    pueda operar.
// ------------------------------------------------------------------
function requiereTiendaActiva(req, res, next) {
    if (req.tiendaEstado === ESTADOS.SUSPENDIDO) {
        return res.status(403).json({
            error: 'Tu tienda está suspendida. Renová tu plan para volver a operar.',
            codigo: 'TIENDA_SUSPENDIDA',
            estado: req.tiendaEstado,
        });
    }
    next();
}

module.exports = {
    cargarPlanEstado,
    requiereTiendaActiva,
    ESTADOS,
};
