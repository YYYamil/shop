const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

exports.crearPedido = (req, res) => {
    const { cliente, telefono, productos, total } = req.body;
    const tiendaId = req.tiendaId || 1;

    if (!cliente || !telefono || productos.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const codigo = uuidv4().split('-')[0].toUpperCase();

    try {
        const result = db.prepare(`
            INSERT INTO pedidos (cliente, telefono, total, estado, fecha, tienda_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(cliente, telefono, total, 'Pendiente', new Date().toLocaleString(), tiendaId);

        const pedidoId = result.lastInsertRowid;

        for (const producto of productos) {
            db.prepare(`
                INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, tienda_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(pedidoId, producto.id, producto.nombre, producto.cantidad, producto.precio, tiendaId);
        }

        res.json({ ok: true, pedidoId, codigo });
    } catch (err) {
        console.error('Error al crear pedido:', err.message);
        res.status(500).json({ error: 'Error al crear pedido' });
    }
};

exports.getPedidos = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const pedidos = db.prepare('SELECT * FROM pedidos WHERE tienda_id = ? ORDER BY id DESC').all(tiendaId);
        res.json(pedidos);
    } catch (err) {
        console.error('Error al obtener pedidos:', err.message);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
};

exports.cambiarEstado = (req, res) => {
    const id = req.params.id;
    const { estado } = req.body;
    const tiendaId = req.tiendaId || 1;

    try {
        const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND tienda_id = ?').get(id, tiendaId);
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        // Si ya está en un estado final, no permitir cambios
        if (pedido.estado === 'Entregado' || pedido.estado === 'Cancelado') {
            return res.status(400).json({ error: 'No se puede cambiar un pedido en estado final' });
        }

        // Obtener items del pedido para manejar stock
        const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ? AND tienda_id = ?').all(id, tiendaId);

        if (estado === 'Entregado') {
            // Solo Entregado descuenta stock
            for (const item of items) {
                const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND tienda_id = ?').get(item.producto_id, tiendaId);
                if (producto) {
                    if (producto.stock < item.cantidad) {
                        return res.status(400).json({ error: 'Stock insuficiente para producto: ' + item.nombre });
                    }
                    db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ? AND tienda_id = ?')
                        .run(item.cantidad, item.producto_id, tiendaId);
                }
            }
        }
        // Cancelado solo cambia el estado, NO modifica el stock

        db.prepare('UPDATE pedidos SET estado = ? WHERE id = ? AND tienda_id = ?').run(estado, id, tiendaId);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al cambiar estado:', err.message);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

exports.eliminarPedido = (req, res) => {
    const id = req.params.id;
    const tiendaId = req.tiendaId || 1;

    try {
        // Primero eliminar los items asociados (por la FK)
        db.prepare('DELETE FROM pedido_items WHERE pedido_id = ? AND tienda_id = ?').run(id, tiendaId);
        db.prepare('DELETE FROM pedidos WHERE id = ? AND tienda_id = ?').run(id, tiendaId);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al eliminar pedido:', err.message);
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
};

exports.getItemsPedido = (req, res) => {
    const id = req.params.id;
    const tiendaId = req.tiendaId || 1;

    try {
        const rows = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ? AND tienda_id = ?').all(id, tiendaId);
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener items del pedido:', err.message);
        res.status(500).json({ error: 'Error al obtener items del pedido' });
    }
};
