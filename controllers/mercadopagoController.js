const crypto = require('crypto');
const db = require('../database/db');
const saasUtils = require('../utils/saasUtils');
const { registrarEvento } = require('./superAdminController');

const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';
const MP_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences';
const MP_USERS_ME_URL = 'https://api.mercadopago.com/users/me';

function getAppId() {
    return process.env.MP_CLIENT_ID || process.env.MP_APP_ID || '';
}

function getClientSecret() {
    return process.env.MP_CLIENT_SECRET || '';
}

function getRedirectUri(req) {
    if (process.env.MP_REDIRECT_URI) {
        return process.env.MP_REDIRECT_URI;
    }

    if (process.env.PUBLIC_BASE_URL) {
        return new URL('/auth/mercadopago/callback', process.env.PUBLIC_BASE_URL).toString();
    }

    const host = req.get('host') || 'localhost:3001';
    return `${req.protocol}://${host}/auth/mercadopago/callback`;
}

function getStateSecret() {
    return process.env.MP_STATE_SECRET || process.env.SESSION_SECRET || 'mp-state-secret';
}

function encodeState(payload) {
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', getStateSecret()).update(raw).digest('base64url');
    return `${raw}.${sig}`;
}

function decodeState(state) {
    if (!state || typeof state !== 'string') {
        return null;
    }

    const parts = state.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const [raw, sig] = parts;
    const expected = crypto.createHmac('sha256', getStateSecret()).update(raw).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }

    try {
        return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    } catch (err) {
        return null;
    }
}

function upsertConfig(tiendaId, clave, valor, tipo = 'texto', grupo = 'pagos') {
    const existe = db.prepare('SELECT clave FROM configuracion WHERE clave = ? AND tienda_id = ?').get(clave, tiendaId);
    if (existe) {
        db.prepare('UPDATE configuracion SET valor = ?, tipo = ?, grupo = ? WHERE clave = ? AND tienda_id = ?')
            .run(String(valor), tipo, grupo, clave, tiendaId);
        return;
    }

    db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)')
        .run(clave, String(valor), tipo, grupo, tiendaId);
}

function getTiendaConfigMap(tiendaId) {
    const rows = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id = ?').all(tiendaId);
    const config = {};
    rows.forEach(row => {
        config[row.clave] = row.valor;
    });
    return config;
}

function getMercadoPagoCredentials(tiendaId) {
    const config = getTiendaConfigMap(tiendaId);
    return {
        accessToken: config.mp_access_token || '',
        publicKey: config.mp_public_key || '',
        refreshToken: config.mp_refresh_token || '',
        userId: config.mp_user_id || '',
        tokenExpiresAt: config.mp_token_expires_at ? Number(config.mp_token_expires_at) : 0,
    };
}

/**
 * Consulta los datos públicos de la cuenta de Mercado Pago del dueño
 * usando el access_token de la tienda (GET /users/me). Devuelve null si
 * el token no es válido o la API responde con error.
 */
async function fetchMercadoPagoAccount(accessToken) {
    if (!accessToken) return null;

    try {
        const response = await fetch(MP_USERS_ME_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            id: data.id != null ? String(data.id) : null,
            nickname: data.nickname || '',
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            email: data.email || '',
            userType: data.user_type || '',
        };
    } catch (err) {
        console.error('[MP] Error al consultar /users/me:', err.message);
        return null;
    }
}

/**
 * Verifica si el token de MP está expirado o próximo a vencer.
 * Retorna: 'expirado' | 'proximo_a_vencer' | 'valido'
 */
function getTokenStatus(tiendaId) {
    const creds = getMercadoPagoCredentials(tiendaId);
    if (!creds.accessToken) {
        return 'no_conectado';
    }
    if (!creds.tokenExpiresAt) {
        // Token sin fecha de expiración guardada (migración)
        return 'sin_fecha';
    }
    const ahora = Date.now();
    const sieteDias = 7 * 24 * 60 * 60 * 1000;
    if (ahora >= creds.tokenExpiresAt) {
        return 'expirado';
    }
    if (creds.tokenExpiresAt - ahora <= sieteDias) {
        return 'proximo_a_vencer';
    }
    return 'valido';
}

/**
 * Refresca el access_token de Mercado Pago usando el refresh_token.
 * Retorna true si se refrescó correctamente, false si no.
 */
async function refreshMercadoPagoToken(tiendaId) {
    const creds = getMercadoPagoCredentials(tiendaId);
    if (!creds.refreshToken) {
        console.warn('[MP] No hay refresh_token para la tienda', tiendaId);
        return false;
    }

    try {
        const body = new URLSearchParams();
        body.set('grant_type', 'refresh_token');
        body.set('client_id', getAppId());
        body.set('client_secret', getClientSecret());
        body.set('refresh_token', creds.refreshToken);

        const response = await fetch(MP_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[MP] Error al refrescar token:', data);
            return false;
        }

        // Guardar nuevos tokens
        upsertConfig(tiendaId, 'mp_access_token', data.access_token || '', 'texto', 'pagos');
        upsertConfig(tiendaId, 'mp_public_key', data.public_key || '', 'texto', 'pagos');
        if (data.refresh_token) {
            upsertConfig(tiendaId, 'mp_refresh_token', data.refresh_token, 'texto', 'pagos');
        }

        // Calcular nueva fecha de expiración (180 días desde ahora)
        const expiresAt = Date.now() + 180 * 24 * 60 * 60 * 1000;
        upsertConfig(tiendaId, 'mp_token_expires_at', String(expiresAt), 'numero', 'pagos');

        console.log('[MP] Token refrescado exitosamente para tienda', tiendaId);
        return true;
    } catch (err) {
        console.error('[MP] Error en refreshMercadoPagoToken:', err.message);
        return false;
    }
}

function getTiendaBySlug(slug) {
    if (!slug) return null;
    return db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(slug);
}

function getTiendaFromRequest(req) {
    if (req.tiendaId) {
        return db.prepare('SELECT id, slug, nombre FROM tiendas WHERE id = ? AND activo = 1').get(req.tiendaId);
    }

    const slug = req.query.slug || req.body?.slug;
    return getTiendaBySlug(slug);
}

