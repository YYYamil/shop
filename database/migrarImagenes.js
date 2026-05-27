const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'database.db');
const backupPath = path.join(__dirname, '..', 'database.backup.db');

console.log('Iniciando migración de columna imagen -> imagenes...');

// Hacer backup
if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log('Backup creado: database.backup.db');
}

const db = new Database(dbPath);

// 1. Verificar si existe la columna 'imagen'
const columns = db.prepare("PRAGMA table_info(productos)").all();
const tieneImagen = columns.some(r => r.name === 'imagen');
const tieneImagenes = columns.some(r => r.name === 'imagenes');

console.log('Columnas actuales:', columns.map(r => r.name).join(', '));

if (tieneImagenes) {
    console.log('La columna imagenes ya existe. Solo migraremos datos.');
    // Migrar datos de imagen a imagenes si es necesario
    const productos = db.prepare("SELECT id, imagen, imagenes FROM productos").all();

    if (productos.length === 0) {
        console.log('No hay productos para migrar.');
        process.exit(0);
    }

    const updateStmt = db.prepare("UPDATE productos SET imagenes = ? WHERE id = ?");
    const migrar = db.transaction((productos) => {
        for (const p of productos) {
            let arr = [];
            try { arr = JSON.parse(p.imagenes || '[]'); } catch(e) { arr = []; }
            if (!Array.isArray(arr)) arr = [];

            if (p.imagen && p.imagen.trim() !== '' && !arr.includes(p.imagen)) {
                arr.unshift(p.imagen);
            }

            const nuevo = JSON.stringify(arr);
            updateStmt.run(nuevo, p.id);
            console.log(`Producto ${p.id}: ${nuevo}`);
        }
    });

    migrar(productos);
    console.log('Migración completada.');
    process.exit(0);

} else if (tieneImagen) {
    // Renombrar columna imagen -> imagenes (SQLite no soporta RENAME COLUMN fácil)
    console.log('Renombrando columna imagen -> imagenes...');

    db.exec("ALTER TABLE productos RENAME TO productos_old");

    db.exec(`
        CREATE TABLE productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            precio REAL,
            descripcion TEXT,
            imagenes TEXT DEFAULT '[]',
            stock INTEGER,
            categoria_id INTEGER
        )
    `);

    db.exec(`
        INSERT INTO productos (id, nombre, precio, descripcion, imagenes, stock, categoria_id)
        SELECT id, nombre, precio, descripcion,
            CASE WHEN imagen IS NOT NULL AND imagen != '' THEN '["' || imagen || '"]' ELSE '[]' END,
            stock, categoria_id
        FROM productos_old
    `);

    db.exec("DROP TABLE productos_old");
    console.log('Migración completada. Columna imagen -> imagenes.');
    process.exit(0);

} else {
    console.log('No se encontró columna imagen ni imagenes. Verifica la estructura.');
    process.exit(1);
}
