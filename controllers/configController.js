const db = require('../database/db');
const fs = require('fs');
const path = require('path');

// GET /api/config - Pública, devuelve { clave: valor, ... }
exports.getConfig = (req, res) => {
    try {
        const rows = db.prepare('SELECT clave, valor FROM configuracion').all();
        const config = {};
        rows.forEach(row => {
            config[row.clave] = row.valor;
        });
        res.json(config);
    } catch (err) {
        console.error('Error al obtener configuración:', err.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

// GET /api/config/admin - Requiere auth, devuelve [{ clave, valor, tipo, grupo }, ...]
exports.getConfigAdmin = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM configuracion ORDER BY grupo, clave').all();
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener configuración admin:', err.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

// PUT /api/config/:clave - Actualizar un valor específico
exports.updateConfig = (req, res) => {
    const { clave } = req.params;
    const { valor } = req.body;

    if (valor === undefined || valor === null) {
        return res.status(400).json({ error: 'Valor requerido' });
    }

    try {
        // Verificar que la clave existe
        const existente = db.prepare('SELECT * FROM configuracion WHERE clave = ?').get(clave);
        if (!existente) {
            return res.status(404).json({ error: 'Clave de configuración no encontrada' });
        }

        // Validar según el tipo
        const tipo = existente.tipo;
        let valorFinal = String(valor);

        if (tipo === 'color') {
            if (!/^#[0-9a-fA-F]{6}$/.test(valorFinal)) {
                return res.status(400).json({ error: 'Formato de color inválido. Use #RRGGBB' });
            }
        }

        if (tipo === 'booleano') {
            if (valorFinal !== 'true' && valorFinal !== 'false') {
                return res.status(400).json({ error: 'Valor booleano inválido. Use true o false' });
            }
        }

        if (tipo === 'numero') {
            if (isNaN(Number(valorFinal))) {
                return res.status(400).json({ error: 'Valor numérico inválido' });
            }
        }

        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run(valorFinal, clave);
        res.json({ ok: true, clave, valor: valorFinal });
    } catch (err) {
        console.error('Error al actualizar configuración:', err.message);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};

// POST /api/config/logo - Subir imagen de logo
exports.uploadLogo = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Archivo de imagen requerido' });
        }

        const url = '/uploads/' + req.file.filename;

        // Actualizar la clave logo_imagen en la DB
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run(url, 'logo_imagen');

        res.json({ ok: true, url });
    } catch (err) {
        console.error('Error al subir logo:', err.message);
        res.status(500).json({ error: 'Error al subir logo' });
    }
};

// POST /api/config/hero-imagen - Subir imagen de hero
exports.uploadHero = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Archivo de imagen requerido' });
        }

        const url = '/uploads/' + req.file.filename;

        // Actualizar la clave hero_imagen en la DB
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run(url, 'hero_imagen');

        res.json({ ok: true, url });
    } catch (err) {
        console.error('Error al subir imagen de hero:', err.message);
        res.status(500).json({ error: 'Error al subir imagen de hero' });
    }
};
