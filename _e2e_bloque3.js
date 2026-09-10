/* ============================================================
   E2E BLOQUE 3 — Verificación end-to-end descartable
   Levanta la app en un puerto efímero, crea una tienda DEMO de
   prueba vía la API de SuperAdmin refactorizada (sin password_plain),
   valida el estado derivado / candados de suspensión y la LEE bien:
     - loginTienda DEMO ok
     - /api/saas/plan expone estado demo
     - /auth/verificar expone tiendaEstado/planInfo
     - vencido el trial: tienda pública 404, login owner 403,
       mutations admin 403, endpoints públicos de venta 403
   Al final ELIMINA la tienda descartable (rollback real de datos).
   No deja rastros en la BD (salvo ids autoincrementales).
   ============================================================ */

const db = require('./database/db');
const app = require('./server');

const hoyBA = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

function sumarDiasFecha(fecha, dias) {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
}

let okCount = 0;
let failCount = 0;
function check(nombre, condicion, detalle) {
    if (condicion) {
        okCount++;
        console.log('  [OK] ' + nombre);
    } else {
        failCount++;
        console.log('  [FAIL] ' + nombre + (detalle ? ' => ' + detalle : ''));
    }
}

function cookieDe(res) {
    const set = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    return set.map((c) => c.split(';')[0]).join('; ');
}

// Limpieza de residuos de corridas anteriores (E2E idempotente):
// borra cualquier tienda cuyo slug comience con el prefijo de prueba.
function limpiarResiduosPrevios() {
    const ids = db.prepare("SELECT id FROM tiendas WHERE slug LIKE 'e2e-demo-%'").all().map((r) => r.id);
    if (ids.length === 0) return;
    console.log('[LIMPIEZA PREVIA] quitando residuos de tiendas previas: ' + ids.join(', '));
    const borrar = db.transaction((lista) => {
        for (const id of lista) {
            db.prepare('DELETE FROM store_events WHERE tienda_id = ?').run(id);
            db.prepare('DELETE FROM pedido_items WHERE tienda_id = ?').run(id);
            db.prepare('DELETE FROM pedidos WHERE tienda_id = ?').run(id);
            db.prepare('DELETE FROM productos WHERE tienda_id = ?').run(id);
            db.prepare('DELETE FROM categorias WHERE tienda_id = ?').run(id);
            db.prepare('DELETE FROM configuracion WHERE tienda_id = ?').run(id);
            db.prepare('DELETE FROM usuarios WHERE tienda_id = ? AND es_superadmin = 0').run(id);
            db.prepare('DELETE FROM tiendas WHERE id = ?').run(id);
        }
    });
    borrar(ids);
}

