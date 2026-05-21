const bcrypt = require('bcrypt');

const db = require('./db');



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