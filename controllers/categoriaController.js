const db = require('../database/db');



exports.getCategorias = (req, res) => {

    db.all(

        'SELECT * FROM categorias',

        [],

        (err, rows) => {

            res.json(rows);

        }

    );

};



exports.crearCategoria = (req, res) => {

    const {

        nombre

    } = req.body;



    db.run(

        'INSERT INTO categorias(nombre) VALUES (?)',

        [nombre],

        function(err) {

            res.json({

                ok: true

            });

        }

    );

};



exports.eliminarCategoria = (req, res) => {

    const id = req.params.id;



    db.run(

        'DELETE FROM categorias WHERE id = ?',

        [id],

        function(err) {

            res.json({

                ok: true

            });

        }

    );

};