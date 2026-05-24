const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(path.join(__dirname, '../database.db'));



async function crearAdmin() {

    const hash = await bcrypt.hash(

        'admin123',

        10

    );



    db.get(

        'SELECT * FROM usuarios WHERE usuario = ?',

        ['admin'],

        (err, row) => {

            if (!row) {

                db.run(

                    'INSERT INTO usuarios(usuario, password) VALUES (?, ?)',

                    ['admin', hash],

                    () => {

                        console.log('Admin creado');

                        process.exit();

                    }

                );

            }

            else {

                console.log('Admin ya existe');

                process.exit();

            }

        }

    );

}



crearAdmin();