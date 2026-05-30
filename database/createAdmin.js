const bcrypt = require('bcrypt');
const db = require('./db');

async function crearAdmin() {
    const hash = await bcrypt.hash('Super1234', 10);

    // Obtener ID de la tienda por defecto
    const tiendaDefault = db.prepare('SELECT id FROM tiendas WHERE slug = ?').get('tienda1');
    const tiendaId = tiendaDefault ? tiendaDefault.id : 1;

    const row = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get('admin');

    if (!row) {
        db.prepare('INSERT INTO usuarios(usuario, password, password_plain, tienda_id, es_superadmin) VALUES (?, ?, ?, ?, ?)').run('admin', hash, 'Super1234', tiendaId, 1);
        console.log('Admin creado como superadmin para tienda_id=' + tiendaId);
    } else {
        // Asegurar que el admin existente sea superadmin
        db.prepare('UPDATE usuarios SET es_superadmin = 1, tienda_id = ?, password_plain = ? WHERE usuario = ?').run(tiendaId, 'Super1234', 'admin');
        console.log('Admin actualizado a superadmin');
    }

    process.exit();
}

crearAdmin();