/**
 * Endpoint público para que el frontend consulte si un pedido fue pagado.
 * Sirve como respaldo cuando el usuario vuelve de la app de Mercado Pago en mobile
 * y los datos en localStorage se perdieron.
 */
exports.getPedidoStatus = (req, res) => {
    try {
        const tienda = getTiendaFromRequest(req);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const pedidoId = req.params.id;
        if (!pedidoId) {
            return res.status(400).json({ error: 'Falta el ID del pedido' });
        }

        const pedido = db.prepare(
            'SELECT id, cliente, telefono, total, estado, mp_payment_status FROM pedidos WHERE id = ? AND tienda_id = ?'
        ).get(pedidoId, tienda.id);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const pagado = pedido.estado === 'Pagado' || pedido.mp_payment_status === 'approved';

        let items = [];
        if (pagado) {
            try {
                items = db.prepare(
                    'SELECT producto_id, nombre, cantidad, precio FROM pedido_items WHERE pedido_id = ? AND tienda_id = ?'
                ).all(pedidoId, tienda.id);
            } catch (e) {
                items = [];
            }
        }

        res.json({
            ok: true,
            pagado,
            pedido: pagado ? {
                id: pedido.id,
                cliente: pedido.cliente,
                telefono: pedido.telefono,
                total: pedido.total,
                metodo_entrega: pedido.metodo_entrega || 'retiro_local',
                items: items,
            } : null,
        });
    } catch (err) {
        console.error('Error al consultar estado del pedido:', err.message);
        res.status(500).json({ error: 'Error al consultar estado del pedido' });
    }
};

exports.getStatus = (req, res) => {
    try {
        const tienda = getTiendaFromRequest(req);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const creds = getMercadoPagoCredentials(tienda.id);
        const tieneToken = Boolean(creds.accessToken && creds.publicKey);
        const tokenStatus = getTokenStatus(tienda.id);

        let conectado = false;
        let estadoTexto = 'no_conectado';

        if (tieneToken) {
            if (tokenStatus === 'expirado') {
                estadoTexto = 'expirado';
            } else if (tokenStatus === 'proximo_a_vencer') {
                estadoTexto = 'proximo_a_vencer';
            } else {
                conectado = true;
                estadoTexto = 'conectado';
            }
        }

        res.json({
            ok: true,
            conectado,
            estadoTexto,
            tienda_id: tienda.id,
            slug: tienda.slug,
        });
    } catch (err) {
        console.error('Error al obtener estado de Mercado Pago:', err.message);
        res.status(500).json({ error: 'Error al obtener estado de Mercado Pago' });
    }
};

// GET /api/mercadopago/account - requiere sesión de admin de la tienda.
// Devuelve los datos de la cuenta de Mercado Pago conectada para que el
// dueño de la tienda verifique que es SU cuenta la que cobra los pedidos.
exports.getAccountInfo = async (req, res) => {
    try {
        const tienda = getTiendaFromRequest(req);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        let creds = getMercadoPagoCredentials(tienda.id);
        if (!creds.accessToken) {
            return res.json({ ok: true, conectado: false });
        }

        let account = await fetchMercadoPagoAccount(creds.accessToken);

        const tokenStatus = getTokenStatus(tienda.id);
        if (!account && tokenStatus === 'expirado') {
            const refrescado = await refreshMercadoPagoToken(tienda.id);
            if (refrescado) {
                creds = getMercadoPagoCredentials(tienda.id);
                account = await fetchMercadoPagoAccount(creds.accessToken);
            }
        } else if (tokenStatus === 'proximo_a_vencer') {
            refreshMercadoPagoToken(tienda.id).catch(() => {});
        }

        res.json({
            ok: true,
            conectado: Boolean(creds.accessToken),
            userId: creds.userId || (account ? account.id : null) || null,
            account,
        });
    } catch (err) {
        console.error('Error al obtener datos de la cuenta de Mercado Pago:', err.message);
        res.status(500).json({ error: 'Error al obtener datos de la cuenta de Mercado Pago' });
    }
};

exports.connect = (req, res) => {
    try {
        const tienda = getTiendaFromRequest(req);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const clientId = getAppId();
        let redirectUri;
        try {
            redirectUri = getRedirectUri(req);
        } catch (redirectErr) {
            return res.status(400).json({ error: redirectErr.message });
        }

        if (!clientId || !getClientSecret()) {
            return res.status(500).json({ error: 'Faltan credenciales de Mercado Pago en .env' });
        }

        const state = encodeState({
            tienda_id: tienda.id,
            slug: tienda.slug,
            ts: Date.now(),
            nonce: crypto.randomBytes(8).toString('hex'),
        });

        const authUrl = new URL(MP_AUTH_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('platform_id', 'mp');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);

        res.redirect(authUrl.toString());
    } catch (err) {
        console.error('Error al iniciar conexion con Mercado Pago:', err.message);
        res.status(500).json({ error: 'Error al iniciar conexion con Mercado Pago' });
    }
};

