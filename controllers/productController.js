const db = require('../database/db');
const fs = require('fs');

// GET /productos - Todos los productos (para admin)
exports.getProductos = (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT
                productos.*,
                COALESCE(categorias.nombre_personalizado, categorias.nombre) as categoria
            FROM productos
            LEFT JOIN categorias
            ON categorias.id = productos.categoria_id
            ORDER BY productos.id DESC
        `).all();

        // Parsear el campo imagenes de JSON string a array
        const productos = rows.map(p => {
            try {
                p.imagenes = JSON.parse(p.imagenes || '[]');
            } catch(e) {
                p.imagenes = [];
            }
            return p;
        });
        res.json(productos);
    } catch (err) {
        console.error('Error al obtener productos:', err.message);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};

// GET /productos/public - Solo productos de categorías visibles (para frontend tienda)
exports.getProductosPublic = (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT
                productos.*,
                COALESCE(categorias.nombre_personalizado, categorias.nombre) as categoria
            FROM productos
            LEFT JOIN categorias ON categorias.id = productos.categoria_id
            WHERE (categorias.visible = 1 OR productos.categoria_id IS NULL)
            ORDER BY productos.id DESC
        `).all();

        const productos = rows.map(p => {
            try {
                p.imagenes = JSON.parse(p.imagenes || '[]');
            } catch(e) {
                p.imagenes = [];
            }
            return p;
        });
        res.json(productos);
    } catch (err) {
        console.error('Error al obtener productos públicos:', err.message);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};

exports.crearProducto = (req, res) => {
    const {
        nombre,
        precio,
        descripcion,
        stock,
        categoria_id
    } = req.body;

    if (!nombre || precio <= 0 || stock < 0) {
        return res.status(400).json({ error: 'Datos invalidos' });
    }

    let imagenes = [];
    if (req.files && req.files.length > 0) {
        imagenes = req.files.map(f => '/uploads/' + f.filename);
    }

    try {
        db.prepare(`
            INSERT INTO productos
            (nombre, precio, descripcion, imagenes, stock, categoria_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(nombre, precio, descripcion, JSON.stringify(imagenes), stock, categoria_id);

        res.json({ ok: true });
    } catch (err) {
        console.error('Error DB al crear producto:', err.message);
        res.status(500).json({ error: 'Error DB' });
    }
};

exports.editarProducto = (req, res) => {
    const id = req.params.id;
    const {
        nombre,
        precio,
        descripcion,
        stock,
        categoria_id,
        imagenesActual
    } = req.body;

    // Validar datos requeridos
    if (!nombre || precio <= 0 || stock < 0) {
        return res.status(400).json({ error: 'Datos invalidos' });
    }

    let imagenes = [];
    try {
        imagenes = JSON.parse(imagenesActual || '[]');
    } catch(e) {
        imagenes = [];
    }

    // Asegurar que sea un array y máximo 4
    if (!Array.isArray(imagenes)) imagenes = [];
    imagenes = imagenes.slice(0, 4);

    if (req.files && req.files.length > 0) {
        const nuevasImagenes = req.files.map(f => '/uploads/' + f.filename);

        // Reemplazar slots vacíos o agregar al final (máximo 4)
        for (let i = 0; i < nuevasImagenes.length && i < 4; i++) {
            const emptyIndex = imagenes.findIndex(img => !img || img === '');
            if (emptyIndex !== -1) {
                imagenes[emptyIndex] = nuevasImagenes[i];
            } else if (imagenes.length < 4) {
                imagenes.push(nuevasImagenes[i]);
            }
        }

        // Eliminar imágenes viejas que fueron reemplazadas
        try {
            const imagenesViejas = JSON.parse(imagenesActual || '[]');
            if (Array.isArray(imagenesViejas)) {
                imagenesViejas.forEach(img => {
                    if (
                        img &&
                        typeof img === 'string' &&
                        !imagenes.includes(img) &&
                        fs.existsSync('.' + img)
                    ) {
                        fs.unlinkSync('.' + img);
                    }
                });
            }
        } catch(e) {
            // Si no se puede parsear, ignorar
        }
    }

    try {
        const result = db.prepare(`
            UPDATE productos
            SET nombre = ?, precio = ?, descripcion = ?,
                imagenes = ?, stock = ?, categoria_id = ?
            WHERE id = ?
        `).run(nombre, precio, descripcion, JSON.stringify(imagenes), stock, categoria_id, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('Error DB al editar producto:', err.message);
        res.status(500).json({ error: 'Error al actualizar el producto en la base de datos' });
    }
};

exports.eliminarProducto = (req, res) => {
    const id = req.params.id;

    try {
        const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);

        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        if (producto.imagenes) {
            let imagenes = [];
            try {
                imagenes = JSON.parse(producto.imagenes || '[]');
            } catch(e) {}

            imagenes.forEach(img => {
                if (img && fs.existsSync('.' + img)) {
                    fs.unlinkSync('.' + img);
                }
            });
        }

        db.prepare('DELETE FROM productos WHERE id = ?').run(id);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al eliminar producto:', err.message);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};
