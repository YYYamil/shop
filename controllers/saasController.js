// controllers/saasController.js
// ============================================
// ALTA AUTOMÁTICA DE TIENDA (BLOQUE 2) — flujo "Empezar Gratis"
// ============================================
// Registro público y transaccional: crea en una única transacción
//   tienda (plan=demo + trial_inicio/trial_fin) + dueño + config por defecto
//   + categorías + evento de auditoría.
//  - NO guarda password_plain (el alta pública no expone la contraseña).
//  - El slug se autogenera desde el nombre (con sufijo -2, -3) si no se indica.
//  - Aplica estado DEMO calculado por calendario (regla del plan: hoy <= fin).
//  - Autentica automáticamente al nuevo dueño (self-service).

const db = require('../database/db');
const bcrypt = require('bcrypt');

const saasUtils = require('../utils/saasUtils');
const { insertarConfigPorDefecto, insertarCategoriasPorDefecto } = require('../utils/defaultConfig');
const { enviarMail } = require('../utils/mailer');

const MIN_PASSWORD_LEN = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validarEmail(email) {
    if (!email || !String(email).trim()) return 'Ingresá tu correo electrónico';
    const e = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return 'Ingresá un correo electrónico válido';
    return null;
}

function validarUsuario(usuario) {
    if (!usuario || !String(usuario).trim()) return 'Ingresá un nombre de usuario';
    const u = String(usuario).trim();
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(u)) {
        return 'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto, guión bajo o guión)';
    }
    return null;
}

function validarPassword(password) {
    if (!password || String(password).length < MIN_PASSWORD_LEN) {
        return 'La contraseña debe tener al menos ' + MIN_PASSWORD_LEN + ' caracteres';
    }
    return null;
}

// Envía el correo de bienvenida/confirmación al dueño recién creado.
// Es fire-and-forget: no bloquea la respuesta del alta. Si falla el envío,
// se loguea y el alta continúa (el dueño ya puede entrar igual).
async function enviarMailBienvenida({ tienda, usuario, email, trialFin, trialDays }) {
    try {
        const baseUrl = (process.env.PUBLIC_BASE_URL || 'https://shop.yamy.fun').replace(/\/+$/, '');
        const urlTienda = baseUrl + '/' + tienda.slug + '/';
        const urlAdmin = baseUrl + '/' + tienda.slug + '/admin/login.html';
        const urlLanding = baseUrl + '/';

        const asunto = '¡Tu tienda "' + tienda.nombre + '" está lista en Shop SaaS!';
        const texto = [
            '¡Hola ' + usuario + '!',
            '',
            'Tu tienda se creó correctamente. Estos son tus datos:',
            '',
            '   Nombre:      ' + tienda.nombre,
            '   Identificador (slug): ' + tienda.slug,
            '   URL pública: ' + urlTienda,
            '   Usuario:     ' + usuario,
            '',
            'Ingresá a tu panel de administración acá:',
            '   ' + urlAdmin,
            '',
            'Tu prueba gratuita es de ' + (trialDays || 30) + ' días (hasta el ' + trialFin + '). Durante la',
            'prueba podés cargar productos, configurar tu tienda y conectar tus',
            'pagos. Cuando quieras, podés renovar para no perder nada.',
            '',
            'Si tenés dudas, respondé este correo.',
            '',
            '— El equipo de Shop SaaS (' + urlLanding + ')',
        ].join('\n');

        const resultado = await enviarMail({ to: email, subject: asunto, text: texto });
        if (!resultado.ok) {
            console.error('[SAAS] No se pudo enviar el mail de bienvenida a', email, resultado.error || '');
        } else {
            console.log('[SAAS] Mail de bienvenida ' + (resultado.entregado ? 'enviado a' : 'log (dev) para') + ' ' + email);
        }
    } catch (err) {
        console.error('[SAAS] Error al enviar mail de bienvenida:', err.message);
    }
}

