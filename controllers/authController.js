const db = require('../database/db');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
    const { usuario, password } = req.body;

    try {
        const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);

        if (!user) {
            return res.status(401).json({ error: 'Usuario incorrecto' });
        }

        const ok = await bcrypt.compare(password, user.password);

        if (!ok) {
            return res.status(401).json({ error: 'Password incorrecto' });
        }

        // Guardar sesión
        req.session.user = {
            id: user.id,
            usuario: user.usuario
        };

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Error de sesión' });
            res.json({ ok: true });
        });
    } catch (err) {
        console.error('Error en login:', err.message);
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
