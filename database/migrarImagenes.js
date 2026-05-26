const sqlite3 = require('sqlite3').verbose();
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

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Verificar si existe la columna 'imagen'
    db.all("PRAGMA table_info(productos)", (err, rows) => {
        if (err) {
            console.error('Error:', err);
            process.exit(1);
        }

        const tieneImagen = rows.some(r => r.name === 'imagen');
        const tieneImagenes = rows.some(r => r.name === 'imagenes');

        console.log('Columnas actuales:', rows.map(r => r.name).join(', '));

        if (tieneImagenes) {
            console.log('La columna imagenes ya existe. Solo migraremos datos.');
            // Migrar datos de imagen a imagenes si es necesario
            db.all("SELECT id, imagen, imagenes FROM productos", (err, productos) => {
                if (err) {
                    console.error('Error:', err);
                    process.exit(1);
                }
                let pendientes = productos.length || 1;
                if (productos.length === 0) {
                    console.log('No hay productos para migrar.');
                    process.exit(0);
                }
                productos.forEach(p => {
                    let arr = [];
                    try { arr = JSON.parse(p.imagenes || '[]'); } catch(e) { arr = []; }
                    if (!Array.isArray(arr)) arr = [];

                    if (p.imagen && p.imagen.trim() !== '' && !arr.includes(p.imagen)) {
                        arr.unshift(p.imagen);
                    }

                    const nuevo = JSON.stringify(arr);
                    db.run("UPDATE productos SET imagenes = ? WHERE id = ?", [nuevo, p.id], (err2) => {
                        if (err2) console.error('Error actualizando', p.id, err2);
                        else console.log(`Producto ${p.id}: ${nuevo}`);
                        pendientes--;
                        if (pendientes <= 0) {
                            console.log('Migración completada.');
                            process.exit(0);
                        }
                    });
                });
            });
        } else if (tieneImagen) {
            // Renombrar columna imagen -> imagenes (SQLite no soporta RENAME COLUMN fácil)
            console.log('Renombrando columna imagen -> imagenes...');

            db.run("ALTER TABLE productos RENAME TO productos_old", (err) => {
                if (err) { console.error('Error renaming:', err); process.exit(1); }

                db.run(`
                    CREATE TABLE productos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        nombre TEXT,
                        precio REAL,
                        descripcion TEXT,
                        imagenes TEXT DEFAULT '[]',
                        stock INTEGER,
                        categoria_id INTEGER
                    )
                `, (err) => {
                    if (err) { console.error('Error creating:', err); process.exit(1); }

                    db.run(`
                        INSERT INTO productos (id, nombre, precio, descripcion, imagenes, stock, categoria_id)
                        SELECT id, nombre, precio, descripcion,
                            CASE WHEN imagen IS NOT NULL AND imagen != '' THEN '["' || imagen || '"]' ELSE '[]' END,
                            stock, categoria_id
                        FROM productos_old
                    `, (err) => {
                        if (err) { console.error('Error inserting:', err); process.exit(1); }

                        db.run("DROP TABLE productos_old", (err) => {
                            if (err) { console.error('Error dropping:', err); process.exit(1); }
                            console.log('Migración completada. Columna imagen -> imagenes.');
                            process.exit(0);
                        });
                    });
                });
            });
        } else {
            console.log('No se encontró columna imagen ni imagenes. Verifica la estructura.');
            process.exit(1);
        }
    });
});
