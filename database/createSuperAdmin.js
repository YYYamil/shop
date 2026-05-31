/**
 * createSuperAdmin.js
 * 
 * Crea el usuario SuperAdmin inicial (sin asociar a ninguna tienda).
 * El SuperAdmin debe loguearse en /superadmin/ y desde ahí crear
 * las tiendas con sus respectivos admins.
 * 
 * Uso: node database/createSuperAdmin.js
 */

const bcrypt = require('bcrypt');
const db = require('./db');

async function crearSuperAdmin() {
    const usuario = 'admin';
    const passwordPlain = 'Super1234';
    const hash = await bcrypt.hash(passwordPlain, 10);

    const row = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);

    if (!row) {
        // Crear SuperAdmin sin tienda_id (NULL) y con es_superadmin=1
        db.prepare(
            'INSERT INTO usuarios (usuario, password, password_plain, tienda_id, es_superadmin) VALUES (?, ?, ?, NULL, 1)'
        ).run(usuario, hash, passwordPlain);
        console.log('✅ SuperAdmin creado exitosamente.');
    } else {
        // Si ya existe, asegurar que sea SuperAdmin y sin tienda asociada
        db.prepare(
            'UPDATE usuarios SET es_superadmin = 1, tienda_id = NULL, password = ?, password_plain = ? WHERE usuario = ?'
        ).run(hash, passwordPlain, usuario);
        console.log('✅ SuperAdmin actualizado (es_superadmin=1, tienda_id=NULL).');
    }

    console.log('   Usuario: ' + usuario);
    console.log('   Password: ' + passwordPlain);
    console.log('');
    console.log('Ingresa a http://localhost:3001/superadmin/ para gestionar tiendas.');

    process.exit();
}

crearSuperAdmin();
