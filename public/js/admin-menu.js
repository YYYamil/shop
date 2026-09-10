/* ============================================
   MENÚ LATERAL + BANNER DE PLAN (BLOQUE 3)
   ============================================
   - Añade el enlace "Activar método de pago" (Mercado Pago) en la sidebar.
   - Inyecta un banner superior con el estado comercial de la tienda
     (DEMO / ACTIVO / SUSPENDIDO) consumiendo GET /api/saas/plan.
   Se ejecuta en todas las páginas del panel admin de tienda.
*/
(function () {
    function crearLinkMercadoPago() {
        if (typeof obtenerRutaAdmin !== 'function') return;

        const nav = document.getElementById('sidebarNav');
        if (!nav) return;

        if (nav.querySelector('[data-page="mercadopago"]')) return;

        const link = document.createElement('a');
        link.href = obtenerRutaAdmin('mercadopago.html');
        link.className = 'nav-link';
        link.dataset.page = 'mercadopago';
        link.textContent = '💳 Activar método de pago';

        const personalizacion = nav.querySelector('[data-page="personalizacion"]');
        if (personalizacion && personalizacion.parentNode) {
            personalizacion.insertAdjacentElement('afterend', link);
        } else {
            nav.appendChild(link);
        }

        if (window.location.pathname.includes('/mercadopago.html')) {
            link.classList.add('active');
        }
    }

    // ------------------------------------------------------------
    // BANNER ESTADO / PLAN
    // ------------------------------------------------------------
    function formatearFecha(fechaISO) {
        if (!fechaISO) return '';
        const partes = String(fechaISO).split('-');
        if (partes.length !== 3) return fechaISO;
        return partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    // BLOQUE 5 — Checkout de la mensualidad del plan.
    // Llama a POST /api/saas/renovar (dueño autenticado) y redirige al
    // init_point que devuelve Mercado Pago. La preferencia se genera con la
    // cuenta GLOBAL del SuperAdmin como receptor.
    async function iniciarCheckoutSuscripcion(btn) {
        if (!btn) return;
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Procesando…';
        try {
            const res = await fetch('/api/saas/renovar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = (data && data.codigo === 'SAAS_MP_NO_CONFIGURADO')
                    ? 'El pago online del plan todavía no está disponible. Contactá al administrador.'
                    : (data && data.error) || 'No se pudo iniciar el pago. Intentá de nuevo.';
                if (typeof window.mostrarToast === 'function') window.mostrarToast(msg, 'error');
                else alert(msg);
                return;
            }
            if (!data || !data.initPoint) {
                if (typeof window.mostrarToast === 'function') window.mostrarToast('No se pudo iniciar el pago de la suscripción.', 'error');
                else alert('No se pudo iniciar el pago de la suscripción.');
                return;
            }
            window.location.href = data.initPoint;
        } catch (e) {
            if (typeof window.mostrarToast === 'function') window.mostrarToast('Error de conexión al iniciar el pago. Intentá de nuevo.', 'error');
            else alert('Error de conexión al iniciar el pago. Intentá de nuevo.');
        } finally {
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    }

    // Feedback al volver de Mercado Pago (back_urls → dashboard.html?saas=ok|pending|error)
    function avisarResultadoPago() {
        if (!/^\/([a-z0-9-]+)\/admin\//.test(window.location.pathname)) return;
        const saas = new URLSearchParams(window.location.search).get('saas');
        if (!saas) return;
        const mensajes = {
            ok: 'Pago aprobado. Tu plan se está actualizando automáticamente…',
            pending: 'Pago pendiente. Cuando se acredite, tu plan se activa automáticamente.',
            error: 'El pago no se completó. Podés volver a intentarlo desde el banner de tu plan.',
        };
        const texto = mensajes[saas];
        const tipo = saas === 'ok' ? 'success' : (saas === 'pending' ? 'info' : 'error');
        if (texto) {
            if (typeof window.mostrarToast === 'function') window.mostrarToast(texto, tipo);
            else alert(texto);
        }
        // Limpiar la query sin recargar la página
        if (window.history && window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('saas');
            window.history.replaceState(null, '', url.toString());
        }
        // El webhook puede tardar unos segundos: refrescar el banner del plan
        if (saas === 'ok') {
            setTimeout(function () {
                const previo = document.getElementById('planBanner');
                if (previo) previo.remove();
                crearBannerPlan();
            }, 6000);
        }
    }

    function crearElementoBanner(estilo, contenido) {
        const banner = document.createElement('div');
        banner.id = 'planBanner';
        Object.assign(banner.style, {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 18px',
            margin: '0 0 14px 0',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: '600',
            lineHeight: '1.4',
            boxSizing: 'border-box',
        }, estilo);

        const texto = document.createElement('div');
        texto.innerHTML = contenido.texto;

        const accion = document.createElement('div');
        accion.style.display = 'flex';
        accion.style.gap = '8px';
        accion.style.flexShrink = '0';

        const btnRenovar = document.createElement('button');
        btnRenovar.type = 'button';
        btnRenovar.textContent = contenido.boton || 'Renovar plan';
        btnRenovar.style.cssText = [
            'padding:7px 16px',
            'border:none',
            'border-radius:8px',
            'background:#fff',
            'color:' + (estilo.color || '#1e293b'),
            'font-weight:700',
            'font-size:13px',
            'cursor:pointer',
            'box-shadow:0 1px 3px rgba(0,0,0,0.15)'
        ].join(';');
        btnRenovar.addEventListener('click', function (ev) {
            ev.preventDefault();
            iniciarCheckoutSuscripcion(btnRenovar);
        });

        accion.appendChild(btnRenovar);
        banner.appendChild(texto);
        banner.appendChild(accion);
        return banner;
    }

    function renderBannerPlan(data) {
        const contenedor = document.querySelector('.admin-content');
        if (!contenedor || document.getElementById('planBanner')) return;

        const estado = data.estado;

        // Tiendas de por vida (legacy) activas: no mostramos banner para no
        // estorbar la operación diaria (plan ilimitado nunca vence).
        if (data.esIlimitado && estado === 'activo') return;

        let banner = null;
        if (estado === 'suspendido') {
            banner = crearElementoBanner({
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
            }, {
                texto: '⛔ <strong>Tu tienda está suspendida.</strong> La prueba o tu suscripción vencieron. Renová tu plan para reactivar tu tienda y volver a vender.',
                boton: 'Renovar ahora',
            });
        } else if (estado === 'demo') {
            const dias = (data.diasRestantes !== null && data.diasRestantes !== undefined)
                ? data.diasRestantes
                : '—';
            banner = crearElementoBanner({
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
            }, {
                texto: '🎉 <strong>Estás en tu período de prueba.</strong> Te quedan <strong>' + dias + ' días</strong> (hasta el ' + formatearFecha(data.fechaFin || data.trialFin) + ').',
                boton: 'Ver planes',
            });
        } else {
            // Plan pago activo
            const planNombre = (data.config && data.config.planNombre) || 'Profesional';
            const vence = formatearFecha(data.fechaFin || data.suscripcionFin);
            banner = crearElementoBanner({
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
            }, {
                texto: '✅ <strong>Plan ' + planNombre + ' activo.</strong>' + (vence ? ' Tu suscripción vence el ' + vence + '.' : ''),
                boton: 'Gestionar plan',
            });
        }

        if (banner) {
            contenedor.insertBefore(banner, contenedor.firstChild);
        }
    }

    async function crearBannerPlan() {
        if (typeof esSuperadmin === 'function' && esSuperadmin()) return;
        // Solo en paneles admin de tienda (/:slug/admin/...)
        if (!/^\/([a-z0-9-]+)\/admin\//.test(window.location.pathname)) return;

        try {
            const res = await fetch('/api/saas/plan', { credentials: 'same-origin' });
            if (!res.ok) return; // auth.js redirige si hay 401; 403 ya controlado
            const data = await res.json();
            if (data && data.ok) renderBannerPlan(data);
        } catch (e) {
            // Sin conexión o error: no bloquear el panel
        }
    }

    document.addEventListener('DOMContentLoaded', crearLinkMercadoPago);
    document.addEventListener('DOMContentLoaded', crearBannerPlan);
    document.addEventListener('DOMContentLoaded', avisarResultadoPago);
})();
