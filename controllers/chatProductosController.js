const db = require('../database/db');

const CHAT_INTERNAL_TOKEN = process.env.CHAT_INTERNAL_TOKEN || '';

const STOPWORDS = new Set([
    'busco', 'buscar', 'busca', 'quiero', 'quisiera', 'necesito', 'me', 'por', 'favor', 'una', 'un',
    'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del', 'en', 'para', 'con', 'que', 'cual', 'producto',
    'productos', 'hay', 'tenes', 'tienen', 'tiene', 'cuanto', 'cuesta', 'precio', 'precios', 'estos',
    'estas', 'alguna', 'algun', 'cualquier', 'disponible', 'disponibles', 'venden',
]);

const MAX_RESULTADOS = 10;
const MAX_CATALOGO = 100;
const INCLUIR_CATEGORIA = true;

function normalizar(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function extraerTokens(consulta) {
    const tokens = [];
    String(consulta || '').split(/\s+/).forEach((t) => {
        const limpio = normalizar(t).replace(/[^a-z0-9]/g, '');
        if (limpio.length >= 2 && !STOPWORDS.has(limpio)) tokens.push(limpio);
    });
    return tokens;
}

function variantes(token) {
    const set = new Set([token]);
    if (token.length > 3 && token.endsWith('es')) {
        set.add(token.slice(0, -2));
        set.add(token.slice(0, -1));
    } else if (token.length > 2 && token.endsWith('s')) {
        set.add(token.slice(0, -1));
    }
    if (token.length > 2 && !token.endsWith('s')) {
        set.add(token + 's');
        if (token.endsWith('a') || token.endsWith('e') || token.endsWith('i') || token.endsWith('o') || token.endsWith('u')) {
            set.add(token + 'es');
        }
    }
    return set;
}

function coincide(texto, tokens) {
    return tokens.every((t) => {
        for (const v of variantes(t)) {
            if (texto.includes(v)) return true;
        }
        return false;
    });
}

function parseImagen(imagenes) {
    try {
        const arr = JSON.parse(imagenes || '[]');
        return Array.isArray(arr) && arr.length ? String(arr[0]) : null;
    } catch (e) {
        return null;
    }
}

function precioFinal(precio, descuento) {
    const p = Number(precio) || 0;
    const d = Number(descuento) || 0;
    return d > 0 ? Math.round(p * (1 - d / 100) * 100) / 100 : p;
}

exports.buscarProductos = (req, res) => {
    const token = String((req.get('x-chat-internal-token') || req.query.token || '')).trim();
    if (!CHAT_INTERNAL_TOKEN || token !== CHAT_INTERNAL_TOKEN) {
        return res.status(401).json({ ok: false, error: 'No autorizado' });
    }

    const storeId = Number(req.query.storeId ?? req.query.tiendaId ?? 0);
    if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ ok: false, error: 'storeId inválido' });
    }

    try {
        const tienda = db.prepare('SELECT id FROM tiendas WHERE id = ? AND activo = 1').get(storeId);
        if (!tienda) {
            return res.status(404).json({ ok: false, error: 'Tienda no encontrada o inactiva' });
        }
    } catch (err) {
        console.error('[CHAT-PRODUCTOS] Error validando tienda (storeId=' + storeId + '):', err.message);
        return res.status(500).json({ ok: false, error: 'Error interno' });
    }

    const tokens = extraerTokens(req.query.q);

    try {
        const filas = db.prepare(`
            SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.descuento, p.imagenes,
                   COALESCE(c.nombre_personalizado, c.nombre) AS categoria
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.tienda_id = ?
              AND (c.visible = 1 OR p.categoria_id IS NULL)
            ORDER BY p.id DESC
            LIMIT ${MAX_CATALOGO}
        `).all(storeId);

        let coincidencias = filas;
        if (tokens.length > 0) {
            // La categoria solo suma como campo de busqueda cuando la consulta
            // tiene 2+ palabras ("tote bags"). Con una sola palabra ("tote") manda
            // el nombre, para no devolver productos de categorias hermanas.
            const usarCategoria = INCLUIR_CATEGORIA && tokens.length >= 2;
            coincidencias = filas.filter((p) => {
                const base = normalizar(p.nombre) + ' ' + normalizar(p.descripcion);
                if (coincide(base, tokens)) return true;
                if (!usarCategoria) return false;
                const soloCategoria = normalizar(p.categoria);
                return coincide(soloCategoria, tokens);
            });
        }

        const productos = coincidencias.slice(0, MAX_RESULTADOS).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precio: Number(p.precio) || 0,
            precio_final: precioFinal(p.precio, p.descuento),
            descuento: Number(p.descuento) || 0,
            stock: Number(p.stock) || 0,
            categoria: p.categoria || null,
            imagen: parseImagen(p.imagenes),
        }));

        return res.json({ ok: true, productos });
    } catch (err) {
        console.error('[CHAT-PRODUCTOS] Error consultando productos (storeId=' + storeId + '):', err.message);
        return res.status(500).json({ ok: false, error: 'Error interno al consultar productos' });
    }
};