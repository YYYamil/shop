const crypto = require('crypto');
const db = require('../database/db');

const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';
const MP_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences';

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
    if (!payload || !payload.tienda_id) {
        return res.status(400).send('Estado OAuth invalido');
    }

    const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE id = ? AND activo = 1').get(payload.tienda_id);
    if (!tienda || tienda.slug !== payload.slug) {
        return res.status(400).send('No se pudo validar la tienda');
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
    const { cliente, telefono, productos, total } = req.body || {};
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

    const insertPedido = db.transaction((pedidoData, items) => {
        const result = db.prepare(`
            INSERT INTO pedidos (cliente, telefono, total, estado, fecha, tienda_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            pedidoData.cliente,
            pedidoData.telefono,
            pedidoData.total,
            'Pendiente',
            new Date().toLocaleString(),
            tienda.id
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
    const candidates = db.prepare(
        "SELECT tienda_id, valor AS access_token FROM configuracion WHERE clave = 'mp_access_token' AND valor IS NOT NULL AND valor != ''"
    ).all();

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
        if (payment.status !== 'approved') {
            db.prepare(`
                UPDATE pedidos
                SET mp_payment_id = ?, mp_payment_status = ?
                WHERE mp_external_reference = ? AND tienda_id = ?
            `).run(String(payment.id), payment.status || 'unknown', payment.external_reference || '', resolved.tiendaId);
            return res.status(200).json({ ok: true, status: payment.status });
        }

        const pedido = db.prepare(`
            SELECT *
            FROM pedidos
            WHERE (mp_external_reference = ? OR mp_preference_id = ? OR mp_payment_id = ?)
              AND tienda_id = ?
            ORDER BY id DESC
            LIMIT 1
        `).get(payment.external_reference || '', String(payment.preference_id || ''), String(payment.id), resolved.tiendaId);

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
        `).run(String(payment.id), payment.status, payment.external_reference || pedido.mp_external_reference || '', pedido.id, resolved.tiendaId);

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
