(function () {
    var MP_CONFIRMATION_KEY = 'mp_confirmacion_pago';
    var mpPendienteDeRedirigir = false;

    function abrirModalMP() {
        var overlay = document.getElementById('mpModalInstrucciones');
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    function cerrarModalMP() {
        var overlay = document.getElementById('mpModalInstrucciones');
        if (overlay) {
            overlay.classList.remove('active');
        }
        mpPendienteDeRedirigir = false;
    }

    function irAPagarMP() {
        var pendiente = mpPendienteDeRedirigir;
        cerrarModalMP();
        if (pendiente) {
            var data = leerConfirmacionPendiente();
            if (data && data.initPoint) {
                window.location = data.initPoint;
            }
        }
    }

    window.cerrarModalMP = cerrarModalMP;
    window.irAPagarMP = irAPagarMP;

    function getCarritoActual() {
        try {
            return typeof obtenerCarrito === 'function' ? obtenerCarrito() : [];
        } catch (err) {
            return [];
        }
    }

    function getDatosCliente() {
        var cliente = document.getElementById('cliente')?.value?.trim() || '';
        var codigo = document.getElementById('tel-codigo')?.value?.replace(/\D/g, '') || '';
        var numero = document.getElementById('tel-numero')?.value?.replace(/\D/g, '') || '';
        var telefono = '549' + codigo + numero;

        return { cliente: cliente, codigo: codigo, numero: numero, telefono: telefono };
    }

    function calcularTotalYMensaje() {
        var carrito = getCarritoActual();
        var total = 0;
        var mensaje = '¡Hola! Quiero hacer un pedido:%0A%0A';

        var datos = getDatosCliente();
        mensaje += '👤 Cliente: ' + datos.cliente + '%0A';
        mensaje += '📞 Teléfono: ' + datos.telefono + '%0A%0A';
        mensaje += '━━━ *PRODUCTOS* ━━━%0A';

        carrito.forEach(function(producto) {
            var precioUnitario = producto.precioConDescuento != null ? producto.precioConDescuento : producto.precio;
            var subtotal = Math.round(precioUnitario * producto.cantidad * 100) / 100;
            total += subtotal;
            mensaje += '• ' + producto.nombre + ' x' + producto.cantidad + ' = $' + subtotal + '%0A';
        });

        mensaje += '%0A━━━━━━━━━━━━━━━%0A';
        mensaje += '*TOTAL: $ ' + total + '*';

        return { carrito: carrito, total: total, mensaje: mensaje, datos: datos };
    }

    function buildMensajePagoExitoso(_ref) {
        var pedidoId = _ref.pedidoId;
        var cliente = _ref.cliente;
        var telefono = _ref.telefono;
        var total = _ref.total;
        var carrito = _ref.carrito;

        var slug = typeof obtenerSlug === 'function' ? obtenerSlug() : '';
        var tiendaSlug = slug ? slug.toUpperCase() : (window.__tiendaNombre || 'MI SHOP');

        var ahora = new Date();
        var fecha = ahora.toLocaleDateString('es-AR');
        var hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        var itemsStr = '';
        carrito.forEach(function(producto) {
            var precioUnitario = producto.precioConDescuento != null ? producto.precioConDescuento : producto.precio;
            var subtotal = Math.round(precioUnitario * producto.cantidad * 100) / 100;
            itemsStr += '   ' + producto.nombre + ' x' + producto.cantidad + ' ................ $' + subtotal + '\n';
        });

        var SEP = '----------------------------------------';
        var LINE = '========================================';

        var mensaje =
            '  FACTURA #' + (pedidoId || '---') + '  -  PAGADO' + '\n' +
            LINE + '\n' +
            '\n' +
            '  Tienda: ' + tiendaSlug + '\n' +
            '  Cliente: ' + cliente + '\n' +
            '  Fecha: ' + fecha + '  ' + hora + '\n' +
            '\n' +
            '  PRODUCTOS' + '\n' +
            itemsStr +
            SEP + '\n' +
            '  TOTAL .......................... $' + total + '\n' +
            '\n' +
            '  Pago: Mercado Pago' + '\n' +
            '  Estado: PAGADO' + '\n' +
            LINE;

        return mensaje;
    }

    // Usamos localStorage en lugar de sessionStorage para que los datos
    // persistan incluso cuando la app de Mercado Pago abre un nuevo contexto
    // de navegación al volver (problema común en mobile).
    function guardarConfirmacionPendiente(data) {
        try {
            localStorage.setItem(MP_CONFIRMATION_KEY, JSON.stringify(data));
        } catch (err) {
            console.warn('[MP] No se pudo guardar la confirmacion pendiente:', err);
        }
    }

    function leerConfirmacionPendiente() {
        try {
            var raw = localStorage.getItem(MP_CONFIRMATION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    }

    function limpiarConfirmacionPendiente() {
        try {
            localStorage.removeItem(MP_CONFIRMATION_KEY);
        } catch (err) {
            // ignore
        }
    }

    /**
     * Intenta recuperar los datos del pedido consultando al backend.
     * Se usa como respaldo cuando localStorage no tiene los datos
     * (ej: mobile donde la app de MP abre un contexto de navegación diferente).
     * El endpoint ya devuelve los items del pedido incluidos en la respuesta.
     */
    function recuperarPedidoPorAPI(pedidoId) {
        return new Promise(function(resolve) {
            if (!pedidoId) {
                resolve(null);
                return;
            }
            var slug = typeof obtenerSlug === 'function' ? obtenerSlug() : '';
            var url = slug
                ? '/pedidos/mercadopago/pedido/' + pedidoId + '/status?slug=' + slug
                : '/pedidos/mercadopago/pedido/' + pedidoId + '/status';

            fetch(url)
                .then(function(res) { return res.json().catch(function() { return null; }); })
                .then(function(data) {
                    if (data && data.ok && data.pagado && data.pedido) {
                        var items = data.pedido.items || [];
                        resolve({
                            pedidoId: data.pedido.id,
                            cliente: data.pedido.cliente,
                            telefono: data.pedido.telefono,
                            total: data.pedido.total,
                            carrito: items.map(function(item) {
                                return {
                                    id: item.producto_id,
                                    nombre: item.nombre,
                                    cantidad: item.cantidad,
                                    precio: item.precio,
                                };
                            }),
                        });
                    } else {
                        resolve(null);
                    }
                })
                .catch(function() {
                    resolve(null);
                });
        });
    }

    function abrirWhatsAppConfirmacion(data) {
        var wpNumero = window.__whatsappNumero;
        if (!wpNumero) {
            mostrarToastLocal('No hay número de WhatsApp configurado para la tienda');
            return false;
        }

        var mensaje = buildMensajePagoExitoso(data);
        var url = 'https://wa.me/' + wpNumero + '?text=' + encodeURIComponent(mensaje);
        limpiarConfirmacionPendiente();

        // Solo eliminar carrito cuando el pago fue exitoso
        if (typeof eliminarCarrito === 'function') {
            eliminarCarrito();
        }

        window.location.href = url;
        return true;
    }

    function procesarRetornoMercadoPago() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('mp_result') !== 'success') {
            return;
        }

        var pedidoId = params.get('pedido');
        var data = leerConfirmacionPendiente();

        if (data) {
            // Caso ideal: tenemos los datos en localStorage
            abrirWhatsAppConfirmacion(data);
        } else if (pedidoId) {
            // Respaldo mobile: no hay datos en localStorage, consultamos al backend
            mostrarToastLocal('Procesando tu pago...');
            recuperarPedidoPorAPI(pedidoId).then(function(dataRecuperado) {
                if (dataRecuperado) {
                    abrirWhatsAppConfirmacion(dataRecuperado);
                } else {
                    mostrarToastLocal('El pago fue exitoso, pero no se pudo recuperar el detalle del pedido. Revisá el panel de administración.');
                }
            });
        } else {
            mostrarToastLocal('Pago exitoso. Abrí WhatsApp para enviar el comprobante.');
        }
    }

    function mostrarToastLocal(mensaje) {
        if (typeof mostrarToast === 'function') {
            mostrarToast(mensaje);
            return;
        }
        alert(mensaje);
    }

    function actualizarBotonCheckout() {
        var btn = document.getElementById('btnFinalizar');
        if (!btn) return;

        var mpActivo = Boolean(window.__mercadopagoActivo);
        btn.dataset.metodoPago = mpActivo ? 'mercadopago' : 'whatsapp';
        btn.textContent = mpActivo ? 'Pagar con Mercado Pago' : 'Enviar pedido por WhatsApp';
    }

    async function finalizarCompraWhatsapp() {
        var _calcularTotalYMensaje = calcularTotalYMensaje();
        var carrito = _calcularTotalYMensaje.carrito;
        var total = _calcularTotalYMensaje.total;
        var mensaje = _calcularTotalYMensaje.mensaje;
        var datos = _calcularTotalYMensaje.datos;

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
            var slug = typeof obtenerSlug === 'function' ? obtenerSlug() : null;
            var url = slug ? '/pedidos?slug=' + slug : '/pedidos';
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente: datos.cliente,
                    telefono: datos.telefono,
                    productos: carrito,
                    total: total,
                }),
            });
        } catch (e) {
            console.error('Error al enviar pedido al servidor:', e);
        }

        var wpNumero = window.__whatsappNumero;
        if (wpNumero) {
            window.open('https://wa.me/' + wpNumero + '?text=' + mensaje, '_blank');
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
        var _calcularTotalYMensaje2 = calcularTotalYMensaje();
        var carrito = _calcularTotalYMensaje2.carrito;
        var total = _calcularTotalYMensaje2.total;
        var datos = _calcularTotalYMensaje2.datos;

        if (
            datos.cliente.trim() === '' ||
            datos.telefono.trim() === '' ||
            datos.codigo.length < 3 ||
            datos.numero.length < 5
        ) {
            mostrarToastLocal('Completá tu nombre y un teléfono válido (código + número)');
            return;
        }

        var slug = typeof obtenerSlug === 'function' ? obtenerSlug() : null;
        var url = slug ? '/pedidos/mercadopago?slug=' + slug : '/pedidos/mercadopago';

        try {
            var response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente: datos.cliente,
                    telefono: datos.telefono,
                    productos: carrito,
                    total: total,
                    slug: slug,
                }),
            });

            var data = await response.json().catch(function() { return {}; });
            if (!response.ok) {
                mostrarToastLocal(data.error || 'No se pudo iniciar el pago con Mercado Pago');
                return;
            }

            if (!data.initPoint) {
                mostrarToastLocal('Mercado Pago no devolvió la URL de pago');
                return;
            }

            guardarConfirmacionPendiente({
                pedidoId: data.pedidoId,
                cliente: datos.cliente,
                telefono: datos.telefono,
                total: total,
                carrito: carrito,
                initPoint: data.initPoint,
            });
            mpPendienteDeRedirigir = true;
            abrirModalMP();
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

    var originalAplicarConfiguracion = window.aplicarConfiguracion;
    if (typeof originalAplicarConfiguracion === 'function') {
        window.aplicarConfiguracion = function (config) {
            var result = originalAplicarConfiguracion(config);
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
