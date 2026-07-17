const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const SECRET_CONFIG_KEYS = new Set([
    'mp_access_token',
    'mp_public_key',
    'mp_refresh_token',
    'mp_user_id',
    'mp_seller_id',
    'mp_token_expires_at',
]);

function buildConfigMap(rows, tiendaId) {
    const config = {};
    let mpConectado = false;

    rows.forEach(row => {
        if (SECRET_CONFIG_KEYS.has(row.clave)) {
            if (row.clave === 'mp_access_token' && row.valor) {
                mpConectado = true;
            }
            return;
        }

        config[row.clave] = row.valor;
    });

    config.mp_conectado = mpConectado;
    config.mp_activo = mpConectado;
    config.tienda_id = tiendaId;

    return config;
}

// GET /api/config - public, returns { clave: valor, ... }
exports.getConfig = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id = ?').all(tiendaId);
        const config = buildConfigMap(rows, tiendaId);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(config);
    } catch (err) {
        console.error('Error al obtener configuracion:', err.message);
        res.status(500).json({ error: 'Error al obtener configuracion' });
    }
};

// GET /api/config/slug/:slug - public, uses slug from the path
exports.getConfigBySlug = (req, res) => {
    try {
        const { slug } = req.params;
        const tienda = db.prepare('SELECT id FROM tiendas WHERE slug = ? AND activo = 1').get(slug);

        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const rows = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id = ?').all(tienda.id);
        const config = buildConfigMap(rows, tienda.id);

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(config);
    } catch (err) {
        console.error('Error al obtener configuracion por slug:', err.message);
        res.status(500).json({ error: 'Error al obtener configuracion' });
    }
};

// GET /api/config/admin - auth required, returns rows without secrets
exports.getConfigAdmin = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare('SELECT * FROM configuracion WHERE tienda_id = ? ORDER BY grupo, clave').all(tiendaId);
        res.json(rows.filter(row => !SECRET_CONFIG_KEYS.has(row.clave)));
    } catch (err) {
        console.error('Error al obtener configuracion admin:', err.message);
        res.status(500).json({ error: 'Error al obtener configuracion' });
    }
};

// PUT /api/config/:clave - update a specific value
exports.updateConfig = (req, res) => {
    const { clave } = req.params;
    const { valor } = req.body;
    const tiendaId = req.tiendaId || 1;

    if (valor === undefined || valor === null) {
        return res.status(400).json({ error: 'Valor requerido' });
    }

    try {
        if (SECRET_CONFIG_KEYS.has(clave)) {
            return res.status(403).json({ error: 'No esta permitido modificar esta clave desde el panel' });
        }

        let existente = db.prepare('SELECT * FROM configuracion WHERE clave = ? AND tienda_id = ?').get(clave, tiendaId);

        if (!existente) {
            const global = db.prepare('SELECT * FROM configuracion WHERE clave = ? AND tienda_id IS NULL').get(clave);
            if (global) {
                db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run(clave, String(valor), global.tipo, global.grupo, tiendaId);
                return res.json({ ok: true, clave, valor: String(valor) });
            }

            db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run(clave, String(valor), 'texto', 'general', tiendaId);
            return res.json({ ok: true, clave, valor: String(valor) });
        }

        const tipo = existente.tipo;
        let valorFinal = String(valor);

        if (clave === 'tienda_nombre' && !valorFinal.trim()) {
            return res.status(400).json({ error: 'El nombre de la tienda no puede estar vacio' });
        }

        if (tipo === 'color' && !/^#[0-9a-fA-F]{6}$/.test(valorFinal)) {
            return res.status(400).json({ error: 'Formato de color invalido. Use #RRGGBB' });
        }

        if (tipo === 'booleano' && valorFinal !== 'true' && valorFinal !== 'false') {
            return res.status(400).json({ error: 'Valor booleano invalido. Use true o false' });
        }

        if (tipo === 'numero' && isNaN(Number(valorFinal))) {
            return res.status(400).json({ error: 'Valor numerico invalido' });
        }

        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id = ?').run(valorFinal, clave, tiendaId);
        res.json({ ok: true, clave, valor: valorFinal });
    } catch (err) {
        console.error('Error al actualizar configuracion:', err.message);
        res.status(500).json({ error: 'Error al actualizar configuracion' });
    }
};

// POST /api/config/logo - upload logo image
exports.uploadLogo = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const tiendaSlug = req.tiendaSlug || 'general';

        if (!req.file) {
            return res.status(400).json({ error: 'Archivo de imagen requerido' });
        }

        const url = '/uploads/' + tiendaSlug + '/' + req.file.filename;
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id = ?').run(url, 'logo_imagen', tiendaId);

        res.json({ ok: true, url });
    } catch (err) {
        console.error('Error al subir logo:', err.message);
        res.status(500).json({ error: 'Error al subir logo' });
    }
};

// POST /api/config/hero-imagen - upload hero image
exports.uploadHero = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const tiendaSlug = req.tiendaSlug || 'general';

        if (!req.file) {
            return res.status(400).json({ error: 'Archivo de imagen requerido' });
        }

        const url = '/uploads/' + tiendaSlug + '/' + req.file.filename;
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id = ?').run(url, 'hero_imagen', tiendaId);

        res.json({ ok: true, url });
    } catch (err) {
        console.error('Error al subir imagen de hero:', err.message);
        res.status(500).json({ error: 'Error al subir imagen de hero' });
    }
};
