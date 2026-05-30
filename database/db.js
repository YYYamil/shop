const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

// Habilitar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');

// ============================================
// TABLA DE TIENDAS (MULTI-TENANT)
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS tiendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        activo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
`);

// Crear tienda por defecto si no existe ninguna
const tiendaCount = db.prepare('SELECT COUNT(*) as total FROM tiendas').get();
if (tiendaCount.total === 0) {
    db.prepare(`INSERT INTO tiendas (slug, nombre) VALUES ('tienda1', 'Tienda Principal')`).run();
    console.log('[DB] Tienda por defecto creada: tienda1');
}

// Obtener ID de la tienda por defecto (siempre existe)
const tiendaDefault = db.prepare('SELECT id FROM tiendas WHERE slug = ?').get('tienda1');
const TIENDA_DEFAULT_ID = tiendaDefault ? tiendaDefault.id : 1;

// Crear tablas si no existen
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password TEXT,
        tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
        es_superadmin INTEGER DEFAULT 0,
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a categorias si la tabla ya existía
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }
// Migración: agregar visible y nombre_personalizado si no existen
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN visible INTEGER DEFAULT 1`);
} catch (e) { /* ya existe */ }
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN nombre_personalizado TEXT DEFAULT NULL`);
} catch (e) { /* ya existe */ }

db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        precio REAL,
        descripcion TEXT,
        imagenes TEXT DEFAULT '[]',
        stock INTEGER,
        categoria_id INTEGER,
        nuevo INTEGER DEFAULT 0,
        descuento INTEGER DEFAULT 0,
        tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a productos si la tabla ya existía
try {
    db.exec(`ALTER TABLE productos ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }
// Migración: agregar columnas nuevo y descuento si no existen
try {
    db.exec(`ALTER TABLE productos ADD COLUMN nuevo INTEGER DEFAULT 0`);
} catch(e) { /* ya existe */ }
try {
    db.exec(`ALTER TABLE productos ADD COLUMN descuento INTEGER DEFAULT 0`);
} catch(e) { /* ya existe */ }

db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT,
        telefono TEXT,
        total REAL,
        estado TEXT,
        fecha TEXT,
        tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a pedidos si la tabla ya existía
