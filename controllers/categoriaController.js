const db = require('../database/db');

exports.getCategorias = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM categorias').all();
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener categorías:', err.message);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

exports.crearCategoria = (req, res) => {
    const { nombre } = req.body;

    try {
        db.prepare('INSERT INTO categorias(nombre) VALUES (?)').run(nombre);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al crear categoría:', err.message);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
};

exports.eliminarCategoria = (req, res) => {
    const id = req.params.id;

    try {
        db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al eliminar categoría:', err.message);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
};
