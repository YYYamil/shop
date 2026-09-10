const crypto = require('crypto');
const db = require('../database/db');
const bcrypt = require('bcrypt');
const saasUtils = require('../utils/saasUtils');
const { enviarMail } = require('../utils/mailer');

// Login exclusivo para SUPERADMIN (solo desde /superadmin/login.html)
exports.loginSuperAdmin = async (req, res) => {
    const { usuario, password } = req.body;

    try {
        const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND es_superadmin = 1').get(usuario);

        if (!user) {
            return res.status(401).json({ error: 'Credenciales de SuperAdmin incorrectas' });
        }

        const ok = await bcrypt.compare(password, user.password);

        if (!ok) {
            return res.status(401).json({ error: 'Credenciales de SuperAdmin incorrectas' });
        }

        // SuperAdmin no tiene tienda asociada (tienda_id = NULL)
        req.session.user = {
            id: user.id,
            usuario: user.usuario,
            tienda_id: null,
            tiendaSlug: null,
            es_superadmin: true
        };

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Error de sesión' });
            res.json({
                ok: true,
                es_superadmin: true,
                tiendaSlug: null
            });
        });
    } catch (err) {
        console.error('Error en login superadmin:', err.message);
        return res.status(500).json({ error: 'Error en la base de datos' });
    }
};

// Login para ADMIN DE TIENDA (solo desde /:slug/admin/login.html)
exports.loginTienda = async (req, res) => {
    const { usuario, password, slug } = req.body;

    if (!slug) {
        return res.status(400).json({ error: 'Slug de tienda requerido' });
    }

    try {
        // Verificar que la tienda existe (incluye columnas de plan para derivar estado)
        const tienda = db.prepare(`
            SELECT id, slug, nombre, activo, plan, trial_inicio, trial_fin,
                   suscripcion_inicio, suscripcion_fin
            FROM tiendas WHERE slug = ? AND activo = 1
        `).get(slug);
        if (!tienda) {
            return res.status(401).json({ error: 'Tienda no encontrada o inactiva' });
        }

        // BLOQUE 3: estado DERIVADO por calendario. Una tienda con la prueba o la
        // suscripción vencidas (aunque activo=1) no puede iniciar sesión como dueño:
        // el login queda bloqueado hasta renovar (el superadmin puede verla/reactivarla).
        const estadoTienda = saasUtils.obtenerEstadoTienda(tienda);
        if (estadoTienda.estado === saasUtils.ESTADOS.SUSPENDIDO) {
            return res.status(403).json({
                error: 'Tu tienda está suspendida. Renová tu plan para volver a ingresar.',
                codigo: 'TIENDA_SUSPENDIDA',
                estado: estadoTienda.estado,
            });
        }

        // Buscar usuario que NO sea superadmin y pertenezca a esta tienda
        const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND tienda_id = ? AND es_superadmin = 0').get(usuario, tienda.id);

        if (!user) {
            return res.status(401).json({ error: 'Credenciales incorrectas para esta tienda' });
        }

        const ok = await bcrypt.compare(password, user.password);

        if (!ok) {
            return res.status(401).json({ error: 'Credenciales incorrectas para esta tienda' });
        }

        // Guardar sesión con datos multi-tenant
        req.session.user = {
            id: user.id,
            usuario: user.usuario,
            tienda_id: user.tienda_id,
            tiendaSlug: tienda.slug,
            es_superadmin: false
        };

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Error de sesión' });
            res.json({
                ok: true,
                es_superadmin: false,
                tiendaSlug: tienda.slug
            });
        });
    } catch (err) {
        console.error('Error en login tienda:', err.message);
        return res.status(500).json({ error: 'Error en la base de datos' });
    }
};

