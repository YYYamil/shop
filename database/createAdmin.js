const bcrypt = require('bcrypt');
const db = require('./db');

async function crearAdmin() {
    const hash = await bcrypt.hash('admin123', 10);

    const row = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get('admin');

    if (!row) {
        db.prepare('INSERT INTO usuarios(usuario, password) VALUES (?, ?)').run('admin', hash);
        console.log('Admin creado');
    } else {
        console.log('Admin ya existe');
    }

    process.exit();
}

crearAdmin();