exports.callback = async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.status(400).send('Faltan parametros de autorizacion');
    }

    const payload = decodeState(String(state));
    if (!payload) {
        return res.status(400).send('Estado OAuth invalido');
    }

    // BLOQUE 5: la cuenta GLOBAL del SuperAdmin (pago de la mensualidad SaaS)
    // se distingue por el flag saas_mp en el estado OAuth. No pertenece a una
    // tienda: se guarda en config global (tienda_id NULL, claves saas.mp_*).
    const esPlataformaSaaS = payload.saas_mp === 1;
    let tienda = null;

    if (esPlataformaSaaS) {
        if (!payload.origen) {
            return res.status(400).send('Estado OAuth invalido');
        }
        tienda = { id: null, slug: null, nombre: null };
    } else {
        if (!payload.tienda_id) {
            return res.status(400).send('Estado OAuth invalido');
        }
        tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE id = ? AND activo = 1').get(payload.tienda_id);
        if (!tienda || tienda.slug !== payload.slug) {
            return res.status(400).send('No se pudo validar la tienda');
        }
    }

    const redirectUri = getRedirectUri(req);
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', getAppId());
    body.set('client_secret', getClientSecret());
    body.set('code', String(code));
    body.set('redirect_uri', redirectUri);

    try {
        const response = await fetch(MP_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Mercado Pago OAuth error:', data);
            return res.status(400).send('No se pudo completar la conexion con Mercado Pago');
        }

        if (esPlataformaSaaS) {
            savePlataformaCredentials(data);
            registrarEvento(null, 'mp_plataforma_conectada', 'Cuenta Mercado Pago del SuperAdmin conectada para cobrar la mensualidad del SaaS');
            console.log('[MP-SaaS] Cuenta de cobro de la plataforma conectada (user_id ' + (data.user_id || '?') + ')');
            return res.redirect('/superadmin/index.html?mp_connect=1');
        }

        upsertConfig(tienda.id, 'mp_access_token', data.access_token || '', 'texto', 'pagos');
        upsertConfig(tienda.id, 'mp_public_key', data.public_key || '', 'texto', 'pagos');
        upsertConfig(tienda.id, 'mp_refresh_token', data.refresh_token || '', 'texto', 'pagos');
        if (data.user_id) {
            upsertConfig(tienda.id, 'mp_user_id', String(data.user_id), 'numero', 'pagos');
        }
        // Guardar fecha de expiración del token (180 días desde ahora)
        const expiresAt = Date.now() + 180 * 24 * 60 * 60 * 1000;
        upsertConfig(tienda.id, 'mp_token_expires_at', String(expiresAt), 'numero', 'pagos');

        const backUrl = `/${tienda.slug}/admin/mercadopago.html?connected=1`;
        res.redirect(backUrl);
    } catch (err) {
        console.error('Error al procesar callback de Mercado Pago:', err.message);
        res.status(500).send('Error al procesar callback de Mercado Pago');
    }
};

exports.disconnect = (req, res) => {
    try {
        const tienda = getTiendaFromRequest(req);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        db.prepare(
            "DELETE FROM configuracion WHERE tienda_id = ? AND clave IN ('mp_access_token', 'mp_public_key', 'mp_refresh_token', 'mp_user_id', 'mp_token_expires_at')"
        ).run(tienda.id);

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al desconectar Mercado Pago:', err.message);
        res.status(500).json({ error: 'Error al desconectar Mercado Pago' });
    }
};

/* ============================================================
   BLOQUE 5 — CUENTA DE COBRO GLOBAL DEL SaaS (SuperAdmin)
   ------------------------------------------------------------
   El SuperAdmin conecta su PROPIA cuenta de Mercado Pago vía OAuth.
   Sus credenciales se guardan en config GLOBAL (tienda_id = NULL)
   con claves saas.mp_* (nunca mp_* a secas) para no colisionar con
   las credenciales por tienda ni con resolvePaymentAcrossTenants.
   Se usan exclusivamente para cobrar la mensualidad del plan.
   ============================================================ */

function upsertGlobalConfig(clave, valor, tipo = 'texto', grupo = 'saas') {
    // En SQLite dos NULL no colisionan en la PK compuesta (clave, tienda_id),
    // por eso una fila global se hace delete + insert en transacción.
    const guardar = db.transaction(() => {
        db.prepare('DELETE FROM configuracion WHERE clave = ? AND tienda_id IS NULL').run(clave);
        db.prepare(
            "INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, NULL)"
        ).run(clave, String(valor), tipo, grupo);
    });
    guardar();
}

function getPlataformaCredentials() {
    const rows = db.prepare(
        "SELECT clave, valor FROM configuracion WHERE tienda_id IS NULL AND clave LIKE 'saas.mp_%'"
    ).all();
    const config = {};
    rows.forEach(row => { config[row.clave] = row.valor; });
    return {
        accessToken: config['saas.mp_access_token'] || '',
        publicKey: config['saas.mp_public_key'] || '',
        refreshToken: config['saas.mp_refresh_token'] || '',
        userId: config['saas.mp_user_id'] || '',
        tokenExpiresAt: config['saas.mp_token_expires_at'] ? Number(config['saas.mp_token_expires_at']) : 0,
    };
}

function savePlataformaCredentials(data) {
    upsertGlobalConfig('saas.mp_access_token', data.access_token || '', 'texto', 'saas');
    upsertGlobalConfig('saas.mp_public_key', data.public_key || '', 'texto', 'saas');
    upsertGlobalConfig('saas.mp_refresh_token', data.refresh_token || '', 'texto', 'saas');
    if (data.user_id) {
        upsertGlobalConfig('saas.mp_user_id', String(data.user_id), 'numero', 'saas');
    }
    const expiresAt = Date.now() + 180 * 24 * 60 * 60 * 1000;
    upsertGlobalConfig('saas.mp_token_expires_at', String(expiresAt), 'numero', 'saas');
}

// 'no_conectado' | 'sin_fecha' | 'expirado' | 'proximo_a_vencer' | 'valido'
function getPlataformaTokenStatus() {
    const creds = getPlataformaCredentials();
    if (!creds.accessToken) return 'no_conectado';
    if (!creds.tokenExpiresAt) return 'sin_fecha';
    const ahora = Date.now();
    const sieteDias = 7 * 24 * 60 * 60 * 1000;
    if (ahora >= creds.tokenExpiresAt) return 'expirado';
    if (creds.tokenExpiresAt - ahora <= sieteDias) return 'proximo_a_vencer';
    return 'valido';
}

async function refreshPlataformaMercadoPagoToken() {
    const creds = getPlataformaCredentials();
    if (!creds.refreshToken) {
        console.warn('[MP-SaaS] No hay refresh_token para la cuenta global de cobro');
        return false;
    }
    try {
        const body = new URLSearchParams();
        body.set('grant_type', 'refresh_token');
        body.set('client_id', getAppId());
        body.set('client_secret', getClientSecret());
        body.set('refresh_token', creds.refreshToken);

        const response = await fetch(MP_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[MP-SaaS] Error al refrescar token global:', data);
            return false;
        }
        savePlataformaCredentials(data);
        console.log('[MP-SaaS] Token global refrescado correctamente');
        return true;
    } catch (err) {
        console.error('[MP-SaaS] Error en refreshPlataformaMercadoPagoToken:', err.message);
        return false;
    }
}

