const N8N_CHAT_WEBHOOK_URL = process.env.N8N_CHAT_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook-test/chat-test';
const N8N_TIMEOUT_MS = 60000;
const MAX_MENSAJE = 1000;

function extraerRespuesta(data) {
    if (typeof data === 'string') {
        const texto = data.trim();
        return texto ? texto.slice(0, 3000) : null;
    }
    if (!data || typeof data !== 'object') return null;

    const claves = ['respuesta', 'response', 'mensaje', 'message', 'output', 'text', 'result', 'answer'];
    for (const clave of claves) {
        const valor = data[clave];
        if (typeof valor === 'string' && valor.trim()) {
            return valor.trim().slice(0, 3000);
        }
    }
    if (data.output && typeof data.output === 'object') {
        const anidado = extraerRespuesta(data.output);
        if (anidado) return anidado;
    }
    return null;
}

exports.enviarMensaje = async (req, res) => {
    const mensaje = String((req.body && req.body.mensaje) || '').trim();

    if (!mensaje) {
        return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }
    if (mensaje.length > MAX_MENSAJE) {
        return res.status(400).json({ error: 'El mensaje es demasiado largo (máximo ' + MAX_MENSAJE + ' caracteres)' });
    }

    const storeSlug = req.tiendaSlug || null;
    const storeId = req.tiendaId || null;
    if (!storeSlug || !storeId) {
        return res.status(400).json({ error: 'No se pudo identificar la tienda desde la que se consulta' });
    }

    const storeSlugCliente = String((req.body && req.body.storeSlug) || '').trim();
    if (storeSlugCliente && storeSlugCliente !== storeSlug) {
        console.warn('[CHAT] storeSlug del cliente difiere del resuelto en servidor: cliente=' + storeSlugCliente + ' servidor=' + storeSlug);
    }

    let storeName = storeSlug;
    try {
        const db = require('../database/db');
        const fila = db.prepare('SELECT nombre FROM tiendas WHERE id = ?').get(storeId);
        if (fila && fila.nombre) storeName = String(fila.nombre).trim();
    } catch (e) {}

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

    try {
        const respuestaN8n = await fetch(N8N_CHAT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                mensaje,
                storeSlug,
                storeId,
                storeName,
            }),
        });

        let data = null;
        const textBody = await respuestaN8n.text();
        if (textBody) {
            try {
                data = JSON.parse(textBody);
            } catch (e) {
                data = textBody;
            }
        }

        if (!respuestaN8n.ok) {
            console.error('[CHAT] n8n respondió HTTP ' + respuestaN8n.status + ' para storeSlug=' + storeSlug);
            return res.status(502).json({ error: 'El asistente no está disponible en este momento. Intentá de nuevo en unos minutos.' });
        }

        const texto = extraerRespuesta(data);
        if (!texto) {
            console.error('[CHAT] n8n devolvió respuesta sin texto parseable para storeSlug=' + storeSlug);
            return res.status(502).json({ error: 'El asistente no pudo responder en este momento. Intentá de nuevo.' });
        }

        return res.json({ ok: true, respuesta: texto });
    } catch (err) {
        console.error('[CHAT] Error llamando a n8n (storeSlug=' + storeSlug + '):', err && err.message ? err.message : err);
        return res.status(502).json({ error: 'El asistente no está disponible en este momento. Intentá de nuevo en unos minutos.' });
    } finally {
        clearTimeout(timeout);
    }
};