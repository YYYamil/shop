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

// NOTA: Ya no se crea tienda por defecto.
// El SuperAdmin debe crearlas desde el panel /superadmin/

// ============================================
// TABLA DE USUARIOS
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password TEXT,
        tienda_id INTEGER DEFAULT NULL,
        es_superadmin INTEGER DEFAULT 0,
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// ============================================
// TABLA DE CATEGORÍAS
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        tienda_id INTEGER DEFAULT NULL,
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a categorias si la tabla ya existía
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }
// Migración: agregar visible y nombre_personalizado si no existen
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN visible INTEGER DEFAULT 1`);
} catch (e) { /* ya existe */ }
try {
    db.exec(`ALTER TABLE categorias ADD COLUMN nombre_personalizado TEXT DEFAULT NULL`);
} catch (e) { /* ya existe */ }

// ============================================
// TABLA DE PRODUCTOS
// ============================================
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
        tienda_id INTEGER DEFAULT NULL,
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a productos si la tabla ya existía
try {
    db.exec(`ALTER TABLE productos ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }
// Migración: agregar columnas nuevo y descuento si no existen
try {
    db.exec(`ALTER TABLE productos ADD COLUMN nuevo INTEGER DEFAULT 0`);
} catch(e) { /* ya existe */ }
try {
    db.exec(`ALTER TABLE productos ADD COLUMN descuento INTEGER DEFAULT 0`);
} catch(e) { /* ya existe */ }

