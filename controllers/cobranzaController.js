// controllers/cobranzaController.js
// ============================================
// VISTA COBRANZA DEL SUPERADMIN (BLOQUE 6)
// ============================================
// Administración centralizada de las mensualidades del SaaS por tienda:
//   - GET  /api/superadmin/cobranza                 → listado con estado de cobranza
//   - POST /api/superadmin/cobranza/extender        → extiende el plan pago +N meses
//   - POST /api/superadmin/cobranza/ilimitado       → marca la tienda como ilimitada
//   - POST /api/superadmin/cobranza/estado          → suspende / reactiva manualmente
//   - POST /api/superadmin/cobranza/suscripcion/link → genera link de pago (en mercadopagoController)
// Todos los cambios quedan auditados en store_events.

const db = require('../database/db');
const saasUtils = require('../utils/saasUtils');
const superAdminController = require('./superAdminController');

const registrarEvento = superAdminController.registrarEvento;

// Estados de cobranza que muestra el panel (independiente de ESTADOS de saasUtils,
// que es el estado comercial: demo/activo/suspendido).
const ESTADOS_COBRANZA = {
    ILIMITADO: 'ilimitado',
    DEMO: 'demo',
    ACTIVA: 'activa',
    PROXIMA_A_VENCER: 'proxima_a_vencer',
    VENCIDA: 'vencida',
    SUSPENDIDA: 'suspendida',
};

function etiquetaEstadoCobranza(estado) {
    const map = {
        ilimitado: 'Ilimitado',
        demo: 'Demo',
        activa: 'Activa',
        proxima_a_vencer: 'Próxima a vencer',
        vencida: 'Vencida',
        suspendida: 'Suspendida',
    };
    return map[estado] || estado;
}

// Deriva el estado de cobranza de una tienda. Orden de precedencia:
//   1) activo = 0     → suspendida (baja manual, sin importar plan)
//   2) plan ilimitado → ilimitado
//   3) plan demo      → demo (trial vigente) o vencida (trial terminado)
//   4) plan pago      → vencida / próxima_a_vencer / activa según suscripcion_fin
// `diasRestantes` puede ser negativo (venció hace N días).
function calcularEstadoCobranza(tienda, warningDays) {
    const activo = tienda.activo === 1 || tienda.activo === true || tienda.activo === null;
    const plan = String(tienda.plan || 'ilimitado');

    if (!activo) {
        return { estado: ESTADOS_COBRANZA.SUSPENDIDA, diasRestantes: null };
    }
    if (plan === 'ilimitado') {
        return { estado: ESTADOS_COBRANZA.ILIMITADO, diasRestantes: null };
    }

    const hoy = saasUtils.hoyBuenosAires();

    if (plan === 'demo') {
        if (!tienda.trial_fin || hoy > tienda.trial_fin) {
            return { estado: ESTADOS_COBRANZA.VENCIDA, diasRestantes: null };
        }
        return { estado: ESTADOS_COBRANZA.DEMO, diasRestantes: saasUtils.diasEntre(hoy, tienda.trial_fin) };
    }

    // Planes pagos
    if (!tienda.suscripcion_fin) {
        return { estado: ESTADOS_COBRANZA.ACTIVA, diasRestantes: null };
    }
    const dias = saasUtils.diasEntre(hoy, tienda.suscripcion_fin);
    if (dias < 0) {
        return { estado: ESTADOS_COBRANZA.VENCIDA, diasRestantes: dias };
    }
    if (dias <= warningDays) {
        return { estado: ESTADOS_COBRANZA.PROXIMA_A_VENCER, diasRestantes: dias };
    }
    return { estado: ESTADOS_COBRANZA.ACTIVA, diasRestantes: dias };
}

function etiquetaPlan(t) {
    const plan = String(t.plan || 'ilimitado');
    if (plan === 'ilimitado') return 'Ilimitado';
    if (plan === 'demo') return 'DEMO';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
}