(async () => {
    limpiarResiduosPrevios();
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const puerto = server.address().port;
    const BASE = 'http://127.0.0.1:' + puerto;
    console.log('Servidor E2E en ' + BASE);

    let cookieSuper = '';
    let cookieOwner = '';

    async function api(path, opts = {}) {
        const cookie = opts.cookie || '';
        const headers = { 'Content-Type': 'application/json' };
        if (cookie) headers.Cookie = cookie;
        // Fusionar headers adicionales (p. ej. Referer para detección de slug)
        Object.assign(headers, opts.headers || {});
        const res = await fetch(BASE + path, {
            method: opts.method || 'GET',
            headers,
            redirect: 'manual',
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }
        return { status: res.status, data, cookies: cookieDe(res) };
    }

    const slugBase = 'e2e-demo-' + Date.now().toString(36);
    const slugDemo = slugBase;
    const slugLegacy = slugBase + '-legacy';
    const usuario = 'e2e_admin';
    const pass = 'ClaveE2E123';

    let idDemo = null;
    let idLegacy = null;

    try {
        // 1) Password del superadmin desde password_plain (test local)
        const su = db.prepare('SELECT password_plain FROM usuarios WHERE usuario = ? AND es_superadmin = 1').get('admin');
        const passSuper = (su && su.password_plain) || 'Super1234';

        // ===== A. Login SuperAdmin =====
        console.log('\n[1] Login SuperAdmin');
        let r = await api('/auth/login/superadmin', { method: 'POST', body: { usuario: 'admin', password: passSuper } });
        check('login superadmin 200 ok', r.status === 200 && r.data.ok === true, 'status=' + r.status);
        cookieSuper = r.cookies;

        // ===== B. getTiendas sin password_plain =====
        console.log('\n[2] GET /api/superadmin/tiendas (sin password_plain)');
        r = await api('/api/superadmin/tiendas', { cookie: cookieSuper });
        check('lista tiendas 200', r.status === 200 && Array.isArray(r.data), 'status=' + r.status);
        const fila0 = (r.data && r.data[0]) || {};
        check('NO expone password_plain', !('password_plain' in fila0) && !('admin_password' in fila0));
        check('sí expone plan/activo', 'plan' in fila0 && 'activo' in fila0);

        // ===== C. Crear tienda DEMO (alta transaccional, sin password_plain) =====
        console.log('\n[3] POST /api/superadmin/tiendas plan=demo');
        r = await api('/api/superadmin/tiendas', {
            method: 'POST', cookie: cookieSuper,
            body: { slug: slugDemo, nombre: 'E2E Demo', admin_usuario: usuario, admin_password: pass, plan: 'demo' },
        });
        check('crear demo ok', r.status === 200 && r.data.ok && r.data.plan === 'demo', JSON.stringify(r.data));
        idDemo = r.data && r.data.id;

        // ===== D. Crear tienda ilimitado (legacy) =====
        console.log('\n[4] POST /api/superadmin/tiendas plan=ilimitado (legacy)');
        r = await api('/api/superadmin/tiendas', {
            method: 'POST', cookie: cookieSuper,
            body: { slug: slugLegacy, nombre: 'E2E Legacy', admin_usuario: 'e2e_legacy', admin_password: 'ClaveLegacy1', plan: 'ilimitado' },
        });
        check('crear ilimitado ok', r.status === 200 && r.data.ok && r.data.plan === 'ilimitado', JSON.stringify(r.data));
        idLegacy = r.data && r.data.id;

        // ===== E. Verificación en BD: plan, trial y NO password_plain =====
        console.log('\n[5] Estado en BD de la tienda demo');
        const td = db.prepare('SELECT id, plan, trial_inicio, trial_fin, activo FROM tiendas WHERE id = ?').get(idDemo);
        check('plan=demo', td && td.plan === 'demo');
        check('trial_inicio=hoy', td && td.trial_inicio === hoyBA());
        check('trial_fin=hoy+30d', td && td.trial_fin === sumarDiasFecha(hoyBA(), 30), td && td.trial_fin);
        const ud = db.prepare('SELECT id, usuario, password_plain, password FROM usuarios WHERE tienda_id = ? AND es_superadmin = 0').get(idDemo);
        check('admin sin password_plain', ud && ud.password_plain === null, 'password_plain=' + (ud && ud.password_plain));
        check('admin con hash', ud && typeof ud.password === 'string' && ud.password.length > 20);
        const cfgCount = db.prepare('SELECT COUNT(*) c FROM configuracion WHERE tienda_id = ?').get(idDemo).c;
        const catCount = db.prepare('SELECT COUNT(*) c FROM categorias WHERE tienda_id = ?').get(idDemo).c;
        check('config por defecto (29)', cfgCount === 29, 'cfg=' + cfgCount);
        check('categorias por defecto (3)', catCount === 3, 'cat=' + catCount);

        // ===== F. Tienda legacy NO tiene trial =====
        const tl = db.prepare('SELECT plan, trial_fin FROM tiendas WHERE id = ?').get(idLegacy);
        check('legacy plan=ilimitado sin trial_fin', tl && tl.plan === 'ilimitado' && !tl.trial_fin);

        // ===== G. Login owner (estado DEMO) =====
        console.log('\n[6] Login owner DEMO');
        r = await api('/auth/login/tienda', { method: 'POST', body: { usuario, password: pass, slug: slugDemo } });
        check('login owner demo 200', r.status === 200 && r.data.ok, 'status=' + r.status + ' ' + JSON.stringify(r.data));
        cookieOwner = r.cookies;

        // ===== H. GET /api/saas/plan =====
        console.log('\n[7] GET /api/saas/plan');
        r = await api('/api/saas/plan', { cookie: cookieOwner });
        check('plan endpoint 200', r.status === 200, 'status=' + r.status);
        check('estado=demo', r.data && r.data.estado === 'demo', JSON.stringify(r.data));
        check('plan=demo', r.data && r.data.plan === 'demo');
        check('diasRestantes>0', r.data && r.data.diasRestantes > 0, 'dias=' + (r.data && r.data.diasRestantes));
        check('trialFin presente', r.data && !!r.data.trialFin);

        // ===== I. GET /auth/verificar con tiendaEstado =====
        console.log('\n[8] GET /auth/verificar (owner)');
        r = await api('/auth/verificar', { cookie: cookieOwner });
        check('verificar 200', r.status === 200);
        check('tiendaEstado=demo', r.data && r.data.tiendaEstado === 'demo', JSON.stringify(r.data && r.data.tiendaEstado));
        check('planInfo.estado=demo', r.data && r.data.planInfo && r.data.planInfo.estado === 'demo');

        // ===== J. Home pública DEMO renderiza (200) =====
        console.log('\n[9] Home pública demo (antes de vencer)');
        r = await api('/' + slugDemo + '/', {});
        check('home demo 200', r.status === 200, 'status=' + r.status);

        // ===== K. Vencer trial: simular fin ayer =====
        console.log('\n[10] Vencer trial (trial_fin = ayer)');
        const ayer = sumarDiasFecha(hoyBA(), -1);
        db.prepare('UPDATE tiendas SET trial_fin = ? WHERE id = ?').run(ayer, idDemo);

        // K1. Home pública → 404
        r = await api('/' + slugDemo + '/', {});
        check('home demo vencida → 404', r.status === 404, 'status=' + r.status);

        // K2. Login owner → 403 TIENDA_SUSPENDIDA
        r = await api('/auth/login/tienda', { method: 'POST', body: { usuario, password: pass, slug: slugDemo } });
        check('login owner vencida → 403', r.status === 403 && r.data.codigo === 'TIENDA_SUSPENDIDA', 'status=' + r.status + ' ' + JSON.stringify(r.data));

        // K3. Mutation admin (con sesión previa del owner) → 403
        // Aunque la cookie de sesión sigue viva, cargarPlanEstado deriva suspendido.
        r = await api('/productos', { method: 'POST', cookie: cookieOwner, body: { nombre: 'X', precio: 1 } });
        check('POST /productos admin vencida → 403', r.status === 403 && r.data.codigo === 'TIENDA_SUSPENDIDA', 'status=' + r.status + ' ' + JSON.stringify(r.data));

        // K4. Candado público de venta (POST /pedidos con Referer de la tienda)
        const refererHeaders = { Referer: BASE + '/' + slugDemo + '/carrito.html' };
        r = await api('/pedidos', { method: 'POST', body: { cliente: { nombre: 'X' }, productos: [] }, headers: refererHeaders });
        check('POST /pedidos público vencida → 403', r.status === 403 && r.data.codigo === 'TIENDA_SUSPENDIDA', 'status=' + r.status + ' ' + JSON.stringify(r.data));

        // K5. Candado público mercadopago preference
        r = await api('/pedidos/mercadopago', { method: 'POST', body: { productos: [] }, headers: refererHeaders });
        check('POST /pedidos/mercadopago público vencida → 403', r.status === 403 && r.data.codigo === 'TIENDA_SUSPENDIDA', 'status=' + r.status + ' ' + JSON.stringify(r.data));

        // ===== L. Restaurar demo (renovar trial = hoy) y comprobar que vuelve a operar =====
        console.log('\n[11] Renovar trial (hoy)');
        db.prepare('UPDATE tiendas SET trial_fin = ? WHERE id = ?').run(hoyBA(), idDemo);
        r = await api('/' + slugDemo + '/', {});
        check('home demo renovada → 200', r.status === 200, 'status=' + r.status);
        r = await api('/auth/login/tienda', { method: 'POST', body: { usuario, password: pass, slug: slugDemo } });
        check('login owner renovada → 200', r.status === 200 && r.data.ok, 'status=' + r.status);
        cookieOwner = r.cookies;
        r = await api('/productos', { method: 'POST', cookie: cookieOwner, body: { nombre: 'X', precio: 1 } });
        // Puede fallar por validación del body/upload; importa que NO sea 403 SUSPENDIDA
        check('mutation admin renovada NO es 403-suspendida', r.status !== 403 || r.data.codigo !== 'TIENDA_SUSPENDIDA', 'status=' + r.status + ' ' + JSON.stringify(r.data));

        // ===== M. getUsuarios no expone password_plain =====
        console.log('\n[12] GET /api/superadmin/usuarios');
        r = await api('/api/superadmin/usuarios?tienda_id=' + idDemo, { cookie: cookieSuper });
        check('usuarios 200', r.status === 200 && Array.isArray(r.data));
        const filaU = (r.data && r.data[0]) || {};
        check('usuarios NO expone password_plain', !('password_plain' in filaU), JSON.stringify(filaU));

        // ===== N. Limpieza: eliminar tiendas descartables =====
        console.log('\n[13] Limpieza (eliminar tiendas de prueba)');
        if (idDemo) {
            r = await api('/api/superadmin/tiendas/' + idDemo, { method: 'DELETE', cookie: cookieSuper });
            check('eliminar demo ok', r.status === 200 && r.data.ok, 'status=' + r.status);
        }
        if (idLegacy) {
            r = await api('/api/superadmin/tiendas/' + idLegacy, { method: 'DELETE', cookie: cookieSuper });
            check('eliminar legacy ok', r.status === 200 && r.data.ok, 'status=' + r.status);
        }
        const residuos = db.prepare('SELECT COUNT(*) c FROM tiendas WHERE slug IN (?, ?)').get(slugDemo, slugLegacy).c;
        check('sin residuos de tiendas', residuos === 0, 'residuos=' + residuos);
        const residuosCfg = db.prepare('SELECT COUNT(*) c FROM configuracion WHERE tienda_id IN (?, ?)').get(idDemo || 0, idLegacy || 0).c;
        check('sin residuos de config', residuosCfg === 0, 'cfg=' + residuosCfg);
        const residuosUsr = db.prepare('SELECT COUNT(*) c FROM usuarios WHERE tienda_id IN (?, ?)').get(idDemo || 0, idLegacy || 0).c;
        check('sin residuos de usuarios', residuosUsr === 0, 'usr=' + residuosUsr);
    } catch (err) {
        failCount++;
        console.error('  [ERROR GLOBAL] ' + (err && err.stack || err));
    } finally {
        // Limpieza de emergencia por si algo falló a mitad de camino
        try {
            if (idDemo) db.prepare('DELETE FROM store_events WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM store_events WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM pedido_items WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM pedido_items WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM pedidos WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM pedidos WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM productos WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM productos WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM categorias WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM categorias WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM configuracion WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM configuracion WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM usuarios WHERE tienda_id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM usuarios WHERE tienda_id = ?').run(idLegacy);
            if (idDemo) db.prepare('DELETE FROM tiendas WHERE id = ?').run(idDemo);
            if (idLegacy) db.prepare('DELETE FROM tiendas WHERE id = ?').run(idLegacy);
        } catch (e) { console.error('[LIMPIEZA EMERGENCIA] ' + e.message); }
        server.close();
    }

    console.log('\n==============================================');
    console.log('RESULTADO E2E BLOQUE 3: ' + okCount + ' OK / ' + failCount + ' FAIL');
    console.log('==============================================');
    process.exit(failCount > 0 ? 1 : 0);
})();
