(function () {
    const MP_CONFIRMATION_KEY = 'mp_confirmacion_pago';

    function getCarritoActual() {
        try {
            return typeof obtenerCarrito === 'function' ? obtenerCarrito() : [];
        } catch (err) {
            return [];
        }
    }

    function getDatosCliente() {
        const cliente = document.getElementById('cliente')?.value?.trim() || '';
        const codigo = document.getElementById('tel-codigo')?.value?.replace(/\D/g, '') || '';
        const numero = document.getElementById('tel-numero')?.value?.replace(/\D/g, '') || '';
        const telefono = '549' + codigo + numero;

        return { cliente, codigo, numero, telefono };
    }

    function calcularTotalYMensaje() {
        const carrito = getCarritoActual();
        let total = 0;
        let mensaje = '¡Hola! Quiero hacer un pedido:%0A%0A';

        const datos = getDatosCliente();
        mensaje += '👤 Cliente: ' + datos.cliente + '%0A';
        mensaje += '📞 Teléfono: ' + datos.telefono + '%0A%0A';
        mensaje += '━━━ *PRODUCTOS* ━━━%0A';

        carrito.forEach(producto => {
            const precioUnitario = producto.precioConDescuento != null ? producto.precioConDescuento : producto.precio;
            const subtotal = Math.round(precioUnitario * producto.cantidad * 100) / 100;
            total += subtotal;
            mensaje += '• ' + producto.nombre + ' x' + producto.cantidad + ' = $' + subtotal + '%0A';
        });

        mensaje += '%0A━━━━━━━━━━━━━━━%0A';
        mensaje += '*TOTAL: $ ' + total + '*';

        return { carrito, total, mensaje, datos };
    }

    function buildMensajePagoExitoso({ pedidoId, cliente, telefono, total, carrito }) {
        const slug = typeof obtenerSlug === 'function' ? obtenerSlug() : '';
        const tiendaSlug = slug ? slug.toUpperCase() : (window.__tiendaNombre || 'MI SHOP');

        // Emojis como variables para evitar problemas de codificacion
        var EMOJI_RECEIPT = String.fromCodePoint(0x1F9FE);
        var EMOJI_CHECK = String.fromCodePoint(0x2705);
        var EMOJI_STORE = String.fromCodePoint(0x1F3EA);
        var EMOJI_USER = String.fromCodePoint(0x1F464);
        var EMOJI_PACKAGE = String.fromCodePoint(0x1F4E6);
        var EMOJI_MONEY = String.fromCodePoint(0x1F4B2);
        var EMOJI_CARD = String.fromCodePoint(0x1F4B3);
        var LINE = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';
        var DASH = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';

        var itemsStr = '';
        carrito.forEach(function(producto) {
            var precioUnitario = producto.precioConDescuento != null ? producto.precioConDescuento : producto.precio;
            var subtotal = Math.round(precioUnitario * producto.cantidad * 100) / 100;
            itemsStr += '   ' + producto.nombre + ' x' + producto.cantidad + ' ................ $' + subtotal + '\n';
        });

        var NL = '\n';
        var mensaje =
            EMOJI_RECEIPT + ' *FACTURA #' + (pedidoId || '---') + '* ' + EMOJI_CHECK + NL +
            LINE + NL +
            NL +
            EMOJI_STORE + ' *' + tiendaSlug + '*' + NL +
            EMOJI_USER + ' ' + cliente + NL +
            NL +
            EMOJI_PACKAGE + ' *PRODUCTOS*' + NL +
            itemsStr +
            DASH + NL +
            EMOJI_MONEY + ' *TOTAL* ................. *$' + total + '*' + NL +
            NL +
            EMOJI_CARD + ' Mercado Pago' + NL +
            LINE;

        return mensaje;
    }

    function guardarConfirmacionPendiente(data) {
        try {
            sessionStorage.setItem(MP_CONFIRMATION_KEY, JSON.stringify(data));
        } catch (err) {
            console.warn('[MP] No se pudo guardar la confirmacion pendiente:', err);
        }
    }

    function leerConfirmacionPendiente() {
        try {
            const raw = sessionStorage.getItem(MP_CONFIRMATION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    }

    function limpiarConfirmacionPendiente() {
        try {
            sessionStorage.removeItem(MP_CONFIRMATION_KEY);
        } catch (err) {
            // ignore
        }
    }

    function abrirWhatsAppConfirmacion(data) {
        const wpNumero = window.__whatsappNumero;
        if (!wpNumero) {
            mostrarToastLocal('No hay número de WhatsApp configurado para la tienda');
            return false;
        }

        const mensaje = buildMensajePagoExitoso(data);
        const url = `https://wa.me/${wpNumero}?text=${encodeURIComponent(mensaje)}`;
        limpiarConfirmacionPendiente();
        window.location.href = url;
        return true;
    }

    function procesarRetornoMercadoPago() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mp_result') !== 'success') {
            return;
        }

        const data = leerConfirmacionPendiente();
        if (!data) {
            return;
        }

        abrirWhatsAppConfirmacion(data);
    }

    function mostrarToastLocal(mensaje) {
        if (typeof mostrarToast === 'function') {
            mostrarToast(mensaje);
            return;
        }
        alert(mensaje);
    }

    function actualizarBotonCheckout() {
        const btn = document.getElementById('btnFinalizar');
        if (!btn) return;

        const mpActivo = Boolean(window.__mercadopagoActivo);
        btn.dataset.metodoPago = mpActivo ? 'mercadopago' : 'whatsapp';
        btn.textContent = mpActivo ? 'Pagar con Mercado Pago' : 'Enviar pedido por WhatsApp';
    }

    async function finalizarCompraWhatsapp() {
        const { carrito, total, mensaje, datos } = calcularTotalYMensaje();

        if (
            datos.cliente.trim() === '' ||
            datos.telefono.trim() === '' ||
            datos.codigo.length < 3 ||
            datos.numero.length < 5
        ) {
            mostrarToastLocal('Completá tu nombre y un teléfono válido (código + número)');
            return;
        }

        try {
            const slug = typeof obtenerSlug === 'function' ? obtenerSlug() : null;
            const url = slug ? '/pedidos?slug=' + slug : '/pedidos';
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente: datos.cliente,
                    telefono: datos.telefono,
                    productos: carrito,
                    total,
                }),
            });
        } catch (e) {
            console.error('Error al enviar pedido al servidor:', e);
        }

        const wpNumero = window.__whatsappNumero;
        if (wpNumero) {
            window.open(`https://wa.me/${wpNumero}?text=${mensaje}`, '_blank');
        } else {
            mostrarToastLocal('No hay número de WhatsApp configurado para recibir pedidos');
        }

        if (typeof eliminarCarrito === 'function') {
            eliminarCarrito();
        }
        if (typeof cargarCarrito === 'function') {
            cargarCarrito();
        }
        if (typeof actualizarContadorGlobal === 'function') {
            actualizarContadorGlobal();
        }
        if (typeof window.obtenerBaseUrl === 'function') {
            window.location = obtenerBaseUrl();
        }
    }

    async function finalizarCompraMercadoPago() {
        const { carrito, total, datos } = calcularTotalYMensaje();

        if (
            datos.cliente.trim() === '' ||
            datos.telefono.trim() === '' ||
            datos.codigo.length < 3 ||
            datos.numero.length < 5
        ) {
            mostrarToastLocal('Completá tu nombre y un teléfono válido (código + número)');
            return;
        }

        const slug = typeof obtenerSlug === 'function' ? obtenerSlug() : null;
        const url = slug ? '/pedidos/mercadopago?slug=' + slug : '/pedidos/mercadopago';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente: datos.cliente,
                    telefono: datos.telefono,
                    productos: carrito,
                    total,
                    slug,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                mostrarToastLocal(data.error || 'No se pudo iniciar el pago con Mercado Pago');
                return;
            }

            if (!data.initPoint) {
                mostrarToastLocal('Mercado Pago no devolvió la URL de pago');
                return;
            }

            if (typeof eliminarCarrito === 'function') {
                eliminarCarrito();
            }

            guardarConfirmacionPendiente({
                pedidoId: data.pedidoId,
                cliente: datos.cliente,
                telefono: datos.telefono,
                total,
                carrito,
            });
            window.location = data.initPoint;
        } catch (err) {
            console.error('Error al iniciar Mercado Pago:', err);
            mostrarToastLocal('Error de conexión al iniciar Mercado Pago');
        }
    }

    window.__actualizarAccionCarrito = actualizarBotonCheckout;
    actualizarBotonCheckout();

    window.finalizarCompra = async function () {
        if (window.__mercadopagoActivo) {
            return finalizarCompraMercadoPago();
        }
        return finalizarCompraWhatsapp();
    };

    const originalAplicarConfiguracion = window.aplicarConfiguracion;
    if (typeof originalAplicarConfiguracion === 'function') {
        window.aplicarConfiguracion = function (config) {
            const result = originalAplicarConfiguracion(config);
            window.__mercadopagoActivo = Boolean(config && (config.mp_conectado || config.mp_activo));
            actualizarBotonCheckout();
            procesarRetornoMercadoPago();
            return result;
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        actualizarBotonCheckout();
        procesarRetornoMercadoPago();
    });
})();
