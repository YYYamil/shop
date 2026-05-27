const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

// Habilitar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');

// Crear tablas si no existen
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT
    )
`);

db.exec(`
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

db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT,
        telefono TEXT,
        total REAL,
        estado TEXT,
        fecha TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS pedido_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER,
        producto_id INTEGER,
        nombre TEXT,
        cantidad INTEGER,
        precio REAL
    )
`);

// Insertar categorías por defecto si no existen
const count = db.prepare('SELECT COUNT(*) as total FROM categorias').get();
if (count.total === 0) {
    db.prepare(`INSERT INTO categorias(nombre) VALUES ('Ropa'), ('Calzado'), ('Accesorios')`).run();
}

module.exports = db;
