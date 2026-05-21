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

        res.json(rows);

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



    let imagen = '';



    if (req.file) {

        imagen = '/uploads/' + req.file.filename;

    }



    db.run(`

        INSERT INTO productos

        (

            nombre,

            precio,

            descripcion,

            imagen,

            stock,

            categoria_id

        )

        VALUES (?, ?, ?, ?, ?, ?)

    `,

    [

        nombre,

        precio,

        descripcion,

        imagen,

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

        imagenActual

    } = req.body;



    let imagen = imagenActual;



    if (req.file) {

        imagen = '/uploads/' + req.file.filename;



        if (

            imagenActual &&

            fs.existsSync(

                '.' + imagenActual

            )

        ) {

            fs.unlinkSync(

                '.' + imagenActual

            );

        }

    }



    db.run(`

        UPDATE productos

        SET

            nombre = ?,

            precio = ?,

            descripcion = ?,

            imagen = ?,

            stock = ?,

            categoria_id = ?

        WHERE id = ?

    `,

    [

        nombre,

        precio,

        descripcion,

        imagen,

        stock,

        categoria_id,

        id

    ],

    function(err) {

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

            if (

                producto.imagen &&

                fs.existsSync(

                    '.' + producto.imagen

                )

            ) {

                fs.unlinkSync(

                    '.' + producto.imagen

                );

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