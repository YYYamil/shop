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
        ['color_primario', '#000000', 'color', 'oculto'],
        ['color_secundario', '#444444', 'color', 'oculto'],
        ['color_fondo', '#f4f4f4', 'color', 'oculto'],
        ['color_texto', '#111827', 'color', 'oculto'],
        ['color_boton', '#000000', 'color', 'apariencia'],
        ['color_boton_texto', '#ffffff', 'color', 'apariencia'],

        // HERO
        ['hero_titulo', 'Descubrí tu próximo estilo', 'texto', 'hero'],
        ['hero_descripcion', 'Productos modernos, elegantes y seleccionados para vos', 'texto', 'hero'],
        ['hero_fondo', '#ffffff', 'texto', 'hero'],
        ['hero_titulo_color', '#ffffff', 'color', 'hero'],
        ['hero_imagen', '', 'imagen', 'hero'],

        // MARQUEE
        ['marquee_textos', '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA|✨ NUEVOS INGRESOS TODAS LAS SEMANAS|🎁 PROMOCIONES EXCLUSIVAS|⭐ CALIDAD PREMIUM|⚡ ENTREGA RÁPIDA', 'texto', 'general'],

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
        ['redes_whatsapp', 'https://www.pagina.com/', 'texto', 'redes'],

        // LOGO
        ['logo_imagen', '', 'imagen', 'apariencia'],
    ];

    const insertMany = db.transaction((rows) => {
        for (const row of rows) insert.run(...row);
    });
    insertMany(defaults);
}

// ============================================
// MIGRACIÓN: Simplificar grupos de colores (botones)
// ============================================
try {
    db.prepare("UPDATE configuracion SET grupo = 'botones' WHERE clave IN ('color_boton', 'color_boton_texto') AND grupo != 'botones'").run();
} catch (e) {
    // ignorar
}
try {
    db.prepare("UPDATE configuracion SET grupo = 'oculto' WHERE clave IN ('color_primario', 'color_secundario', 'color_fondo', 'color_texto') AND grupo != 'oculto'").run();
} catch (e) {
    // ignorar
}

// ============================================
// MIGRACIÓN: Personalización de categorías (FASE 2)
// ============================================
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN visible INTEGER DEFAULT 1`);
} catch (e) {
    // La columna ya existe, ignorar error
}
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN nombre_personalizado TEXT DEFAULT NULL`);
} catch (e) {
    // La columna ya existe, ignorar error
}

// ============================================
// MIGRACIÓN: hero_titulo_color (simplificación colores)
// ============================================
try {
    const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ?').get('hero_titulo_color');
    if (!existente) {
        db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo) VALUES (?, ?, ?, ?)').run('hero_titulo_color', '#ffffff', 'color', 'hero');
    }
} catch (e) {
    // Ignorar error
}

// Actualizar hero_fondo a blanco si sigue siendo un gradiente
try {
    const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('hero_fondo');
    if (row && row.valor && row.valor.startsWith('linear-gradient')) {
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run('#ffffff', 'hero_fondo');
    }
} catch (e) {
    // Ignorar error
}

// ============================================
// MIGRACIÓN: marquee_textos (personalización del marquee)
// ============================================
try {
    const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ?').get('marquee_textos');
    if (!existente) {
        db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo) VALUES (?, ?, ?, ?)').run('marquee_textos', '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA|✨ NUEVOS INGRESOS TODAS LAS SEMANAS|🎁 PROMOCIONES EXCLUSIVAS|⭐ CALIDAD PREMIUM|⚡ ENTREGA RÁPIDA', 'texto', 'general');
    }
} catch (e) {
    // Ignorar error
}


module.exports = db;
