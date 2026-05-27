const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

exports.crearPedido = (req, res) => {
    const { cliente, telefono, productos, total } = req.body;

    if (!cliente || !telefono || productos.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const codigo = uuidv4().split('-')[0].toUpperCase();

    try {
        // Usar una transacción para asegurar atomicidad
        const crearPedido = db.transaction((cliente, telefono, total, productos) => {
            const result = db.prepare(`
                INSERT INTO pedidos (cliente, telefono, total, estado, fecha)
                VALUES (?, ?, ?, ?, ?)
            `).run(cliente, telefono, total, 'Pendiente', new Date().toLocaleString());

            const pedidoId = result.lastInsertRowid;

            let errorStock = false;

            for (const producto of productos) {
                const productoDB = db.prepare('SELECT * FROM productos WHERE id = ?').get(producto.id);

                if (!productoDB || productoDB.stock < producto.cantidad) {
                    errorStock = true;
                    break;
                }

                db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')
                    .run(producto.cantidad, producto.id);

                db.prepare(`
                    INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio)
                    VALUES (?, ?, ?, ?, ?)
                `).run(pedidoId, producto.id, producto.nombre, producto.cantidad, producto.precio);
            }

            return { pedidoId, errorStock };
        });

        const { pedidoId, errorStock } = crearPedido(cliente, telefono, total, productos);

        if (errorStock) {
            return res.status(400).json({ error: 'Sin stock' });
        }

        res.json({ ok: true, pedidoId, codigo });
    } catch (err) {
        console.error('Error al crear pedido:', err.message);
        res.status(500).json({ error: 'Error al crear pedido' });
    }
};

exports.getPedidos = (req, res) => {
    try {
        const pedidos = db.prepare('SELECT * FROM pedidos ORDER BY id DESC').all();
        res.json(pedidos);
    } catch (err) {
        console.error('Error al obtener pedidos:', err.message);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
};

exports.cambiarEstado = (req, res) => {
    const id = req.params.id;
    const { estado } = req.body;

    try {
        db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, id);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al cambiar estado:', err.message);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

exports.getItemsPedido = (req, res) => {
    const id = req.params.id;

    try {
        const rows = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(id);
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener items del pedido:', err.message);
        res.status(500).json({ error: 'Error al obtener items del pedido' });
    }
};
