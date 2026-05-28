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

// ============================================
// TABLA DE CONFIGURACIÓN (FASE 1 - Personalización)
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        tipo TEXT DEFAULT 'texto',
        grupo TEXT DEFAULT 'general'
    )
`);

const configCount = db.prepare('SELECT COUNT(*) as total FROM configuracion').get();
if (configCount.total === 0) {
    const insert = db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo) VALUES (?, ?, ?, ?)');

    const defaults = [
        // GENERAL
        ['tienda_nombre', 'Mi Shop', 'texto', 'general'],
        ['tienda_descripcion', 'Moda, estilo y tecnología para tu día a día.', 'texto', 'general'],

        // APARIENCIA
        ['color_primario', '#000000', 'color', 'apariencia'],
        ['color_secundario', '#444444', 'color', 'apariencia'],
        ['color_fondo', '#f4f4f4', 'color', 'apariencia'],
        ['color_texto', '#111827', 'color', 'apariencia'],
        ['color_boton', '#000000', 'color', 'apariencia'],
        ['color_boton_texto', '#ffffff', 'color', 'apariencia'],

        // HERO
        ['hero_titulo', 'Descubrí tu próximo estilo', 'texto', 'hero'],
        ['hero_descripcion', 'Productos modernos, elegantes y seleccionados para vos', 'texto', 'hero'],
        ['hero_fondo', 'linear-gradient(135deg, black, #444)', 'texto', 'hero'],
        ['hero_imagen', '', 'imagen', 'hero'],

        // WHATSAPP (flotante)
        ['whatsapp_numero', '', 'texto', 'whatsapp'],
        ['whatsapp_mensaje', 'Hola! Quiero consultar por un producto', 'texto', 'whatsapp'],
        ['whatsapp_activo', 'true', 'booleano', 'whatsapp'],

        // CONTACTO
        ['contacto_email', '', 'texto', 'contacto'],
        ['contacto_telefono', '', 'texto', 'contacto'],
        ['contacto_direccion', '', 'texto', 'contacto'],

        // REDES SOCIALES
        ['redes_instagram', 'https://instagram.com', 'texto', 'redes'],
        ['redes_facebook', 'https://facebook.com', 'texto', 'redes'],
        ['redes_tiktok', 'https://tiktok.com', 'texto', 'redes'],
        ['redes_whatsapp', 'https://wa.me/5493810000000', 'texto', 'redes'],

        // LOGO
        ['logo_imagen', '', 'imagen', 'apariencia'],
    ];

    const insertMany = db.transaction((rows) => {
        for (const row of rows) insert.run(...row);
    });
    insertMany(defaults);
}

module.exports = db;
