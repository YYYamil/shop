const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

db.serialize(() => {

    db.run(`

        CREATE TABLE IF NOT EXISTS usuarios (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            usuario TEXT UNIQUE,

            password TEXT

        )

    `);




    db.run(`

        CREATE TABLE IF NOT EXISTS categorias (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            nombre TEXT

        )

    `);




    db.run(`

        CREATE TABLE IF NOT EXISTS productos (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            nombre TEXT,

            precio REAL,

            descripcion TEXT,

            imagenes TEXT DEFAULT '[]',

            stock INTEGER,

            categoria_id INTEGER

        )

    `);




    db.run(`

        CREATE TABLE IF NOT EXISTS pedidos (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            cliente TEXT,

            telefono TEXT,

            total REAL,

            estado TEXT,

            fecha TEXT

        )

    `);




    db.run(`

        CREATE TABLE IF NOT EXISTS pedido_items (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            pedido_id INTEGER,

            producto_id INTEGER,

            nombre TEXT,

            cantidad INTEGER,

            precio REAL

        )

    `);




    db.get(

        'SELECT COUNT(*) as total FROM categorias',

        [],

        (err, row) => {

            if (row.total === 0) {

                db.run(`

                    INSERT INTO categorias(nombre)

                    VALUES

                    ('Ropa'),

                    ('Calzado'),

                    ('Accesorios')

                `);

            }

        }

    );

});

module.exports = db;