// ============================================
// AUTODETECCIÓN DE TIENDA (LOGIN INTUITIVO)
// ============================================
// GET /auth/tiendas-por-usuario
// Usado por el login /admin/login.html para que el dueño no tenga que tipear
// el slug de memoria:
//   ?usuario=... → busca la(s) tienda(s) del usuario (autodetección).
//   ?slug=...    → devuelve la tienda por slug (nombre/activo) para mostrar
//                  la etiqueta real cuando se llega desde /:slug/admin/login.html.
// Solo se expone slug + nombre (datos ya públicos en la URL de la tienda);
// nunca se devuelven correos ni datos sensibles.
exports.tiendasDeUsuario = (req, res) => {
    const usuario = String((req.query && req.query.usuario) || '').trim();
    const slug = String((req.query && req.query.slug) || '').trim().toLowerCase();

    try {
        let tiendas = [];

        if (slug) {
            const t = db.prepare(`
                SELECT id, slug, nombre, activo
                FROM tiendas
                WHERE slug = ?
            `).get(slug);
            if (t) {
                tiendas = [{
                    id: t.id,
                    slug: t.slug,
                    nombre: t.nombre,
                    activo: Boolean(t.activo),
                }];
            }
        } else if (usuario && usuario.length >= 2) {
            tiendas = db.prepare(`
                SELECT t.id, t.slug, t.nombre, t.activo
                FROM usuarios u
                JOIN tiendas t ON t.id = u.tienda_id
                WHERE u.usuario = ? COLLATE NOCASE
                  AND u.es_superadmin = 0
                  AND u.tienda_id IS NOT NULL
                ORDER BY t.nombre COLLATE NOCASE ASC
            `).all(usuario).map((t) => ({
                id: t.id,
                slug: t.slug,
                nombre: t.nombre,
                activo: Boolean(t.activo),
            }));
        }

        res.json({ ok: true, tiendas });
    } catch (err) {
        console.error('[AUTH] Error al detectar tiendas de usuario:', err.message);
        res.status(500).json({ error: 'No se pudo buscar tu tienda. Intentá de nuevo.' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.json({ ok: true });
    });
};

exports.verificar = (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const user = req.session.user;
    const payload = { ok: true, user };

    // BLOQUE 3: si es dueño de tienda, adjuntar estado comercial derivado en
    // vivo para que el panel muestre el banner estado/plan sin fetch extra.
    if (!user.es_superadmin && user.tienda_id) {
        try {
            const tienda = db.prepare(`
                SELECT id, slug, nombre, activo, plan, trial_inicio, trial_fin,
                       suscripcion_inicio, suscripcion_fin
                FROM tiendas WHERE id = ?
            `).get(user.tienda_id);
            if (tienda) {
                const e = saasUtils.obtenerEstadoTienda(tienda);
                payload.tiendaEstado = e.estado;
                payload.planInfo = {
                    plan: e.plan || 'ilimitado',
                    estado: e.estado,
                    etiqueta: saasUtils.etiquetaEstado(tienda),
                    diasRestantes: e.diasRestantes,
                    trialFin: tienda.trial_fin || null,
                    suscripcionFin: tienda.suscripcion_fin || null,
                };
            }
        } catch (err) {
            // Si la consulta falla, responder sin el estado (no bloquear)
        }
    }

    res.json(payload);
};

// ============================================
// RECUPERACIÓN DE CONTRASEÑA (FASE 1)
// ============================================
// POST /auth/recuperar  (público, sin sesión)
// Body: { usuario, email }
//
// El usuario pidió un mecanismo simple: NO se envía token ni link de
// reestablecimiento. Si el par (usuario, email) coincide con un dueño de
// tienda, el sistema genera una contraseña nueva, la guarda hasheada y se
// la envía por mail. La respuesta es siempre la misma para no revelar si
// la cuenta existe (evita enumeración de usuarios).
exports.recuperarPassword = async (req, res) => {
    const usuario = String((req.body && req.body.usuario) || '').trim();
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();

    const responderGenerico = () => res.json({
        ok: true,
        mensaje: 'Si el usuario y el correo coinciden con una cuenta, te enviamos una contraseña nueva.',
    });

    if (!usuario || !email) {
        return responderGenerico();
    }

    try {
        // Solo dueños de tienda (es_superadmin = 0). El SuperAdmin no gestiona
        // su contraseña por este canal.
        const user = db.prepare(`
            SELECT id, usuario, email, tienda_id
            FROM usuarios
            WHERE usuario = ? COLLATE NOCASE
              AND email = ? COLLATE NOCASE
              AND es_superadmin = 0
        `).get(usuario, email);

        // Respuesta genérica: no confirmar que el par NO existe.
        if (!user) {
            return responderGenerico();
        }

        // Generar contraseña legible (sin caracteres ambiguos) de 10 caracteres.
        const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let nuevaPassword = '';
        const bytes = crypto.randomBytes(10);
        for (let i = 0; i < bytes.length; i++) {
            nuevaPassword += alfabeto[bytes[i] % alfabeto.length];
        }

        const hash = await bcrypt.hash(nuevaPassword, 10);

        // Actualizar la contraseña dentro de una transacción + evento de auditoría.
        const cambiarPassword = db.transaction(() => {
            db.prepare('UPDATE usuarios SET password = ? WHERE id = ?').run(hash, user.id);
            const tiendaId = user.tienda_id || null;
            if (tiendaId) {
                db.prepare(`
                    INSERT INTO store_events (tienda_id, tipo, detalle)
                    VALUES (?, 'password_recuperada', ?)
                `).run(tiendaId, 'Contraseña reestablecida por correo (generada por el sistema)');
            }
        });
        cambiarPassword();

        const asunto = 'Tu nueva contraseña de Shop SaaS';
        const texto = [
            'Hola ' + user.usuario + ':',
            '',
            'Solicitaste recuperar tu contraseña de Shop SaaS.',
            'Tu nueva contraseña es:',
            '',
            '   ' + nuevaPassword,
            '',
            'Ingresá con tu usuario y esta contraseña en: ' + (process.env.PUBLIC_BASE_URL || 'https://shop.yamy.fun') + '/admin/login.html',
            '',
            'Te recomendamos cambiarla apenas puedas desde tu panel.',
            '',
            'Si no solicitaste este cambio, avisanos respondiendo este correo.',
        ].join('\n');

        const resultado = await enviarMail({
            to: user.email,
            subject: asunto,
            text: texto,
        });

        if (!resultado.ok) {
            // El mail no se pudo entregar: no cambiar la percepción del usuario
            // (se responde igual), pero se deja registrado el fallo.
            console.error('[AUTH] No se pudo enviar el correo de recuperación a', user.email, resultado.error || '');
            return responderGenerico();
        }

        return responderGenerico();
    } catch (err) {
        console.error('[AUTH] Error en recuperación de contraseña:', err.message);
        return res.status(500).json({ error: 'No se pudo procesar la solicitud. Intentá de nuevo.' });
    }
};