try {
    db.exec(`ALTER TABLE pedidos ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

db.exec(`
    CREATE TABLE IF NOT EXISTS pedido_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER,
        producto_id INTEGER,
        nombre TEXT,
        cantidad INTEGER,
        precio REAL,
        tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a pedido_items si la tabla ya existía
try {
    db.exec(`ALTER TABLE pedido_items ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

// Insertar categorías por defecto si no existen (para tienda por defecto)
const catCount = db.prepare('SELECT COUNT(*) as total FROM categorias WHERE tienda_id = ?').get(TIENDA_DEFAULT_ID);
if (catCount.total === 0) {
    const catInsert = db.prepare('INSERT INTO categorias(nombre, tienda_id) VALUES (?, ?)');
    catInsert.run('Ropa', TIENDA_DEFAULT_ID);
    catInsert.run('Calzado', TIENDA_DEFAULT_ID);
    catInsert.run('Accesorios', TIENDA_DEFAULT_ID);
}

// ============================================
// TABLA DE CONFIGURACIÓN (FASE 1 - Personalización)
// ============================================
// Migración: si la tabla existe con PK solo en (clave), la recreamos con PK compuesta (clave, tienda_id)
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='configuracion'").get();
const needsMigration = tableInfo && tableInfo.sql && !tableInfo.sql.includes('PRIMARY KEY (clave, tienda_id)');
if (needsMigration) {
    console.log('[DB] Migrando tabla configuracion a PK compuesta (clave, tienda_id)...');
    db.exec(`
        CREATE TABLE configuracion_nueva (
            clave TEXT,
            valor TEXT NOT NULL,
            tipo TEXT DEFAULT 'texto',
            grupo TEXT DEFAULT 'general',
            tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
            PRIMARY KEY (clave, tienda_id),
            FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
        )
    `);
    db.exec(`
        INSERT INTO configuracion_nueva (clave, valor, tipo, grupo, tienda_id)
        SELECT clave, valor, COALESCE(tipo, 'texto'), COALESCE(grupo, 'general'), COALESCE(tienda_id, ${TIENDA_DEFAULT_ID})
        FROM configuracion
    `);
    db.exec(`DROP TABLE configuracion`);
    db.exec(`ALTER TABLE configuracion_nueva RENAME TO configuracion`);
    console.log('[DB] Migración de configuracion completada.');
} else {
    db.exec(`
        CREATE TABLE IF NOT EXISTS configuracion (
            clave TEXT,
            valor TEXT NOT NULL,
            tipo TEXT DEFAULT 'texto',
            grupo TEXT DEFAULT 'general',
            tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID},
            PRIMARY KEY (clave, tienda_id),
            FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
        )
    `);
}

// Migración: agregar tienda_id a configuracion si la tabla ya existía sin ella
try {
    db.exec(`ALTER TABLE configuracion ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

// Verificar si hay config para la tienda por defecto
const configCount = db.prepare('SELECT COUNT(*) as total FROM configuracion WHERE tienda_id = ?').get(TIENDA_DEFAULT_ID);
if (configCount.total === 0) {
    const insert = db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)');

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
        for (const row of rows) insert.run(...row, TIENDA_DEFAULT_ID);
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


// ============================================
// MIGRACIÓN MULTI-TENANT: Asignar tienda_id a datos existentes
// ============================================
// Estas migraciones solo se ejecutan si las columnas se agregaron a tablas existentes
// y los registros tienen tienda_id NULL (porque la columna se agregó después)

// Migrar usuarios existentes sin tienda_id
try {
    db.prepare(`UPDATE usuarios SET tienda_id = ${TIENDA_DEFAULT_ID} WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar categorías existentes sin tienda_id
try {
    db.prepare(`UPDATE categorias SET tienda_id = ${TIENDA_DEFAULT_ID} WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar productos existentes sin tienda_id
try {
    db.prepare(`UPDATE productos SET tienda_id = ${TIENDA_DEFAULT_ID} WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar pedidos existentes sin tienda_id
try {
    db.prepare(`UPDATE pedidos SET tienda_id = ${TIENDA_DEFAULT_ID} WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar pedido_items existentes sin tienda_id
try {
    db.prepare(`UPDATE pedido_items SET tienda_id = ${TIENDA_DEFAULT_ID} WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar configuracion existente sin tienda_id
try {
    db.prepare(`UPDATE configuracion SET tienda_id = ${TIENDA_DEFAULT_ID} WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar es_superadmin: el primer usuario (admin) se convierte en superadmin
try {
    db.prepare(`UPDATE usuarios SET es_superadmin = 1 WHERE usuario = 'admin'`).run();
} catch(e) { /* ignorar */ }

// Migrar contraseña del superadmin a Super1234 (si sigue siendo la anterior)
try {
    const bcrypt = require('bcrypt');
    const superHash = bcrypt.hashSync('Super1234', 10);
    db.prepare(`UPDATE usuarios SET password = ? WHERE usuario = 'admin'`).run(superHash);
} catch(e) { /* ignorar */ }

// Agregar columna tienda_id a usuarios si no existe (para tablas creadas antes de multi-tenant)
try {
    db.exec(`ALTER TABLE usuarios ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

// Agregar columna es_superadmin a usuarios si no existe
try {
    db.exec(`ALTER TABLE usuarios ADD COLUMN es_superadmin INTEGER DEFAULT 0`);
} catch(e) { /* ya existe */ }

// Agregar columna password_plain a usuarios para que el superadmin pueda ver las contraseñas
try {
    db.exec(`ALTER TABLE usuarios ADD COLUMN password_plain TEXT DEFAULT NULL`);
} catch(e) { /* ya existe */ }

// Establecer password_plain para el superadmin existente si está NULL
try {
    db.prepare(`UPDATE usuarios SET password_plain = 'Super1234' WHERE usuario = 'admin' AND password_plain IS NULL`).run();
} catch(e) { /* ignorar */ }

// Agregar columna tienda_id a categorias si no existe
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

// Agregar columna tienda_id a productos si no existe
try {
    db.exec(`ALTER TABLE productos ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

// Agregar columna tienda_id a pedidos si no existe
try {
    db.exec(`ALTER TABLE pedidos ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

// Agregar columna tienda_id a pedido_items si no existe
try {
    db.exec(`ALTER TABLE pedido_items ADD COLUMN tienda_id INTEGER DEFAULT ${TIENDA_DEFAULT_ID}`);
} catch(e) { /* ya existe */ }

module.exports = db;