// POST /api/saas/registro
// Body: { nombre, usuario, email, password, slug? }
exports.registrarTienda = (req, res) => {
    const nombre = String((req.body && req.body.nombre) || '').trim();
    const usuario = String((req.body && req.body.usuario) || '').trim();
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');
    const slugDeseado = String((req.body && req.body.slug) || '').trim().toLowerCase();

    // --- Validaciones de negocio ---
    if (!nombre) {
        return res.status(400).json({ error: 'Ingresá el nombre de tu tienda' });
    }
    if (nombre.length < 2 || nombre.length > 60) {
        return res.status(400).json({ error: 'El nombre de la tienda debe tener entre 2 y 60 caracteres' });
    }

    const errUsuario = validarUsuario(usuario);
    if (errUsuario) return res.status(400).json({ error: errUsuario });

    const errEmail = validarEmail(email);
    if (errEmail) return res.status(400).json({ error: errEmail });

    const errPassword = validarPassword(password);
    if (errPassword) return res.status(400).json({ error: errPassword });

    // Slug: si no viene, se autogenera desde el nombre.
    let slug;
    if (slugDeseado) {
        if (!saasUtils.esSlugValido(slugDeseado)) {
            return res.status(400).json({ error: 'Ese identificador no es válido. Usá solo minúsculas, números y guiones (y que no esté reservado)' });
        }
        if (saasUtils.existeSlug(slugDeseado)) {
            return res.status(400).json({ error: 'Ese identificador ya está en uso. Probá con otro' });
        }
        slug = slugDeseado;
    } else {
        slug = saasUtils.generarSlugUnico(nombre);
    }

    // Verificación de usuario duplicado
    const userExistente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario);
    if (userExistente) {
        return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
    }

    // Verificación de email duplicado (no bloquear si el email ya existe como
    // usuario previo a la Fase 1: solo dueños creados con email tienen valor).
    const emailExistente = db.prepare('SELECT id FROM usuarios WHERE email = ? AND email IS NOT NULL AND email != ?').get(email, '');
    if (emailExistente) {
        return res.status(400).json({ error: 'Ese correo ya está registrado. ¿Querés recuperar tu contraseña?' });
    }

    const hoy = saasUtils.hoyBuenosAires();
    const trialDays = parseInt(saasUtils.getGlobalConfig('saas.trial_days'), 10) || 30;
    const trialFin = saasUtils.sumarDias(hoy, trialDays);

    try {
        // Hash ANTES de la transacción (bcrypt es lento y no debe bloquear la DB)
        const hash = bcrypt.hashSync(password, 10);

        const crearTodo = db.transaction(() => {
            // 1. Tienda en plan demo
            const info = db.prepare(`
                INSERT INTO tiendas (slug, nombre, activo, plan, trial_inicio, trial_fin)
                VALUES (?, ?, 1, 'demo', ?, ?)
            `).run(slug, nombre, hoy, trialFin);
            const tiendaId = Number(info.lastInsertRowid);

            // 2. Dueño (usuario de tienda). Sin password_plain (alta pública).
            db.prepare(`
                INSERT INTO usuarios (usuario, password, email, tienda_id, es_superadmin)
                VALUES (?, ?, ?, ?, 0)
            `).run(usuario, hash, email, tiendaId);

            // 3. Config por defecto (con el nombre real de la tienda)
            insertarConfigPorDefecto(tiendaId, { tienda_nombre: nombre });

            // 4. Categorías por defecto
            insertarCategoriasPorDefecto(tiendaId);

            // 5. Evento de auditoría
            db.prepare(`
                INSERT INTO store_events (tienda_id, tipo, detalle)
                VALUES (?, 'tienda_creada', ?)
            `).run(tiendaId, 'Alta automática DEMO ' + trialDays + ' días (válida hasta ' + trialFin + ')');

            return tiendaId;
        });

        const tiendaId = crearTodo();

        // Tienda recién creada (para el mail de bienvenida y la sesión)
        const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE id = ?').get(tiendaId);

        // Correo de confirmación/bienvenida (fire-and-forget, no bloquea el alta)
        enviarMailBienvenida({
            tienda,
            usuario,
            email,
            trialFin,
            trialDays,
        });

        // Auto-login del nuevo dueño (self-service)
        req.session.user = {
            id: Number(db.prepare('SELECT id FROM usuarios WHERE tienda_id = ? AND es_superadmin = 0').get(tiendaId).id),
            usuario,
            tienda_id: tiendaId,
            tiendaSlug: tienda.slug,
            es_superadmin: false,
        };
        // Evitar que el middleware de tienda pisote el slug correcto
        if (req.session) {
            req.session.tiendaSlugVisitante = tienda.slug;
            req.session.tiendaIdVisitante = tiendaId;
        }

        req.session.save((err) => {
            if (err) {
                console.error('[SAAS] Error al guardar sesión tras registro:', err.message);
                return res.status(500).json({ error: 'Tienda creada, pero hubo un error al iniciar sesión' });
            }
            res.json({
                ok: true,
                tiendaId,
                slug: tienda.slug,
                tiendaSlug: tienda.slug,
                usuario,
                email,
                plan: 'demo',
                trialFin,
            });
        });
    } catch (err) {
        console.error('[SAAS] Error al registrar tienda:', err.message);
        return res.status(500).json({ error: 'No se pudo crear tu tienda. Intentá de nuevo en unos segundos' });
    }
};