// Devuelve el access_token de la cuenta global, refrescándolo si está
// expirado (o disparando refresh preventivo si está próximo a vencer).
async function ensurePlataformaAccessToken() {
    let creds = getPlataformaCredentials();
    if (!creds.accessToken) return null;

    const status = getPlataformaTokenStatus();
    if (status === 'expirado') {
        const ok = await refreshPlataformaMercadoPagoToken();
        creds = getPlataformaCredentials();
        if (!ok || !creds.accessToken) return null;
    } else if (status === 'proximo_a_vencer') {
        refreshPlataformaMercadoPagoToken().catch(() => {});
    }
    return creds.accessToken;
}

// GET estado de la cuenta global de cobro (solo SuperAdmin)
exports.getPlataformaMpStatus = async (req, res) => {
    try {
        const creds = getPlataformaCredentials();
        const tieneToken = Boolean(creds.accessToken && creds.publicKey);
        const tokenStatus = getPlataformaTokenStatus();

        let conectado = false;
        let estadoTexto = 'no_conectado';
        if (tieneToken) {
            if (tokenStatus === 'expirado') {
                estadoTexto = 'expirado';
            } else if (tokenStatus === 'proximo_a_vencer') {
                estadoTexto = 'proximo_a_vencer';
            } else {
                conectado = true;
                estadoTexto = 'conectado';
            }
        }

        // Datos públicos de la cuenta del SuperAdmin para verificar de quién
        // es la cuenta de cobro de la mensualidad (GET /users/me con el token).
        let account = null;
        if (conectado) {
            const token = await ensurePlataformaAccessToken();
            account = token ? await fetchMercadoPagoAccount(token) : null;
        }

        res.json({
            ok: true,
            conectado,
            estadoTexto,
            userId: creds.userId || (account ? account.id : null) || null,
            account,
            monedaCobro: 'ARS',
        });
    } catch (err) {
        console.error('[MP-SaaS] Error al obtener estado de la cuenta global:', err.message);
        res.status(500).json({ error: 'Error al obtener estado de la cuenta global' });
    }
};

// GET inicio del OAuth de la cuenta GLOBAL de cobro (solo SuperAdmin).
// A diferencia del OAuth por tienda, el state NO lleva tienda_id: lleva
// saas_mp = 1 para que el callback guarde en config global.
exports.connectPlataforma = (req, res) => {
    try {
        const user = req.session && req.session.user;
        if (!user || !user.es_superadmin) {
            return res.status(403).json({ error: 'Solo el SuperAdmin puede conectar la cuenta de cobro' });
        }

        const clientId = getAppId();
        let redirectUri;
        try {
            redirectUri = getRedirectUri(req);
        } catch (redirectErr) {
            return res.status(400).json({ error: redirectErr.message });
        }

        if (!clientId || !getClientSecret()) {
            return res.status(500).json({ error: 'Faltan credenciales de Mercado Pago en .env' });
        }

        const state = encodeState({
            saas_mp: 1,
            origen: 'superadmin',
            ts: Date.now(),
            nonce: crypto.randomBytes(8).toString('hex'),
        });

        const authUrl = new URL(MP_AUTH_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('platform_id', 'mp');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);

        res.redirect(authUrl.toString());
    } catch (err) {
        console.error('[MP-SaaS] Error al iniciar conexión de la cuenta global:', err.message);
        res.status(500).json({ error: 'Error al iniciar conexión de la cuenta global' });
    }
};

// POST desconexión de la cuenta GLOBAL de cobro (solo SuperAdmin)
exports.disconnectPlataforma = (req, res) => {
    try {
        const user = req.session && req.session.user;
        if (!user || !user.es_superadmin) {
            return res.status(403).json({ error: 'Solo el SuperAdmin puede desconectar la cuenta de cobro' });
        }

        db.prepare(
            "DELETE FROM configuracion WHERE tienda_id IS NULL AND clave IN ('saas.mp_access_token', 'saas.mp_public_key', 'saas.mp_refresh_token', 'saas.mp_user_id', 'saas.mp_token_expires_at')"
        ).run();

        registrarEvento(null, 'mp_plataforma_desconectada', 'Cuenta Mercado Pago del SuperAdmin desconectada');
        res.json({ ok: true });
    } catch (err) {
        console.error('[MP-SaaS] Error al desconectar la cuenta global:', err.message);
        res.status(500).json({ error: 'Error al desconectar la cuenta global' });
    }
};

function buildBaseUrl(req, slug) {
    const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    if (!slug) return origin;
    return `${origin}/${slug}`;
}

function buildPreferenceItems(productos) {
    return productos.map(producto => {
        const unitPrice = producto.precioConDescuento != null ? Number(producto.precioConDescuento) : Number(producto.precio);
        return {
            id: String(producto.id),
            title: producto.nombre,
            description: producto.descripcion || producto.nombre,
            quantity: Number(producto.cantidad || 1),
            currency_id: 'ARS',
            unit_price: Number(unitPrice.toFixed ? unitPrice.toFixed(2) : unitPrice),
        };
    });
}