// ============================================
// TABLA DE PEDIDOS
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT,
        telefono TEXT,
        total REAL,
        estado TEXT,
        fecha TEXT,
        tienda_id INTEGER DEFAULT NULL,
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a pedidos si la tabla ya existía
try {
    db.exec(`ALTER TABLE pedidos ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

// ============================================
// TABLA DE PEDIDO ITEMS
// ============================================
db.exec(`
    CREATE TABLE IF NOT EXISTS pedido_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER,
        producto_id INTEGER,
        nombre TEXT,
        cantidad INTEGER,
        precio REAL,
        tienda_id INTEGER DEFAULT NULL,
        FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
    )
`);

// Migración: agregar tienda_id a pedido_items si la tabla ya existía
try {
    db.exec(`ALTER TABLE pedido_items ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

// ============================================
// TABLA DE CONFIGURACIÓN (FASE 1 - Personalización)
// ============================================
// Migración: si la tabla existe con PK solo en (clave), la recreamos con PK compuesta (clave, tienda_id)
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='configuracion'").get();
const needsMigration = tableInfo && tableInfo.sql && !tableInfo.sql.includes('PRIMARY KEY (clave, tienda_id)');
if (needsMigration) {
    console.log('[DB] Migrando tabla configuracion a PK compuesta (clave, tienda_id)...');
    // Eliminar tabla temporal si quedó de una migración anterior fallida
    db.exec(`DROP TABLE IF EXISTS configuracion_nueva`);
    db.exec(`
        CREATE TABLE configuracion_nueva (
            clave TEXT,
            valor TEXT NOT NULL,
            tipo TEXT DEFAULT 'texto',
            grupo TEXT DEFAULT 'general',
            tienda_id INTEGER DEFAULT NULL,
            PRIMARY KEY (clave, tienda_id),
            FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
        )
    `);
    // NOTA: La tabla original NO tiene columna tienda_id (se agrega después),
    // por lo tanto en la migración asignamos NULL directamente.
    db.exec(`
        INSERT INTO configuracion_nueva (clave, valor, tipo, grupo, tienda_id)
        SELECT clave, valor, COALESCE(tipo, 'texto'), COALESCE(grupo, 'general'), NULL
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
            tienda_id INTEGER DEFAULT NULL,
            PRIMARY KEY (clave, tienda_id),
            FOREIGN KEY (tienda_id) REFERENCES tiendas(id)
        )
    `);
}

// Migración: agregar tienda_id a configuracion si la tabla ya existía sin ella
try {
    db.exec(`ALTER TABLE configuracion ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

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
    const tiendas = db.prepare('SELECT id FROM tiendas').all();
    if (tiendas.length === 0) {
        const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id IS NULL').get('hero_titulo_color');
        if (!existente) {
            db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run('hero_titulo_color', '#ffffff', 'color', 'hero', null);
        }
    } else {
        tiendas.forEach(t => {
            const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id = ?').get('hero_titulo_color', t.id);
            if (!existente) {
                db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run('hero_titulo_color', '#ffffff', 'color', 'hero', t.id);
            }
        });
    }
} catch (e) {
    // Ignorar error
}

// Actualizar hero_fondo a blanco si sigue siendo un gradiente
try {
    const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ? AND tienda_id IS NULL').get('hero_fondo');
    if (row && row.valor && row.valor.startsWith('linear-gradient')) {
        db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ? AND tienda_id IS NULL').run('#ffffff', 'hero_fondo');
    }
} catch (e) {
    // Ignorar error
}

// ============================================
// MIGRACIÓN: marquee_textos (personalización del marquee)
// ============================================
try {
    const tiendas = db.prepare('SELECT id FROM tiendas').all();
    if (tiendas.length === 0) {
        const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id IS NULL').get('marquee_textos');
        if (!existente) {
            db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run('marquee_textos', '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA|✨ NUEVOS INGRESOS TODAS LAS SEMANAS|🎁 PROMOCIONES EXCLUSIVAS|⭐ CALIDAD PREMIUM|⚡ ENTREGA RÁPIDA', 'texto', 'general', null);
        }
    } else {
        tiendas.forEach(t => {
            const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id = ?').get('marquee_textos', t.id);
            if (!existente) {
                db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run('marquee_textos', '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA|✨ NUEVOS INGRESOS TODAS LAS SEMANAS|🎁 PROMOCIONES EXCLUSIVAS|⭐ CALIDAD PREMIUM|⚡ ENTREGA RÁPIDA', 'texto', 'general', t.id);
            }
        });
    }
} catch (e) {
    // Ignorar error
}

// ============================================
// MIGRACIÓN: font_family (tipografía personalizable)
// ============================================
// Insertar font_family para cada tienda que no lo tenga
try {
    const tiendas = db.prepare('SELECT id FROM tiendas').all();
    if (tiendas.length === 0) {
        // Sin tiendas aún: insertar con tienda_id = NULL (config global)
        const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id IS NULL').get('font_family');
        if (!existente) {
            db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run('font_family', 'Arial', 'texto', 'tipografia', null);
        }
    } else {
        tiendas.forEach(t => {
            const existente = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id = ?').get('font_family', t.id);
            if (!existente) {
                db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)').run('font_family', 'Arial', 'texto', 'tipografia', t.id);
            }
        });
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
    db.prepare(`UPDATE usuarios SET tienda_id = NULL WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar categorías existentes sin tienda_id
try {
    db.prepare(`UPDATE categorias SET tienda_id = NULL WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar productos existentes sin tienda_id
try {
    db.prepare(`UPDATE productos SET tienda_id = NULL WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar pedidos existentes sin tienda_id
try {
    db.prepare(`UPDATE pedidos SET tienda_id = NULL WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar pedido_items existentes sin tienda_id
try {
    db.prepare(`UPDATE pedido_items SET tienda_id = NULL WHERE tienda_id IS NULL`).run();
} catch(e) { /* ignorar */ }

// Migrar configuracion existente sin tienda_id
try {
    db.prepare(`UPDATE configuracion SET tienda_id = NULL WHERE tienda_id IS NULL`).run();
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
    db.exec(`ALTER TABLE usuarios ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
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
    db.exec(`ALTER TABLE categorias ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

// Agregar columna tienda_id a productos si no existe
try {
    db.exec(`ALTER TABLE productos ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

// Agregar columna tienda_id a pedidos si no existe
try {
    db.exec(`ALTER TABLE pedidos ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

// Agregar columna tienda_id a pedido_items si no existe
try {
    db.exec(`ALTER TABLE pedido_items ADD COLUMN tienda_id INTEGER DEFAULT NULL`);
} catch(e) { /* ya existe */ }

module.exports = db;