// GET /api/saas/disponibilidad?slug=...
// Utilidad para el formulario de registro (validación en vivo)
exports.checkDisponibilidad = (req, res) => {
    const slug = String((req.query && req.query.slug) || '').trim().toLowerCase();
    if (!slug) {
        return res.status(400).json({ error: 'Slug requerido' });
    }
    const valido = saasUtils.esSlugValido(slug);
    res.json({
        slug,
        valido,
        disponible: valido && !saasUtils.existeSlug(slug),
        reservado: saasUtils.esSlugReservado(slug),
    });
};

// GET /api/saas/plan (requiere auth de dueño de tienda)
// Devuelve el estado comercial derivado + datos del plan para el panel del
// dueño (banner estado/plan, cuenta regresiva y CTA de renovación).
// Recalcula el estado en vivo con saasUtils (no depende de req.planInfo,
// aunque suele coincidir porque ambos usan la misma función).
exports.getPlanEstado = (req, res) => {
    const user = req.session && req.session.user;
    if (!user || user.es_superadmin) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const tiendaId = user.tienda_id || req.tiendaId;
    if (!tiendaId) {
        return res.status(400).json({ error: 'No hay tienda asociada a la sesión' });
    }

    try {
        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const e = saasUtils.obtenerEstadoTienda(tienda);
        const esIlimitado = String(tienda.plan || 'ilimitado') === 'ilimitado';

        const config = {
            planNombre: saasUtils.getGlobalConfig('saas.plan_name') || 'Profesional',
            precioMensualArs: parseInt(saasUtils.getGlobalConfig('saas.monto_mensual_ars'), 10) || 5000,
            moneda: 'ARS',
            diasAviso: parseInt(saasUtils.getGlobalConfig('saas.warning_days'), 10) || 3,
        };

        res.json({
            ok: true,
            tiendaId,
            slug: tienda.slug,
            nombre: tienda.nombre,
            plan: e.plan || 'ilimitado',
            estado: e.estado,
            etiqueta: saasUtils.etiquetaEstado(tienda),
            diasRestantes: e.diasRestantes,
            trialInicio: tienda.trial_inicio || null,
            trialFin: tienda.trial_fin || null,
            suscripcionFin: tienda.suscripcion_fin || null,
            fechaFin:
                e.estado === saasUtils.ESTADOS.DEMO
                    ? tienda.trial_fin || null
                    : !esIlimitado
                        ? tienda.suscripcion_fin || null
                        : null,
            esIlimitado,
            config,
        });
    } catch (err) {
        console.error('[SAAS] Error al obtener plan de tienda ' + tiendaId + ':', err.message);
        return res.status(500).json({ error: 'No se pudo obtener el estado de tu plan' });
    }
};

// GET /api/saas/info-publica - Datos de marketing del plan (SIN auth).
// Lo usa la landing para mostrar el precio/plan vigente sin hardcodearlo.
// Devuelve SOLO campos seguros para público (nunca datos de tiendas/usuarios).
exports.getInfoPublica = (req, res) => {
    try {
        res.json({
            ok: true,
            config: {
                planNombre: saasUtils.getGlobalConfig('saas.plan_name') || 'Profesional',
                precioMensualArs: parseInt(saasUtils.getGlobalConfig('saas.monto_mensual_ars'), 10) || 5000,
                moneda: 'ARS',
                diasPrueba: parseInt(saasUtils.getGlobalConfig('saas.trial_days'), 10) || 30,
            },
        });
    } catch (err) {
        console.error('[SAAS] Error al obtener info pública:', err.message);
        res.status(500).json({ error: 'No se pudo obtener la información del plan' });
    }
};