async function createMercadoPagoPreference({ accessToken, pedido, tiendaSlug, productos, cliente, telefono }, req) {
    const externalReference = `tienda:${pedido.tienda_id}:pedido:${pedido.id}`;
    const baseUrl = buildBaseUrl(req, tiendaSlug);

    const payload = {
        items: buildPreferenceItems(productos),
        external_reference: externalReference,
        metadata: {
            tienda_id: pedido.tienda_id,
            pedido_id: pedido.id,
            tienda_slug: tiendaSlug,
        },
        back_urls: {
            success: `${baseUrl}/carrito.html?mp_result=success&pedido=${pedido.id}`,
            pending: `${baseUrl}/carrito.html?mp_result=pending&pedido=${pedido.id}`,
            failure: `${baseUrl}/carrito.html?mp_result=failure&pedido=${pedido.id}`,
        },
        auto_return: 'approved',
        binary_mode: true,
        notification_url: `${process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`}/pedidos/webhook/mercadopago`,
        payer: {
            name: cliente,
            phone: telefono ? { number: String(telefono) } : undefined,
        },
    };

    const response = await fetch(MP_PREFERENCES_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
        const err = new Error('No se pudo crear la preferencia de Mercado Pago');
        err.details = data;
        throw err;
    }

    return {
        preferenceId: data.id,
        initPoint: data.init_point || data.sandbox_init_point,
        externalReference,
    };
}

exports.crearPreferenciaDesdePedido = async (req, res) => {
    const { cliente, telefono, productos, total, metodo_entrega } = req.body || {};
    const tienda = getTiendaFromRequest(req);

    if (!tienda) {
        return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    if (!cliente || !telefono || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    let creds = getMercadoPagoCredentials(tienda.id);
    if (!creds.accessToken) {
        return res.status(400).json({ error: 'Mercado Pago no esta conectado para esta tienda' });
    }

    // Si el token está expirado, intentar refresh automático
    const tokenStatus = getTokenStatus(tienda.id);
    if (tokenStatus === 'expirado') {
        console.log('[MP] Token expirado para tienda', tienda.id, '- intentando refresh automatico');
        const refrescado = await refreshMercadoPagoToken(tienda.id);
        if (refrescado) {
            // Volver a obtener credenciales actualizadas
            creds = getMercadoPagoCredentials(tienda.id);
        } else {
            return res.status(400).json({
                error: 'El token de Mercado Pago expiró y no se pudo renovar automáticamente. Reconectá la cuenta desde el panel de administración.',
            });
        }
    } else if (tokenStatus === 'proximo_a_vencer') {
        // Refresh preventivo en segundo plano (no bloqueante)
        refreshMercadoPagoToken(tienda.id).catch(() => {});
    }

    const entrega = metodo_entrega || 'retiro_local';

    const insertPedido = db.transaction((pedidoData, items) => {
        const result = db.prepare(`
            INSERT INTO pedidos (cliente, telefono, total, estado, fecha, tienda_id, metodo_entrega)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            pedidoData.cliente,
            pedidoData.telefono,
            pedidoData.total,
            'Pendiente',
            new Date().toLocaleString(),
            tienda.id,
            entrega
        );

        const pedidoId = result.lastInsertRowid;

        for (const item of items) {
            db.prepare(`
                INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio, tienda_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(pedidoId, item.id, item.nombre, item.cantidad, item.precio, tienda.id);
        }

        return pedidoId;
    });

    const pedidoId = insertPedido({ cliente, telefono, total }, productos);

    try {
        const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND tienda_id = ?').get(pedidoId, tienda.id);
        const preference = await createMercadoPagoPreference(
            {
                accessToken: creds.accessToken,
                pedido,
                tiendaSlug: tienda.slug,
                productos,
                cliente,
                telefono,
            },
            req
        );

        db.prepare(`
            UPDATE pedidos
            SET mp_preference_id = ?, mp_external_reference = ?, mp_checkout_url = ?, mp_payment_status = ?
            WHERE id = ? AND tienda_id = ?
        `).run(preference.preferenceId, preference.externalReference, preference.initPoint, 'pending', pedidoId, tienda.id);

        res.json({
            ok: true,
            pedidoId,
            preferenceId: preference.preferenceId,
            initPoint: preference.initPoint,
        });
    } catch (err) {
        db.prepare('DELETE FROM pedido_items WHERE pedido_id = ? AND tienda_id = ?').run(pedidoId, tienda.id);
        db.prepare('DELETE FROM pedidos WHERE id = ? AND tienda_id = ?').run(pedidoId, tienda.id);

        console.error('Error al crear preferencia de Mercado Pago:', err.message, err.details || '');
        res.status(500).json({ error: 'No se pudo iniciar el pago con Mercado Pago' });
    }
};

/* ============================================================
   BLOQUE 5 — CHECKOUT DE LA MENSUALIDAD SaaS + APLICACIÓN
   ------------------------------------------------------------
   El dueño de una tienda inicia el pago del plan (1 mes) con la
   cuenta GLOBAL del SuperAdmin como receptor. El registro se guarda
   en saas_pagos (estado 'pendiente') y se marca 'aprobado' cuando
   el webhook confirma el pago (aplicarPagoSaaS es idempotente).
   ============================================================ */

function parseExternalReferenceSaaS(externalReference) {
    // Formato: saas:tienda:<tienda_id>
    if (!externalReference || typeof externalReference !== 'string') return null;
    const partes = externalReference.split(':');
    if (partes.length !== 3 || partes[0] !== 'saas' || partes[1] !== 'tienda') return null;
    const tiendaId = parseInt(partes[2], 10);
    if (!Number.isInteger(tiendaId) || tiendaId <= 0) return null;
    return tiendaId;
}

// Calcula la fecha de fin del nuevo período:
//  - si la tienda aún está dentro de un período pago vigente (suscripcion_fin
//    >= hoy) se extiende DESDE esa fecha (sumarMeses conserva el día);
//  - si está en DEMO con trial vigente, el pago arranca al terminar el trial
//    (no regala días superpuestos);
//  - si está vencida/suspendida o sin período, arranca desde hoy.
function calcularNuevaFechaFin(tienda, meses) {
    const hoy = saasUtils.hoyBuenosAires();
    const planActual = String(tienda.plan || 'ilimitado');
    let base = hoy;

    if (planActual === 'demo' && tienda.trial_fin && hoy <= tienda.trial_fin && tienda.trial_fin > base) {
        base = tienda.trial_fin;
    } else if (planActual !== 'demo' && planActual !== 'ilimitado' && tienda.suscripcion_fin && tienda.suscripcion_fin > base) {
        base = tienda.suscripcion_fin;
    }

    return { base, nuevaFin: saasUtils.sumarMeses(base, meses) };
}

// Aplica un pago SaaS aprobado a una tienda (idempotente).
//   - Si el registro ya figura 'aprobado' para ese payment, no hace nada.
//   - Recibe { tiendaId, paymentId, externalReference, preferenceId, monto, moneda, plan, meses, vencimientoPrevios }
// Devuelve { aplicado: bool, yaAplicado: bool, tiendaId, nuevaFechaFin }
function aplicarPagoSaaS(tiendaId, payment, meses = 1) {
    if (!tiendaId) return { aplicado: false, error: 'Sin tienda' };
    const paymentId = String(payment.id || '');
    const externalReference = payment.external_reference || '';

    // Idempotencia por payment_id (único en saas_pagos)
    let pago = null;
    if (paymentId) {
        pago = db.prepare('SELECT * FROM saas_pagos WHERE payment_id = ?').get(paymentId);
    }
    if (!pago && externalReference) {
        pago = db.prepare('SELECT * FROM saas_pagos WHERE external_reference = ? AND tienda_id = ? ORDER BY id DESC LIMIT 1').get(externalReference, tiendaId);
    }

    const hacer = db.transaction(() => {
        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) return { aplicado: false, error: 'Tienda no encontrada' };

        // Si el pago ya se aplicó, no volver a extender (webhook duplicado)
        if (pago && pago.estado === 'aprobado') {
            return { aplicado: false, yaAplicado: true, tiendaId, nuevaFechaFin: pago.nueva_fecha_fin };
        }

        const planNombre = (saasUtils.getGlobalConfig('saas.plan_name') || 'Profesional').toLowerCase();
        const { base, nuevaFin } = calcularNuevaFechaFin(tienda, meses);
        const fueDemo = String(tienda.plan || 'ilimitado') === 'demo';
        const teniaSuscripcion = tienda.suscripcion_fin && String(tienda.suscripcion_fin).length > 0;

        // Extender la tienda
        db.prepare(`
            UPDATE tiendas
            SET plan = ?,
                suscripcion_inicio = ?,
                suscripcion_fin = ?,
                activo = 1
            WHERE id = ?
        `).run(planNombre, base, nuevaFin, tiendaId);

        // Marcar el pago como aprobado (o crear el registro si vino solo por webhook)
        const ahora = new Date().toISOString();
        if (pago) {
            // Completar el registro que quedó 'pendiente' (creado por el
            // checkout): la nueva fecha de fin recién se conoce al confirmar.
            db.prepare(`
                UPDATE saas_pagos
                SET estado = 'aprobado',
                    payment_id = ?,
                    preference_id = COALESCE(?, preference_id),
                    vencimiento_previo = ?,
                    nueva_fecha_fin = ?,
                    aprobado_at = ?
                WHERE id = ?
            `).run(paymentId || pago.payment_id || null, pago.preference_id || null, pago.vencimiento_previo || base || null, nuevaFin, ahora, pago.id);
        } else {
            db.prepare(`
                INSERT INTO saas_pagos
                    (tienda_id, plan, monto, moneda, meses, external_reference, preference_id,
                     payment_id, estado, vencimiento_previo, nueva_fecha_fin, aprobado_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aprobado', ?, ?, ?)
            `).run(
                tiendaId,
                planNombre,
                Number(payment.transaction_amount) || Number(payment.transaction_details?.total_paid_amount) || 0,
                'ARS',
                meses,
                externalReference || null,
                payment.preference_id ? String(payment.preference_id) : null,
                paymentId || null,
                teniaSuscripcion ? tienda.suscripcion_fin : (tienda.trial_fin || null),
                nuevaFin,
                ahora
            );
        }

        // Auditoría
        registrarEvento(
            tiendaId,
            fueDemo ? 'suscripcion_activada' : 'suscripcion_renovada',
            (fueDemo ? 'Suscripción activada (fin de prueba)' : 'Suscripción renovada') +
            ' · plan ' + planNombre + ' · vence ' + nuevaFin +
            (paymentId ? ' · pago MP ' + paymentId : '')
        );

        console.log('[MP-SaaS] Pago aplicado a tienda ' + tiendaId + ': ' + base + ' → ' + nuevaFin);
        return { aplicado: true, yaAplicado: false, tiendaId, nuevaFechaFin: nuevaFin };
    });

    try {
        return hacer();
    } catch (err) {
        console.error('[MP-SaaS] Error en aplicarPagoSaaS:', err.message);
        return { aplicado: false, error: err.message };
    }
}

// POST /api/saas/renovar — inicia el checkout de la mensualidad (dueño autenticado)
exports.crearCheckoutSuscripcionSaaS = async (req, res) => {
    const user = req.session && req.session.user;
    if (!user || user.es_superadmin) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const tiendaId = user.tienda_id || req.tiendaId;
    if (!tiendaId) {
        return res.status(400).json({ error: 'No hay tienda asociada a la sesión' });
    }

    try {
        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }
        if (tienda.activo === 0) {
            return res.status(400).json({ error: 'La tienda fue desactivada manualmente. Contactá al administrador.' });
        }

        // Token de la cuenta GLOBAL de cobro (SuperAdmin)
        const accessToken = await ensurePlataformaAccessToken();
        if (!accessToken) {
            return res.status(503).json({
                error: 'El pago online del plan todavía no está disponible. Contactá al administrador.',
                codigo: 'SAAS_MP_NO_CONFIGURADO',
            });
        }

        const meses = 1;
        const montoArs = parseInt(saasUtils.getGlobalConfig('saas.monto_mensual_ars'), 10);
        const monto = Number.isInteger(montoArs) && montoArs > 0 ? montoArs : 5000;
        const planNombre = saasUtils.getGlobalConfig('saas.plan_name') || 'Profesional';
        const externalReference = `saas:tienda:${tienda.id}`;
        const baseUrl = buildBaseUrl(req, tienda.slug);
        const notificationBase = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;

        // Registro previo (estado pendiente) para trazabilidad e idempotencia
        const insertPago = db.prepare(`
            INSERT INTO saas_pagos
                (tienda_id, plan, monto, moneda, meses, external_reference, preference_id,
                 payment_id, estado, vencimiento_previo, nueva_fecha_fin)
            VALUES (?, ?, ?, 'ARS', ?, ?, NULL, NULL, 'pendiente', ?, NULL)
        `);
        const vencimientoPrevio = tienda.suscripcion_fin || tienda.trial_fin || null;
        const saasPagoId = Number(insertPago.run(tiendaId, planNombre.toLowerCase(), monto, meses, externalReference, vencimientoPrevio).lastInsertRowid);

        const payload = {
            items: [
                {
                    title: `Suscripción mensual · ${planNombre}`,
                    description: 'Mensualidad de tu tienda online (' + tienda.nombre + ')',
                    quantity: 1,
                    currency_id: 'ARS',
                    unit_price: monto,
                },
            ],
            external_reference: externalReference,
            metadata: {
                tipo: 'saas',
                tienda_id: tienda.id,
                tienda_slug: tienda.slug,
                saas_pago_id: saasPagoId,
            },
            back_urls: {
                success: `${baseUrl}/admin/dashboard.html?saas=ok`,
                pending: `${baseUrl}/admin/dashboard.html?saas=pending`,
                failure: `${baseUrl}/admin/dashboard.html?saas=error`,
            },
            auto_return: 'approved',
            binary_mode: true,
            notification_url: `${notificationBase}/pedidos/webhook/mercadopago`,
            payer: {
                name: user.usuario || tienda.nombre,
            },
        };

        const response = await fetch(MP_PREFERENCES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'X-Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            // Limpiar el registro pendiente si MP rechazó la preferencia
            db.prepare('DELETE FROM saas_pagos WHERE id = ?').run(saasPagoId);
            console.error('[MP-SaaS] Error al crear preferencia de suscripción:', data);
            return res.status(500).json({ error: 'No se pudo iniciar el pago de la suscripción' });
        }

        db.prepare('UPDATE saas_pagos SET preference_id = ? WHERE id = ?').run(String(data.id), saasPagoId);

        res.json({
            ok: true,
            saasPagoId,
            preferenceId: data.id,
            initPoint: data.init_point || data.sandbox_init_point,
            externalReference,
            monto,
            moneda: 'ARS',
        });
    } catch (err) {
        console.error('[MP-SaaS] Error en crearCheckoutSuscripcionSaaS:', err.message);
        res.status(500).json({ error: 'No se pudo iniciar el pago de la suscripción' });
    }
};

async function fetchPaymentWithAccessToken(paymentId, accessToken) {
    const response = await fetch(`${MP_PAYMENTS_URL}/${paymentId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        return null;
    }

    return response.json();
}

async function resolvePaymentAcrossTenants(paymentId) {
    // 1) Access tokens por tienda (mp_access_token con tienda_id)
    const candidates = db.prepare(
        "SELECT tienda_id, valor AS access_token FROM configuracion WHERE clave = 'mp_access_token' AND tienda_id IS NOT NULL AND valor IS NOT NULL AND valor != ''"
    ).all();

    // 2) Access token GLOBAL del SuperAdmin (cobro SaaS, tienda_id NULL,
    //    clave saas.mp_access_token) para resolver pagos de mensualidades.
    const plataforma = db.prepare(
        "SELECT valor AS access_token FROM configuracion WHERE clave = 'saas.mp_access_token' AND tienda_id IS NULL AND valor IS NOT NULL AND valor != ''"
    ).get();
    if (plataforma) {
        candidates.push({ tienda_id: null, access_token: plataforma.access_token });
    }

    for (const candidate of candidates) {
        try {
            const payment = await fetchPaymentWithAccessToken(paymentId, candidate.access_token);
            if (payment) {
                return {
                    payment,
                    tiendaId: candidate.tienda_id,
                };
            }
        } catch (err) {
            continue;
        }
    }

    return null;
}

function formatPaymentMethod(payment) {
    const method = payment.payment_method_id || '';
    const methodNames = {
        'visa': 'Visa',
        'master': 'Mastercard',
        'amex': 'Amex',
        'naranja': 'Naranja',
        'cabal': 'Cabal',
        'maestro': 'Maestro',
        'debcabal': 'Cabal Debito',
        'debvisa': 'Visa Debito',
        'debmaster': 'Mastercard Debito',
        'pagofacil': 'Pago Facil',
        'rapipago': 'Rapipago',
        'efectivo': 'Efectivo',
        'mercadopago': 'Mercado Pago',
        'account_money': 'MP - Dinero en cuenta',
    };
    return methodNames[method] || method;
}

function formatCardInfo(payment) {
    if (payment.card && payment.card.last_four_digits) {
        return `****${payment.card.last_four_digits}`;
    }
    return '';
}

function formatInstallments(payment) {
    if (payment.installments && payment.installments > 1) {
        return `${payment.installments} cuotas`;
    }
    return '1 pago';
}

function buildWhatsAppMessage({ pedido, payment, tiendaNombre }) {
    const metodoPago = formatPaymentMethod(payment);
    const tarjeta = formatCardInfo(payment);
    const cuotas = formatInstallments(payment);
    const totalPagado = payment.transaction_details?.total_paid_amount || pedido.total;
    const fechaPago = payment.date_approved
        ? new Date(payment.date_approved).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
        : new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    // Obtener items del pedido
    let itemsStr = '';
    try {
        const items = db.prepare('SELECT nombre, cantidad, precio FROM pedido_items WHERE pedido_id = ? AND tienda_id = ?').all(pedido.id, pedido.tienda_id);
        items.forEach(item => {
            itemsStr += '   ' + item.nombre + ' x' + item.cantidad + ' ................ $' + (item.precio * item.cantidad).toFixed(2) + '\n';
        });
    } catch (e) {
        itemsStr = '   (ver detalle en el panel)\n';
    }

    const SEP = '----------------------------------------';
    const LINE = '========================================';

    var textoEntrega = pedido.metodo_entrega === 'retiro_local'
        ? 'Retiro en local'
        : 'Coordinar con el vendedor';

    const mensajeCliente =
        '  FACTURA #' + pedido.id + '  -  PAGADO\n' +
        LINE + '\n' +
        '\n' +
        '  Tienda: ' + (tiendaNombre || 'MI SHOP') + '\n' +
        '  Cliente: ' + pedido.cliente + '\n' +
        '  Fecha: ' + fechaPago + '\n' +
        '\n' +
        '  PRODUCTOS\n' +
        itemsStr +
        SEP + '\n' +
        '  TOTAL .......................... $' + Number(totalPagado).toFixed(2) + '\n' +
        '  Metodo de entrega: ' + textoEntrega + '\n' +
        '\n' +
        '  Pago: ' + metodoPago + ' ' + tarjeta + '\n' +
        '  Transaccion: ' + payment.id + '\n' +
        '  ' + cuotas + '\n' +
        '  Estado: PAGADO\n' +
        LINE;

    const mensajeDueno =
        '  FACTURA #' + pedido.id + '  -  PAGADO\n' +
        LINE + '\n' +
        '\n' +
        '  Tienda: ' + (tiendaNombre || 'MI SHOP') + '\n' +
        '  Cliente: ' + pedido.cliente + '\n' +
        '  Telefono: ' + pedido.telefono + '\n' +
        '  Fecha: ' + fechaPago + '\n' +
        '\n' +
        '  PRODUCTOS\n' +
        itemsStr +
        SEP + '\n' +
        '  TOTAL .......................... $' + Number(totalPagado).toFixed(2) + '\n' +
        '  Metodo de entrega: ' + textoEntrega + '\n' +
        '\n' +
        '  Pago: ' + metodoPago + ' ' + tarjeta + '\n' +
        '  Transaccion: ' + payment.id + '\n' +
        '  ' + cuotas + '\n' +
        '  Estado: PAGADO\n' +
        LINE;

    return { mensajeCliente, mensajeDueno };
}

function enviarWhatsAppConfirmacion({ tiendaId, telefono, pedido, payment }) {
    const config = getTiendaConfigMap(tiendaId);
    const webhookUrl = config.whatsapp_webhook_url || config.whatsapp_api_url;
    const tiendaNombre = config.nombre_tienda || 'Mi Shop';

    const { mensajeCliente, mensajeDueno } = buildWhatsAppMessage({ pedido, payment, tiendaNombre });

    if (!webhookUrl) {
        console.warn('[MP] No hay integracion de envio de WhatsApp configurada para la tienda', tiendaId, {
            telefono,
            mensajeCliente,
            paymentId: payment.id,
        });
        return false;
    }

    // Enviar mensaje al cliente
    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tienda_id: tiendaId,
            telefono,
            mensaje: mensajeCliente,
            pedido_id: pedido.id,
            payment_id: payment.id,
            external_reference: payment.external_reference,
        }),
    }).catch(err => {
        console.error('[MP] Error al enviar WhatsApp de confirmacion al cliente:', err.message);
    });

    // Enviar mensaje al dueño si hay un número configurado
    const telefonoDueno = config.whatsapp_numero_del_dueno || config.whatsapp_numero;
    if (telefonoDueno) {
        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tienda_id: tiendaId,
                telefono: telefonoDueno,
                mensaje: mensajeDueno,
                pedido_id: pedido.id,
                payment_id: payment.id,
                external_reference: payment.external_reference,
                tipo: 'notificacion_dueno',
            }),
        }).catch(err => {
            console.error('[MP] Error al enviar WhatsApp de notificacion al dueño:', err.message);
        });
    }

    return true;
}

