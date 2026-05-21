const db = require('../database/db');

const { v4: uuidv4 } = require('uuid');



exports.crearPedido = (req, res) => {

    const {

        cliente,

        telefono,

        productos,

        total

    } = req.body;



    if (

        !cliente ||

        !telefono ||

        productos.length === 0

    ) {

        return res.status(400).json({

            error: 'Datos incompletos'

        });

    }



    const codigo = uuidv4()

        .split('-')[0]

        .toUpperCase();



    db.run(`

        INSERT INTO pedidos

        (

            cliente,

            telefono,

            total,

            estado,

            fecha

        )

        VALUES (?, ?, ?, ?, ?)

    `,

    [

        cliente,

        telefono,

        total,

        'Pendiente',

        new Date().toLocaleString()

    ],

    function(err) {

        const pedidoId = this.lastID;



        let errorStock = false;



        productos.forEach(producto => {

            db.get(

                'SELECT * FROM productos WHERE id = ?',

                [producto.id],

                (err, productoDB) => {

                    if (

                        !productoDB ||

                        productoDB.stock < producto.cantidad

                    ) {

                        errorStock = true;

                    }

                    else {

                        db.run(`

                            UPDATE productos

                            SET stock = stock - ?

                            WHERE id = ?

                        `,

                        [

                            producto.cantidad,

                            producto.id

                        ]);



                        db.run(`

                            INSERT INTO pedido_items

                            (

                                pedido_id,

                                producto_id,

                                nombre,

                                cantidad,

                                precio

                            )

                            VALUES (?, ?, ?, ?, ?)

                        `,

                        [

                            pedidoId,

                            producto.id,

                            producto.nombre,

                            producto.cantidad,

                            producto.precio

                        ]);

                    }

                }

            );

        });



        setTimeout(() => {

            if (errorStock) {

                return res.status(400).json({

                    error: 'Sin stock'

                });

            }



            res.json({

                ok: true,

                pedidoId,

                codigo

            });

        }, 500);

    });

};



exports.getPedidos = (req, res) => {

    db.all(

        'SELECT * FROM pedidos ORDER BY id DESC',

        [],

        (err, pedidos) => {

            res.json(pedidos);

        }

    );

};



exports.cambiarEstado = (req, res) => {

    const id = req.params.id;

    const {

        estado

    } = req.body;



    db.run(

        'UPDATE pedidos SET estado = ? WHERE id = ?',

        [estado, id],

        function(err) {

            res.json({

                ok: true

            });

        }

    );

};



exports.getItemsPedido = (req, res) => {

    const id = req.params.id;



    db.all(

        'SELECT * FROM pedido_items WHERE pedido_id = ?',

        [id],

        (err, rows) => {

            res.json(rows);

        }

    );

};