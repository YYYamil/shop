// utils/saasUtils.js
// ============================================
// UTILIDADES SAAS CENTRALIZADAS (BLOQUE 1)
// ============================================
//  - Fechas de negocio en formato YYYY-MM-DD, zona America/Argentina/Buenos_Aires
//    (UTC-3 fijo; Argentina no usa horario de verano desde 2009).
//  - Estado de una tienda derivado por calendario: DEMO / ACTIVE / SUSPENDED.
//    Regla comercial: el día final es INCLUSIVO ("válida hasta 07/10"), por lo
//    que la suspensión se produce el día posterior (fin < hoy).
//  - Generación y validación de slugs + lista de slugs reservados (rutas del
//    sistema y palabras reservadas del producto).

const db = require('../database/db');

const TZ = 'America/Argentina/Buenos_Aires';

const ESTADOS = {
    DEMO: 'demo',
    ACTIVO: 'activo',
    SUSPENDIDO: 'suspendido',
};

// Slugs reservados: rutas top-level del sistema y palabras del producto que
// nunca pueden ser usadas como identificador de tienda. Esta lista debe
// mantenerse al día con server.js y middleware/tiendaMiddleware.js.
const RESERVED_SLUGS = new Set([
    // Rutas técnicas del sistema (ver server.js y tiendaMiddleware)
    'api', 'auth', 'productos', 'pedidos', 'categorias', 'uploads',
    'css', 'js', 'admin', 'superadmin', 'carrito.html', 'saas',
    'robots.txt', 'sitemap.xml', 'home',
    // Páginas del producto / SaaS
    'registro', 'registrate', 'crear-tienda', 'planes', 'precios',
    'faq', 'login', 'logout', 'panel', 'cuenta', 'mi-cuenta',
    'soporte', 'contacto', 'terminos', 'terminos-y-condiciones',
    'privacidad', 'pricing', 'blog', 'landing', 'assets', 'images',
    'checkout', 'estado', 'webhook', 'config', 'configuracion', 'manifest.json',
    // Palabras genéricas que generan confusión / riesgo de phishing
    'tienda', 'tiendas', 'shop', 'shops', 'store', 'stores', 'admin.html',
]);

/* ============================================
   FECHAS DE NEGOCIO
   ============================================ */

