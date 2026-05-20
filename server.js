const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();

const PORT = 3000;

app.use(express.json());

app.use(express.static('public'));

const db = new sqlite3.Database('./database.db');



/* =========================
   TABLA PRODUCTOS
========================= */

db.serialize(() => {

    db.run(`

        CREATE TABLE IF NOT EXISTS productos (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            nombre TEXT,

            precio REAL,

            descripcion TEXT,

            imagen TEXT,

            stock INTEGER

        )

    `);

});



/* =========================
   OBTENER PRODUCTOS
========================= */

app.get('/productos', (req, res) => {

    db.all(
        'SELECT * FROM productos',
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).send(err.message);
            }

            res.json(rows);

        }
    );

});



/* =========================
   AGREGAR PRODUCTO
========================= */

app.post('/productos', (req, res) => {

    const {
        nombre,
        precio,
        descripcion,
        imagen,
        stock
    } = req.body;



    db.run(

        `
        INSERT INTO productos
        (nombre, precio, descripcion, imagen, stock)

        VALUES (?, ?, ?, ?, ?)
        `,

        [
            nombre,
            precio,
            descripcion,
            imagen,
            stock
        ],

        function(err) {

            if (err) {
                return res.status(500).send(err.message);
            }

            res.send({
                mensaje: 'Producto agregado'
            });

        }

    );

});



/* =========================
   EDITAR PRODUCTO
========================= */

app.put('/productos/:id', (req, res) => {

    const id = req.params.id;

    const {
        nombre,
        precio,
        descripcion,
        imagen,
        stock
    } = req.body;



    db.run(

        `
        UPDATE productos

        SET
            nombre = ?,
            precio = ?,
            descripcion = ?,
            imagen = ?,
            stock = ?

        WHERE id = ?
        `,

        [
            nombre,
            precio,
            descripcion,
            imagen,
            stock,
            id
        ],

        function(err) {

            if (err) {
                return res.status(500).send(err.message);
            }

            res.send({
                mensaje: 'Producto actualizado'
            });

        }

    );

});



/* =========================
   ELIMINAR PRODUCTO
========================= */

app.delete('/productos/:id', (req, res) => {

    const id = req.params.id;

    db.run(

        'DELETE FROM productos WHERE id = ?',

        [id],

        function(err) {

            if (err) {
                return res.status(500).send(err.message);
            }

            res.send({
                mensaje: 'Producto eliminado'
            });

        }

    );

});



app.listen(PORT, () => {

    console.log(
        `Servidor funcionando en http://localhost:${PORT}`
    );

});