// utils/defaultConfig.js
// ============================================
// CONFIGURACIÓN POR DEFECTO DE UNA TIENDA NUEVA
// ============================================
// Centraliza los valores que hoy usa superAdminController.crearTienda para que
// el alta automática del SaaS (BLOQUE 2) genere exactamente la misma tienda.
// Cada fila: [clave, valor, tipo, grupo]

const db = require('../database/db');

const DEFAULT_CONFIG_ROWS = [
    ['tienda_nombre', 'Mi Tienda', 'texto', 'general'],
    ['tienda_descripcion', 'Descripción de mi tienda - Aquí podés contar qué ofrecés', 'texto', 'general'],
    ['rubro_actividad', '', 'texto', 'seo'],
    ['ciudad', '', 'texto', 'seo'],
    ['seo_title', '', 'texto', 'seo'],
    ['seo_description', '', 'texto', 'seo'],
    ['color_primario', '#000000', 'color', 'oculto'],
    ['color_secundario', '#444444', 'color', 'oculto'],
    ['color_fondo', '#f4f4f4', 'color', 'oculto'],
    ['color_texto', '#111827', 'color', 'oculto'],
    ['color_boton', '#000000', 'color', 'apariencia'],
    ['color_boton_texto', '#ffffff', 'color', 'apariencia'],
    ['hero_titulo', 'Título de portada', 'texto', 'hero'],
    ['hero_descripcion', 'Descripción de portada - Contá lo que quieras destacar', 'texto', 'hero'],
    ['hero_fondo', '#ffffff', 'texto', 'hero'],
    ['hero_titulo_color', '#ffffff', 'color', 'hero'],
    ['hero_imagen', '', 'imagen', 'hero'],
    ['marquee_textos', '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA|✨ NUEVOS INGRESOS TODAS LAS SEMANAS|🎁 PROMOCIONES EXCLUSIVAS|⭐ CALIDAD PREMIUM|⚡ ENTREGA RÁPIDA', 'texto', 'general'],
    ['whatsapp_numero', '', 'texto', 'whatsapp'],
    ['whatsapp_mensaje', 'Hola! Quiero consultar por un producto', 'texto', 'whatsapp'],
    ['whatsapp_activo', 'true', 'booleano', 'whatsapp'],
    ['contacto_email', '', 'texto', 'contacto'],
    ['contacto_telefono', '', 'texto', 'contacto'],
    ['contacto_direccion', '', 'texto', 'contacto'],
    ['redes_instagram', 'https://instagram.com/', 'texto', 'redes'],
    ['redes_facebook', 'https://facebook.com/', 'texto', 'redes'],
    ['redes_tiktok', 'https://tiktok.com/', 'texto', 'redes'],
    ['redes_whatsapp', 'https://www.pagina.com/', 'texto', 'redes'],
    ['logo_imagen', '', 'imagen', 'apariencia'],
];

const DEFAULT_CATEGORIES = ['Ropa', 'Calzado', 'Accesorios'];

// Inserta TODA la configuración por defecto para una tienda.
// `overrides` permite reemplazar valores puntuales por fila (ej: tienda_nombre
// con el nombre real ingresado por el dueño en el alta automática).
// Pensada para ejecutarse dentro de una transacción (db.transaction).
function insertarConfigPorDefecto(tiendaId, overrides = {}) {
    const insertConfig = db.prepare(
        'INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)'
    );
    for (const [clave, valor, tipo, grupo] of DEFAULT_CONFIG_ROWS) {
        const valorFinal = Object.prototype.hasOwnProperty.call(overrides, clave)
            ? overrides[clave]
            : valor;
        insertConfig.run(clave, valorFinal, tipo, grupo, tiendaId);
    }
}

// Inserta las categorías por defecto de una tienda.
function insertarCategoriasPorDefecto(tiendaId) {
    const insertCategoria = db.prepare(
        'INSERT INTO categorias (nombre, tienda_id) VALUES (?, ?)'
    );
    for (const nombre of DEFAULT_CATEGORIES) {
        insertCategoria.run(nombre, tiendaId);
    }
}

// Config global por defecto del SaaS. Solo se usa al sembrar la primera vez
// (insert OR IGNORE). tienda_id = NULL identifica claves globales.
const SAAS_GLOBAL_DEFAULTS = [
    ['saas.trial_days', '30', 'texto', 'saas'],
    ['saas.monto_mensual_ars', '5000', 'texto', 'saas'],
    ['saas.warning_days', '3', 'texto', 'saas'],
    ['saas.plan_name', 'Profesional', 'texto', 'saas'],
];

function sembrarConfigGlobalSaas() {
    const insert = db.prepare(
        'INSERT OR IGNORE INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, NULL)'
    );
    for (const [clave, valor, tipo, grupo] of SAAS_GLOBAL_DEFAULTS) {
        insert.run(clave, valor, tipo, grupo);
    }
}

module.exports = {
    DEFAULT_CONFIG_ROWS,
    DEFAULT_CATEGORIES,
    insertarConfigPorDefecto,
    insertarCategoriasPorDefecto,
    sembrarConfigGlobalSaas,
};
