const db = require('../database/db');

// GET /categorias - Todas las categorías (para admin)
exports.getCategorias = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM productos WHERE categoria_id = c.id AND tienda_id = ?) as product_count
            FROM categorias c
            WHERE c.tienda_id = ?
            ORDER BY c.id ASC
        `).all(tiendaId, tiendaId);
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener categorías:', err.message);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

// GET /categorias/public - Solo categorías visibles (para frontend tienda)
exports.getCategoriasPublic = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare(`
            SELECT id,
                   COALESCE(nombre_personalizado, nombre) as nombre,
                   visible
            FROM categorias
            WHERE visible = 1 AND tienda_id = ?
            ORDER BY id ASC
        `).all(tiendaId);
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener categorías públicas:', err.message);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

// PUT /categorias/:id - Actualizar nombre_personalizado y/o visible
exports.actualizarCategoria = (req, res) => {
    const id = req.params.id;
    const { nombre_personalizado, visible } = req.body;
    const tiendaId = req.tiendaId || 1;

    try {
        // Validar que la categoría existe y pertenece a la tienda
        const existente = db.prepare('SELECT * FROM categorias WHERE id = ? AND tienda_id = ?').get(id, tiendaId);
        if (!existente) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        // Construir UPDATE dinámico solo con los campos enviados
        const updates = [];
        const params = [];

        if (nombre_personalizado !== undefined) {
            updates.push('nombre_personalizado = ?');
            params.push(nombre_personalizado === '' ? null : nombre_personalizado);
        }

        if (visible !== undefined) {
            updates.push('visible = ?');
            params.push(visible ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        params.push(id);
        params.push(tiendaId);
        db.prepare(`UPDATE categorias SET ${updates.join(', ')} WHERE id = ? AND tienda_id = ?`).run(...params);

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al actualizar categoría:', err.message);
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
};

exports.crearCategoria = (req, res) => {
    const { nombre } = req.body;
    const tiendaId = req.tiendaId || 1;

    try {
        db.prepare('INSERT INTO categorias(nombre, tienda_id) VALUES (?, ?)').run(nombre, tiendaId);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al crear categoría:', err.message);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
};

exports.eliminarCategoria = (req, res) => {
    const id = req.params.id;
    const tiendaId = req.tiendaId || 1;

    try {
        db.prepare('DELETE FROM categorias WHERE id = ? AND tienda_id = ?').run(id, tiendaId);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al eliminar categoría:', err.message);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
};
