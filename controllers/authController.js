const db = require('../database/db');
const bcrypt = require('bcrypt');

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
        // Verificar que la tienda existe
        const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(slug);
        if (!tienda) {
            return res.status(401).json({ error: 'Tienda no encontrada o inactiva' });
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

    res.json({ 
        ok: true,
        user: req.session.user 
    });
};
