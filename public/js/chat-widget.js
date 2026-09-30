(function () {
    'use strict';

    var slug = '';
    if (typeof window.obtenerSlug === 'function') {
        slug = window.obtenerSlug();
    } else {
        var pathParts = window.location.pathname.split('/').filter(Boolean);
        var primer = pathParts[0] && pathParts[0].match(/^[a-z0-9-]+$/);
        var reservados = ['api', 'auth', 'productos', 'pedidos', 'categorias', 'uploads', 'css', 'js', 'admin', 'superadmin', 'saas', 'registro', 'registrate', 'home', 'carrito.html'];
        if (primer && reservados.indexOf(primer[0]) === -1) slug = primer[0];
    }

    if (!slug) return;
    if (window.__chatWidgetCargado) return;
    if (typeof window.esAdminTienda === 'function' && window.esAdminTienda()) return;
    var rutaActual = window.location.pathname || '';
    if (rutaActual.indexOf('/admin/') !== -1 || rutaActual.indexOf('/superadmin') === 0) return;
    window.__chatWidgetCargado = true;

    var estado = { abierto: false, esperando: false };

    var style = document.createElement('style');
    style.textContent =
        '#yamy-chat-fab{position:fixed;right:24px;bottom:92px;z-index:900;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;box-shadow:0 6px 20px rgba(17,24,39,.28);transition:transform .18s ease;-webkit-appearance:none;appearance:none}' +
        '#yamy-chat-fab:hover{transform:scale(1.06)}' +
        '#yamy-chat-panel{position:fixed;right:24px;bottom:160px;z-index:910;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 210px);display:none;flex-direction:column;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 18px 50px rgba(17,24,39,.22);overflow:hidden;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111827}' +
        '#yamy-chat-panel.abierto{display:flex}' +
        '#yamy-chat-header{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#111827;color:#fff}' +
        '#yamy-chat-header .chat-dot{width:9px;height:9px;border-radius:50%;background:#34d399;flex:none}' +
        '#yamy-chat-header .chat-titulo{font-weight:700;font-size:14px}' +
        '#yamy-chat-header .chat-sub{font-size:11px;opacity:.7}' +
        '#yamy-chat-close{margin-left:auto;background:rgba(255,255,255,.12);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px;line-height:1}' +
        '#yamy-chat-msgs{flex:1;overflow-y:auto;padding:16px;background:#f9fafb;display:flex;flex-direction:column;gap:10px}' +
        '.yamy-chat-msg{max-width:82%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word}' +
        '.yamy-chat-msg.bot{background:#eef2f7;color:#111827;align-self:flex-start;border-bottom-left-radius:4px}' +
        '.yamy-chat-msg.user{background:#111827;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
        '.yamy-chat-msg.err{background:#fef2f2;color:#b91c1c;align-self:flex-start;border-bottom-left-radius:4px;font-size:13px}' +
        '.yamy-chat-typing{display:none;align-items:center;gap:4px;align-self:flex-start;background:#eef2f7;padding:10px 14px;border-radius:14px;border-bottom-left-radius:4px}' +
        '.yamy-chat-typing.on{display:flex}' +
        '.yamy-chat-typing span{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:yamyBlink 1.2s infinite}' +
        '.yamy-chat-typing span:nth-child(2){animation-delay:.2s}' +
        '.yamy-chat-typing span:nth-child(3){animation-delay:.4s}' +
        '@keyframes yamyBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}' +
        '#yamy-chat-input{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fff}' +
        '#yamy-chat-input input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:9px 12px;font-size:14px;outline:none;font-family:inherit;color:#111827}' +
        '#yamy-chat-input input:focus{border-color:#111827}' +
        '#yamy-chat-send{border:none;background:#111827;color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-weight:700;-webkit-appearance:none;appearance:none}' +
        '#yamy-chat-send:disabled{opacity:.45;cursor:not-allowed}' +
        '@media(max-width:480px){#yamy-chat-panel{right:16px;left:16px;max-width:none;width:auto}}';
    document.head.appendChild(style);

    function crearFab() {
        var fab = document.createElement('button');
        fab.id = 'yamy-chat-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Abrir chat de la tienda');
        fab.innerHTML =
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
        return fab;
    }

    var botonHostil = document.querySelector('[data-whatsapp-action]');

    function crearPanel() {
        var panel = document.createElement('div');
        panel.id = 'yamy-chat-panel';

        var header = document.createElement('div');
        header.id = 'yamy-chat-header';
        var dot = document.createElement('span');
        dot.className = 'chat-dot';
        var titulo = document.createElement('div');
        titulo.className = 'chat-titulo';
        titulo.textContent = 'Asistente de la tienda';
        var sub = document.createElement('div');
        sub.className = 'chat-sub';
        sub.textContent = 'Respondemos rápido';
        var cerrar = document.createElement('button');
        cerrar.type = 'button';
        cerrar.id = 'yamy-chat-close';
        cerrar.setAttribute('aria-label', 'Cerrar chat');
        cerrar.textContent = '\u00D7';
        header.appendChild(dot);
        header.appendChild(titulo);
        header.appendChild(sub);
        header.appendChild(cerrar);

        var msgs = document.createElement('div');
        msgs.id = 'yamy-chat-msgs';

        var typing = document.createElement('div');
        typing.className = 'yamy-chat-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';

        var inputRow = document.createElement('div');
        inputRow.id = 'yamy-chat-input';
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Escribí tu mensaje...';
        input.setAttribute('autocomplete', 'off');
        input.maxLength = 1000;
        var enviar = document.createElement('button');
        enviar.type = 'button';
        enviar.id = 'yamy-chat-send';
        enviar.textContent = 'Enviar';
        enviar.disabled = true;
        inputRow.appendChild(input);
        inputRow.appendChild(enviar);

        panel.appendChild(header);
        panel.appendChild(msgs);
        panel.appendChild(typing);
        panel.appendChild(inputRow);
        return panel;
    }

    function recibir(texto, tipo) {
        var msgs = document.getElementById('yamy-chat-msgs');
        var burbuja = document.createElement('div');
        burbuja.className = 'yamy-chat-msg ' + (tipo || 'bot');
        burbuja.textContent = texto;
        msgs.appendChild(burbuja);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function setesperando(on) {
        estado.esperando = on;
        var typing = document.querySelector('.yamy-chat-typing');
        var enviar = document.getElementById('yamy-chat-send');
        if (typing) typing.classList.toggle('on', on);
        if (enviar) enviar.disabled = on;
        var msgs = document.getElementById('yamy-chat-msgs');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function enviarMensaje(texto) {
        if (estado.esperando) return;
        recibir(texto, 'user');
        setesperando(true);

        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: texto, storeSlug: slug }),
        }).then(function (res) {
            return res.json().then(function (data) {
                if (!res.ok) return { error: (data && data.error) || null, status: res.status };
                return data;
            });
        }).then(function (res) {
            if (res.ok && res.respuesta) {
                recibir(res.respuesta, 'bot');
            } else if (res.error) {
                recibir(res.error, 'err');
            } else {
                recibir('El asistente no pudo responder en este momento. Intentá de nuevo.', 'err');
            }
        }).catch(function () {
            recibir('No se pudo conectar con el asistente. Revisá tu conexión e intentá de nuevo.', 'err');
        }).finally(function () {
            setesperando(false);
        });
    }

    function alternar() {
        var panel = document.getElementById('yamy-chat-panel');
        var fab = document.getElementById('yamy-chat-fab');
        estado.abierto = !estado.abierto;
        panel.classList.toggle('abierto', estado.abierto);
        if (estado.abierto) {
            fab.style.display = 'none';
            setTimeout(function () {
                var input = panel.querySelector('input');
                if (input) input.focus();
            }, 60);
        } else {
            fab.style.display = 'flex';
        }
    }

    var fab = crearFab();
    var panel = crearPanel();
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    if (botonHostil) {
        panel.style.bottom = '110px';
    }

    var primeraVez = true;
    fab.addEventListener('click', function () {
        if (primeraVez) {
            primeraVez = false;
            recibir('¡Hola! Soy el asistente de esta tienda. Escribime tu consulta y te respondo al instante. \uD83D\uDE4C', 'bot');
        }
        alternar();
    });
    document.getElementById('yamy-chat-close').addEventListener('click', alternar);

    var input = panel.querySelector('input');
    var enviar = document.getElementById('yamy-chat-send');
    input.addEventListener('input', function () {
        enviar.disabled = estado.esperando || !input.value.trim();
    });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !estado.esperando && input.value.trim()) {
            var texto = input.value.trim();
            input.value = '';
            enviar.disabled = true;
            enviarMensaje(texto);
        }
    });
    enviar.addEventListener('click', function () {
        if (estado.esperando || !input.value.trim()) return;
        var texto = input.value.trim();
        input.value = '';
        enviar.disabled = true;
        enviarMensaje(texto);
    });
})();