// Fecha local de hoy en la zona del negocio (YYYY-MM-DD)
function hoyBuenosAires() {
    const partes = new Intl.DateTimeFormat('es-AR', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    let y = '0000'; let m = '00'; let d = '00';
    partes.forEach((part) => {
        if (part.type === 'year') y = part.value;
        if (part.type === 'month') m = part.value;
        if (part.type === 'day') d = part.value;
    });
    return y + '-' + m + '-' + d;
}

// Suma días calendario a una fecha YYYY-MM-DD (el conteo de días es de
// calendario, independiente de la zona horaria).
function sumarDias(fechaISO, dias) {
    const partes = String(fechaISO).split('-').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return fechaISO;
    const ms = Date.UTC(partes[0], partes[1] - 1, partes[2]) + (dias * 86400000);
    return new Date(ms).toISOString().slice(0, 10);
}

// Días calendario entre dos fechas YYYY-MM-DD (b - a). Puede ser negativo.
function diasEntre(aISO, bISO) {
    const a = String(aISO).split('-').map(Number);
    const b = String(bISO).split('-').map(Number);
    if (a.length !== 3 || b.length !== 3) return null;
    const msA = Date.UTC(a[0], a[1] - 1, a[2]);
    const msB = Date.UTC(b[0], b[1] - 1, b[2]);
    return Math.round((msB - msA) / 86400000);
}

function validarFecha(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return false;
    const [y, m, d] = String(fecha).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Primer día del mes siguiente a una fecha YYYY-MM-DD
function primerDiaMesSiguiente(fechaISO) {
    const [y, m] = String(fechaISO).split('-').map(Number);
    const mes = m === 12 ? 1 : m + 1;
    const anio = m === 12 ? y + 1 : y;
    return String(anio).padStart(4, '0') + '-' + String(mes).padStart(2, '0') + '-01';
}

// Suma meses de calendario a una fecha YYYY-MM-DD. Conserva el día siempre que
// exista en el mes destino; si el día no existe (31 en un mes de 30, 29 feb en
// año no bisiesto) se ajusta al último día del mes destino (clamping).
function sumarMeses(fechaISO, meses) {
    const partes = String(fechaISO).split('-').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return fechaISO;
    const [y, m, d] = partes;
    const total = (y * 12) + (m - 1) + meses;
    const anio = Math.floor(total / 12);
    const mes = (total % 12) + 1; // 1..12
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // día final del mes destino
    const dia = Math.min(d, ultimoDia);
    return String(anio).padStart(4, '0') + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

/* ============================================
   ESTADO DE LA TIENDA (derivado por calendario)
   ============================================ */

// Devuelve el estado comercial actual de una tienda a partir de su fila.
// La columna `activo` (legacy) es el interruptor manual: activo = 0 implica
// SUSPENDIDO por baja manual. El resto se calcula con las fechas:
//   plan = 'demo'       → estado DEMO mientras hoy <= trial_fin
//   plan = 'ilimitado'  → estado ACTIVO siempre (tiendas legacy / de por vida)
//   plan pago con fin    → SUSPENDIDO si hoy > suscripcion_fin
// Tiendas creadas antes del SaaS quedan con plan 'ilimitado' (migración), por
// lo que jamás se suspenden solas y no se les calcula DEMO retrospectivo.
function obtenerEstadoTienda(tienda) {
    if (!tienda) {
        return { estado: ESTADOS.SUSPENDIDO, plan: null, diasRestantes: null };
    }

    const hoy = hoyBuenosAires();
    const plan = String(tienda.plan || 'ilimitado');
    const activo = tienda.activo === 1 || tienda.activo === true || tienda.activo === null;

    if (!activo) {
        return {
            estado: ESTADOS.SUSPENDIDO,
            plan,
            diasRestantes: null,
        };
    }

    let estado = ESTADOS.ACTIVO;

    if (plan === 'demo') {
        if (!tienda.trial_fin || hoy > tienda.trial_fin) {
            estado = ESTADOS.SUSPENDIDO; // el día posterior al fin inclusive
        } else {
            estado = ESTADOS.DEMO;
        }
    } else if (plan !== 'ilimitado') {
        // Planes pagos con vencimiento de suscripción
        if (tienda.suscripcion_fin && hoy > tienda.suscripcion_fin) {
            estado = ESTADOS.SUSPENDIDO;
        }
    }

    const diasRestantes = estado === ESTADOS.DEMO || (plan !== 'ilimitado' && tienda.suscripcion_fin)
        ? diasEntre(hoy, estado === ESTADOS.DEMO ? tienda.trial_fin : tienda.suscripcion_fin)
        : null;

    return { estado, plan, diasRestantes };
}

// Texto legible para el panel (demo, activo, suspendido)
function etiquetaEstado(tienda) {
    const e = obtenerEstadoTienda(tienda);
    switch (e.estado) {
        case ESTADOS.DEMO:
            return 'Período de prueba';
        case ESTADOS.SUSPENDIDO:
            return 'Suspendida';
        default:
            return 'Activa';
    }
}

/* ============================================
   SLUGS
   ============================================ */

function normalizarParaSlug(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')          // quitar acentos
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')              // solo letras, números, espacios, guiones
        .trim()
        .replace(/[\s_]+/g, '-')                   // espacios/guiones bajos → guion
        .replace(/-+/g, '-')                       // sin guiones repetidos
        .replace(/^-+|-+$/g, '');                  // sin guiones en bordes
}

function esSlugValido(slug) {
    return /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/.test(String(slug || '')) && !esSlugReservado(slug);
}

function esSlugReservado(slug) {
    return RESERVED_SLUGS.has(String(slug || '').toLowerCase());
}

// Genera un slug único a partir del nombre: base, base-2, base-3...
// Nunca devuelve un slug reservado ni existente en la tabla tiendas.
function generarSlugUnico(nombre) {
    const base = normalizarParaSlug(nombre);
    let candidato = base || 'mi-tienda';

    // Si la base es reservada (p.ej. "tienda"), agregamos sufijo desde el inicio
    let n = 2;
    while (esSlugReservado(candidato) || existeSlug(candidato)) {
        candidato = base + '-' + n;
        n += 1;
    }
    return candidato;
}

function existeSlug(slug) {
    try {
        return !!db.prepare('SELECT id FROM tiendas WHERE slug = ?').get(slug);
    } catch (e) {
        return false;
    }
}

/* ============================================
   CONFIG GLOBAL SAAS (tienda_id = NULL)
   ============================================ */

// Lee una clave de configuración global del SaaS
function getGlobalConfig(clave) {
    try {
        const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ? AND tienda_id IS NULL').get(clave);
        return row ? row.valor : null;
    } catch (e) {
        return null;
    }
}

module.exports = {
    TZ,
    ESTADOS,
    RESERVED_SLUGS,
    hoyBuenosAires,
    sumarDias,
    sumarMeses,
    diasEntre,
    validarFecha,
    primerDiaMesSiguiente,
    obtenerEstadoTienda,
    etiquetaEstado,
    normalizarParaSlug,
    esSlugValido,
    esSlugReservado,
    generarSlugUnico,
    existeSlug,
    getGlobalConfig,
};
