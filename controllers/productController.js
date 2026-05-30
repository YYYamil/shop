const db = require('../database/db');
const fs = require('fs');

// GET /productos - Todos los productos (para admin)
exports.getProductos = (req, res) => {
    try {
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare(`
            SELECT
                productos.*,
                COALESCE(categorias.nombre_personalizado, categorias.nombre) as categoria
            FROM productos
            LEFT JOIN categorias
            ON categorias.id = productos.categoria_id
            WHERE productos.tienda_id = ?
            ORDER BY productos.id DESC
        `).all(tiendaId);

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
        const tiendaId = req.tiendaId || 1;
        const rows = db.prepare(`
            SELECT
                productos.*,
                COALESCE(categorias.nombre_personalizado, categorias.nombre) as categoria
            FROM productos
            LEFT JOIN categorias ON categorias.id = productos.categoria_id
            WHERE (categorias.visible = 1 OR productos.categoria_id IS NULL)
            AND productos.tienda_id = ?
            ORDER BY productos.id DESC
        `).all(tiendaId);

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
    const nombre = req.body.nombre || req.query.nombre;
    const precio = req.body.precio || req.query.precio;
    const descripcion = req.body.descripcion || req.query.descripcion;
    const stock = req.body.stock || req.query.stock;
    const categoria_id = req.body.categoria_id || req.query.categoria_id;
    let nuevo = req.body.nuevo;
    if (nuevo === undefined) nuevo = req.query.nuevo;
    let descuento = req.body.descuento;
    if (descuento === undefined) descuento = req.query.descuento;
    const tiendaId = req.tiendaId || 1;

    if (!nombre || precio <= 0 || stock < 0) {
        return res.status(400).json({ error: 'Datos invalidos' });
    }

    let imagenes = [];
    let archivos = [];
    if (Array.isArray(req.files)) {
        archivos = req.files;
    } else if (req.files && req.files.imagenes) {
        archivos = req.files.imagenes;
    }
    if (archivos.length > 0) {
        imagenes = archivos.map(f => '/uploads/' + f.filename);
    }

    const esNuevo = (nuevo === 'true' || nuevo === true || nuevo === 1 || nuevo === '1') ? 1 : 0;
    const desc = Math.min(Math.max(parseInt(descuento) || 0, 0), 100);

    try {
        db.prepare(`
            INSERT INTO productos
            (nombre, precio, descripcion, imagenes, stock, categoria_id, nuevo, descuento, tienda_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(nombre, precio, descripcion, JSON.stringify(imagenes), stock, categoria_id, esNuevo, desc, tiendaId);

        res.json({ ok: true });
    } catch (err) {
        console.error('Error DB al crear producto:', err.message);
        res.status(500).json({ error: 'Error DB' });
    }
};

exports.editarProducto = (req, res) => {
    const id = req.params.id;

    // Leer campos del body (multer puede no procesar algunos campos de texto)
    // Fallback a req.query por si el frontend los envía como query params
    const nombre = req.body.nombre || req.query.nombre;
    const precio = req.body.precio || req.query.precio;
    const descripcion = req.body.descripcion || req.query.descripcion;
    const stock = req.body.stock || req.query.stock;
    const categoria_id = req.body.categoria_id || req.query.categoria_id;
    const imagenesActual = req.body.imagenesActual || req.query.imagenesActual;
    let nuevo = req.body.nuevo;
    if (nuevo === undefined) nuevo = req.query.nuevo;
    let descuento = req.body.descuento;
    if (descuento === undefined) descuento = req.query.descuento;
    const tiendaId = req.tiendaId || 1;

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

    // Obtener archivos: soporta tanto upload.any() (array) como upload.fields() (objeto)
    let archivos = [];
    if (Array.isArray(req.files)) {
        archivos = req.files;
    } else if (req.files && req.files.imagenes) {
        archivos = req.files.imagenes;
    }

    if (archivos.length > 0) {
        const nuevasImagenes = archivos.map(f => '/uploads/' + f.filename);

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

    console.log('[editarProducto] id=%s body=%j', id, { nombre, precio, descripcion, stock, categoria_id, nuevo, descuento });

    const esNuevo = (nuevo === 'true' || nuevo === true || nuevo === 1 || nuevo === '1') ? 1 : 0;
    const desc = Math.min(Math.max(parseInt(descuento) || 0, 0), 100);

    console.log('[editarProducto] esNuevo=%d desc=%d', esNuevo, desc);

    try {
        const result = db.prepare(`
            UPDATE productos
            SET nombre = ?, precio = ?, descripcion = ?,
                imagenes = ?, stock = ?, categoria_id = ?,
                nuevo = ?, descuento = ?
            WHERE id = ? AND tienda_id = ?
        `).run(nombre, precio, descripcion, JSON.stringify(imagenes), stock, categoria_id, esNuevo, desc, id, tiendaId);

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
    const tiendaId = req.tiendaId || 1;

    try {
        const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND tienda_id = ?').get(id, tiendaId);

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

        db.prepare('DELETE FROM productos WHERE id = ? AND tienda_id = ?').run(id, tiendaId);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al eliminar producto:', err.message);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};