// GET /api/superadmin/cobranza
exports.getCobranza = (req, res) => {
    try {
        const tiendas = db.prepare('SELECT * FROM tiendas ORDER BY id ASC').all();

        const warningRaw = parseInt(saasUtils.getGlobalConfig('saas.warning_days'), 10);
        const warningDays = Number.isInteger(warningRaw) && warningRaw >= 0 ? warningRaw : 3;
        const montoRaw = parseInt(saasUtils.getGlobalConfig('saas.monto_mensual_ars'), 10);
        const montoMensual = Number.isInteger(montoRaw) && montoRaw > 0 ? montoRaw : 5000;
        const planNombre = saasUtils.getGlobalConfig('saas.plan_name') || 'Profesional';

        const stUltimoPago = db.prepare(
            "SELECT * FROM saas_pagos WHERE tienda_id = ? AND estado = 'aprobado' ORDER BY id DESC LIMIT 1"
        );
        const stPendientes = db.prepare(
            "SELECT COUNT(*) AS n FROM saas_pagos WHERE tienda_id = ? AND estado != 'aprobado'"
        );
        const stMp = db.prepare(
            "SELECT valor FROM configuracion WHERE clave = 'mp_access_token' AND tienda_id = ? AND valor IS NOT NULL AND valor != ''"
        );

        const filas = tiendas.map(t => {
            const cob = calcularEstadoCobranza(t, warningDays);
            const ultimo = stUltimoPago.get(t.id) || null;
            const pendientes = stPendientes.get(t.id) || { n: 0 };
            const mp = stMp.get(t.id) || null;

            return {
                id: t.id,
                slug: t.slug,
                nombre: t.nombre,
                activo: t.activo,
                plan: t.plan || 'ilimitado',
                plan_label: etiquetaPlan(t),
                estado: cob.estado,
                estado_label: etiquetaEstadoCobranza(cob.estado),
                dias_restantes: cob.diasRestantes,
                trial_fin: t.trial_fin || null,
                suscripcion_fin: t.suscripcion_fin || null,
                ultimo_pago: ultimo
                    ? {
                        monto: ultimo.monto,
                        fecha: ultimo.aprobado_at || ultimo.created_at,
                        payment_id: ultimo.payment_id || null,
                        nueva_fecha_fin: ultimo.nueva_fecha_fin || null,
                    }
                    : null,
                pagos_pendientes: pendientes.n || 0,
                mp_conectado: !!mp,
            };
        });

        const conteo = {};
        filas.forEach(f => {
            conteo[f.estado] = (conteo[f.estado] || 0) + 1;
        });

        res.json({
            ok: true,
            warningDays,
            montoMensual,
            planNombre,
            conteo,
            tiendas: filas,
        });
    } catch (err) {
        console.error('[COBRANZA] Error al obtener la lista:', err.message);
        res.status(500).json({ error: 'Error al obtener la lista de cobranza' });
    }
};

// POST /api/superadmin/cobranza/extender — extiende la suscripción de una tienda
// +N meses. Si tiene período pago o trial vigente se extiende desde esa fecha
// (misma regla que aplicarPagoSaaS); si no, desde hoy. Si venía en demo o sin
// período pago, pasa a plan pago.
exports.extenderPlan = (req, res) => {
    try {
        const tiendaId = parseInt(req.body && req.body.tienda_id, 10);
        const meses = parseInt(req.body && req.body.meses, 10);
        const motivo = String((req.body && req.body.motivo) || '').trim();

        if (!Number.isInteger(tiendaId) || tiendaId <= 0) {
            return res.status(400).json({ error: 'Falta el id de la tienda' });
        }
        if (!Number.isInteger(meses) || meses < 1 || meses > 24) {
            return res.status(400).json({ error: 'Cantidad de meses inválida (1 a 24)' });
        }
        if (!motivo) {
            return res.status(400).json({ error: 'Escribí el motivo de la extensión' });
        }

        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const planPagado = String(saasUtils.getGlobalConfig('saas.plan_name') || 'Profesional').toLowerCase();
        const hoy = saasUtils.hoyBuenosAires();
        const planActual = String(tienda.plan || 'ilimitado');

        let base = hoy;
        if (planActual === 'demo' && tienda.trial_fin && hoy <= tienda.trial_fin && tienda.trial_fin > base) {
            base = tienda.trial_fin;
        } else if (planActual !== 'demo' && planActual !== 'ilimitado' && tienda.suscripcion_fin && tienda.suscripcion_fin > base) {
            base = tienda.suscripcion_fin;
        }
        const nuevaFin = saasUtils.sumarMeses(base, meses);

        db.prepare(`
            UPDATE tiendas
            SET plan = ?, suscripcion_inicio = ?, suscripcion_fin = ?, activo = 1
            WHERE id = ?
        `).run(planPagado, base, nuevaFin, tiendaId);

        registrarEvento(
            tiendaId,
            'plan_extendido',
            'Extensión manual (SuperAdmin) · +' + meses + ' mes(es) · ' + base + ' → ' + nuevaFin +
            (planActual === 'ilimitado' || (planActual !== 'demo' && !tienda.suscripcion_fin)
                ? ' · cambio a plan pago'
                : '') +
            ' · motivo: ' + motivo
        );

        console.log('[COBRANZA] Plan extendido tienda ' + tiendaId + ': ' + base + ' → ' + nuevaFin + ' (' + meses + ' mes(es))');
        res.json({ ok: true, nuevaFechaFin: nuevaFin, plan: planPagado });
    } catch (err) {
        console.error('[COBRANZA] Error al extender plan:', err.message);
        res.status(500).json({ error: 'Error al extender el plan' });
    }
};

