// utils/mailer.js
// ============================================
// Envío de correo transaccional (SMTP) con nodemailer.
// Lee la config SMTP del .env:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// Si no hay SMTP configurado, NO rompe el flujo: en desarrollo imprime el
// correo por consola (modo "log") para poder probar la recuperación de
// contraseña y demás avisos sin depender de un proveedor real.
// ============================================

const nodemailer = require('nodemailer');

function tieneConfigSmtp() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function crearTransporte() {
    if (!tieneConfigSmtp()) return null;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

function remitente() {
    if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
    return '"Shop SaaS" <' + (process.env.SMTP_USER || 'no-reply@localhost') + '>';
}

// Envía un mail. Devuelve { ok, entregado, messageId? }.
// Con SMTP sin configurar, imprime el mensaje por consola (dev) y responde
// ok:true con entregado:false para no bloquear flujos de prueba.
async function enviarMail({ to, subject, text, html }) {
    if (!to) {
        return { ok: false, entregado: false, error: 'Destinatario vacío' };
    }
    const transporte = crearTransporte();
    if (!transporte) {
        console.log('\n[Mailer] SMTP no configurado — correo NO enviado (log de desarrollo):');
        console.log('  Para:   ' + to);
        console.log('  Asunto: ' + subject);
        console.log('  Cuerpo: ' + (text || html || ''));
        return { ok: true, entregado: false, motivo: 'smtp_no_configurado' };
    }
    try {
        const info = await transporte.sendMail({
            from: remitente(),
            to,
            subject,
            text: text || '',
            html: html || '',
        });
        return { ok: true, entregado: true, messageId: info.messageId };
    } catch (err) {
        console.error('[Mailer] Error al enviar mail a ' + to + ':', err.message);
        return { ok: false, entregado: false, error: err.message };
    }
}

module.exports = { enviarMail, tieneConfigSmtp, crearTransporte };
