const db = require('../database/db');
const fs = require('fs');
const path = require('path');

// GET /api/config - Pública, devuelve { clave: valor, ... }
exports.getConfig = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id = ?').all(tiendaId);
        const config = {};
        rows.forEach(row => {
            config[row.clave] = row.valor;
        });
        // No cache
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(config);
    } catch (err) {
        console.error('Error al obtener configuración:', err.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

// GET /api/config/slug/:slug - Pública, usa slug de la ruta (más confiable que query param)
exports.getConfigBySlug = (req, res) => {
    try {
        const { slug } = req.params;
        
        // Buscar tienda por slug
        const db = require('../database/db');
        const tienda = db.prepare('SELECT id FROM tiendas WHERE slug = ? AND activo = 1').get(slug);
        
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }
        
        const rows = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id = ?').all(tienda.id);
        const config = {};
        rows.forEach(row => {
            config[row.clave] = row.valor;
        });
        
        // No cache
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(config);
    } catch (err) {
        console.error('Error al obtener configuración por slug:', err.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

// GET /api/config/admin - Requiere auth, devuelve [{ clave, valor, tipo, grupo }, ...]
exports.getConfigAdmin = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare('SELECT * FROM configuracion WHERE tienda_id = ? ORDER BY grupo, clave').all(tiendaId);
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
    const tiendaId = req.tiendaId || 1;

    if (valor === undefined || valor === null) {
        return res.status(400).json({ error: 'Valor requerido' });
    }

    try {
        // Verificar que la clave existe para esta tienda
        const existente = db.prepare('SELECT * FROM configuracion WHERE clave = ? AND tienda_id = ?').get(clave, tiendaId);
        if (!existente) {
            return res.status(404).json({ error: 'Clave de configuración no encontrada' });
        }

        // Validar según el tipo
        const tipo = existente.tipo;
        let valorFinal = String(valor);

        // Validar que tienda_nombre no esté vacío
        if (clave === 'tienda_nombre' && !valorFinal.trim()) {
            return res.status(400).json({ error: 'El nombre de la tienda no puede estar vacío' });
        }

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

        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id = ?').run(valorFinal, clave, tiendaId);
        res.json({ ok: true, clave, valor: valorFinal });
    } catch (err) {
        console.error('Error al actualizar configuración:', err.message);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};

// POST /api/config/logo - Subir imagen de logo
exports.uploadLogo = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;

        if (!req.file) {
            return res.status(400).json({ error: 'Archivo de imagen requerido' });
        }

        const url = '/uploads/' + req.file.filename;

        // Actualizar la clave logo_imagen en la DB
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id = ?').run(url, 'logo_imagen', tiendaId);

        res.json({ ok: true, url });
    } catch (err) {
        console.error('Error al subir logo:', err.message);
        res.status(500).json({ error: 'Error al subir logo' });
    }
};

// POST /api/config/hero-imagen - Subir imagen de hero
exports.uploadHero = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;

        if (!req.file) {
            return res.status(400).json({ error: 'Archivo de imagen requerido' });
        }

        const url = '/uploads/' + req.file.filename;

        // Actualizar la clave hero_imagen en la DB
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id = ?').run(url, 'hero_imagen', tiendaId);

        res.json({ ok: true, url });
    } catch (err) {
        console.error('Error al subir imagen de hero:', err.message);
        res.status(500).json({ error: 'Error al subir imagen de hero' });
    }
};