// POST /api/superadmin/cobranza/ilimitado — marca la tienda como de por vida:
// nunca se suspende sola y no se le cobra mensualidad.
exports.setIlimitado = (req, res) => {
    try {
        const tiendaId = parseInt(req.body && req.body.tienda_id, 10);
        const motivo = String((req.body && req.body.motivo) || '').trim();

        if (!Number.isInteger(tiendaId) || tiendaId <= 0) {
            return res.status(400).json({ error: 'Falta el id de la tienda' });
        }
        if (!motivo) {
            return res.status(400).json({ error: 'Escribí el motivo' });
        }

        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        db.prepare(`
            UPDATE tiendas
            SET plan = 'ilimitado',
                suscripcion_inicio = NULL,
                suscripcion_fin = NULL,
                trial_fin = NULL,
                activo = 1
            WHERE id = ?
        `).run(tiendaId);

        registrarEvento(tiendaId, 'plan_ilimitado', 'Marcada como Ilimitado (SuperAdmin) · motivo: ' + motivo);

        console.log('[COBRANZA] Tienda ' + tiendaId + ' marcada como ilimitada');
        res.json({ ok: true });
    } catch (err) {
        console.error('[COBRANZA] Error al marcar ilimitado:', err.message);
        res.status(500).json({ error: 'Error al marcar la tienda como ilimitada' });
    }
};

// POST /api/superadmin/cobranza/estado — suspende o reactiva manualmente una
// tienda (interruptor `activo`, igual que la tienda "Activar / Desactivar").
exports.manejarEstado = (req, res) => {
    try {
        const tiendaId = parseInt(req.body && req.body.tienda_id, 10);
        const accion = String((req.body && req.body.accion) || '').trim();
        const motivo = String((req.body && req.body.motivo) || '').trim();

        if (!Number.isInteger(tiendaId) || tiendaId <= 0) {
            return res.status(400).json({ error: 'Falta el id de la tienda' });
        }
        if (accion !== 'suspender' && accion !== 'reactivar') {
            return res.status(400).json({ error: 'Acción inválida' });
        }

        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        if (accion === 'suspender') {
            db.prepare('UPDATE tiendas SET activo = 0 WHERE id = ?').run(tiendaId);
            registrarEvento(
                tiendaId,
                'tienda_suspendida',
                'Suspensión manual (SuperAdmin)' + (motivo ? ' · motivo: ' + motivo : '')
            );
            console.log('[COBRANZA] Tienda ' + tiendaId + ' suspendida manualmente');
        } else {
            db.prepare('UPDATE tiendas SET activo = 1 WHERE id = ?').run(tiendaId);
            registrarEvento(
                tiendaId,
                'tienda_reactivada',
                'Reactivación manual (SuperAdmin)' + (motivo ? ' · motivo: ' + motivo : '')
            );
            console.log('[COBRANZA] Tienda ' + tiendaId + ' reactivada manualmente');
        }

        res.json({ ok: true, activo: accion === 'reactivar' ? 1 : 0 });
    } catch (err) {
        console.error('[COBRANZA] Error al cambiar estado:', err.message);
        res.status(500).json({ error: 'Error al cambiar el estado de la tienda' });
    }
};