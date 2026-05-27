const db = require('../database/db');

const fs = require('fs');



exports.getProductos = (req, res) => {

    db.all(`

        SELECT

            productos.*,

            categorias.nombre as categoria

        FROM productos

        LEFT JOIN categorias

        ON categorias.id = productos.categoria_id

        ORDER BY productos.id DESC

    `,

    [],

    (err, rows) => {

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

    });

};



exports.crearProducto = (req, res) => {

    const {

        nombre,

        precio,

        descripcion,

        stock,

        categoria_id

    } = req.body;



    if (

        !nombre ||

        precio <= 0 ||

        stock < 0

    ) {

        return res.status(400).json({

            error: 'Datos invalidos'

        });

    }



    let imagenes = [];



    if (req.files && req.files.length > 0) {

        imagenes = req.files.map(f => '/uploads/' + f.filename);

    }



    db.run(`

        INSERT INTO productos

        (

            nombre,

            precio,

            descripcion,

            imagenes,

            stock,

            categoria_id

        )

        VALUES (?, ?, ?, ?, ?, ?)

    `,

    [

        nombre,

        precio,

        descripcion,

        JSON.stringify(imagenes),

        stock,

        categoria_id

    ],

    function(err) {

        if (err) {

            return res.status(500).json({

                error: 'Error DB'

            });

        }



        res.json({

            ok: true

        });

    });

};



exports.editarProducto = (req, res) => {

    const id = req.params.id;



    const {

        nombre,

        precio,

        descripcion,

        stock,

        categoria_id,

        imagenesActual // viene como JSON string desde el frontend

    } = req.body;



    // Validar datos requeridos
    if (!nombre || precio <= 0 || stock < 0) {

        return res.status(400).json({

            error: 'Datos invalidos'

        });

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



    db.run(`

        UPDATE productos

        SET

            nombre = ?,

            precio = ?,

            descripcion = ?,

            imagenes = ?,

            stock = ?,

            categoria_id = ?

        WHERE id = ?

    `,

    [

        nombre,

        precio,

        descripcion,

        JSON.stringify(imagenes),

        stock,

        categoria_id,

        id

    ],

    function(err) {

        if (err) {

            console.error('Error DB al editar producto:', err.message);

            return res.status(500).json({

                error: 'Error al actualizar el producto en la base de datos'

            });

        }

        res.json({

            ok: true

        });

    });

};



exports.eliminarProducto = (req, res) => {

    const id = req.params.id;



    db.get(

        'SELECT * FROM productos WHERE id = ?',

        [id],

        (err, producto) => {

            if (producto && producto.imagenes) {

                let imagenes = [];
                try {
                    imagenes = JSON.parse(producto.imagenes || '[]');
                } catch(e) {}

                imagenes.forEach(img => {
                    if (
                        img &&
                        fs.existsSync('.' + img)
                    ) {
                        fs.unlinkSync('.' + img);
                    }
                });

            }



            db.run(

                'DELETE FROM productos WHERE id = ?',

                [id],

                function(err) {

                    res.json({

                        ok: true

                    });

                }

            );

        }

    );

};