exports.webhook = async (req, res) => {
    try {
        const paymentId = req.body?.data?.id || req.body?.id || req.query['data.id'] || req.query.id;
        const topic = req.body?.type || req.query.type || req.query.topic;

        if (!paymentId) {
            return res.status(200).json({ ok: true, ignored: true });
        }

        if (topic && topic !== 'payment' && topic !== 'payment.updated' && topic !== 'payments') {
            return res.status(200).json({ ok: true, ignored: true });
        }

        const resolved = await resolvePaymentAcrossTenants(paymentId);
        if (!resolved || !resolved.payment) {
            return res.status(200).json({ ok: true, ignored: true });
        }

        const payment = resolved.payment;
        const externalReference = payment.external_reference || '';

        // BLOQUE 5 — RAMA SaaS: pago de la mensualidad del plan.
        // Las referencias `saas:tienda:<id>` las crea crearCheckoutSuscripcionSaaS
        // y el receptor es la cuenta GLOBAL del SuperAdmin. Nunca tocan pedidos.
        const saasTiendaId = parseExternalReferenceSaaS(externalReference);
        if (saasTiendaId) {
            if (payment.status !== 'approved') {
                // Pago rechazado/pendiente: registrar el estado sin extender plan
                try {
                    db.prepare(
                        "UPDATE saas_pagos SET estado = ? WHERE external_reference = ? AND tienda_id = ?"
                    ).run(String(payment.status || 'pendiente'), externalReference, saasTiendaId);
                } catch (err) { /* tolerante */ }
                return res.status(200).json({ ok: true, tipo: 'saas', status: payment.status });
            }

            const resultado = aplicarPagoSaaS(saasTiendaId, payment, 1);
            console.log('[MP-SaaS] Webhook pago de suscripción:', JSON.stringify(resultado));
            return res.status(200).json({ ok: true, tipo: 'saas', aplicado: resultado.aplicado, yaAplicado: resultado.yaAplicado });
        }

        // RAMA PEDIDOS: cobro por tienda (external_reference tienda:<id>:pedido:<id>)
        if (payment.status !== 'approved') {
            db.prepare(`
                UPDATE pedidos
                SET mp_payment_id = ?, mp_payment_status = ?
                WHERE mp_external_reference = ? AND tienda_id = ?
            `).run(String(payment.id), payment.status || 'unknown', externalReference, resolved.tiendaId);
            return res.status(200).json({ ok: true, status: payment.status });
        }

        const pedido = db.prepare(`
            SELECT *
            FROM pedidos
            WHERE (mp_external_reference = ? OR mp_preference_id = ? OR mp_payment_id = ?)
              AND tienda_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(externalReference, String(payment.preference_id || ''), String(payment.id), resolved.tiendaId);

        if (!pedido) {
            return res.status(200).json({ ok: true, ignored: true });
        }

        db.prepare(`
            UPDATE pedidos
            SET estado = 'Pagado',
                mp_payment_id = ?,
                mp_payment_status = ?,
                mp_external_reference = ?
            WHERE id = ? AND tienda_id = ?
        `).run(String(payment.id), payment.status, externalReference || pedido.mp_external_reference || '', pedido.id, resolved.tiendaId);

        enviarWhatsAppConfirmacion({
            tiendaId: resolved.tiendaId,
            telefono: pedido.telefono,
            pedido,
            payment,
        });

        res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Error en webhook de Mercado Pago:', err.message);
        res.status(200).json({ ok: true });
    }
};
