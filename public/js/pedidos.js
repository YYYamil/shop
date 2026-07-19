// public/js/pedidos.js

let pedidosGlobal = [];
let paginaActual = 1;
const pedidosPorPagina = 6;
let confirmCallback = null;
let filtroActivo = 'todos';

/* ===== Toast ===== */
function mostrarToast(mensaje, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast' + (tipo ? ' ' + tipo : '');
    toast.textContent = mensaje;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('oculto');
        setTimeout(() => toast.remove(), 250);
    }, 2500);
}

/* ===== Confirm personalizado ===== */
function mostrarConfirm(mensaje, callback) {
    const overlay = document.getElementById('confirmOverlay');
    const mensajeEl = document.getElementById('confirmMensaje');
    const btnAceptar = document.getElementById('confirmAceptar');
    const btnCancelar = document.getElementById('confirmCancelar');

    if (!overlay) return;

    confirmCallback = callback;
    mensajeEl.textContent = mensaje;
    overlay.style.display = 'flex';

    btnAceptar.onclick = () => {
        overlay.style.display = 'none';
        if (confirmCallback) confirmCallback();
    };
    btnCancelar.onclick = () => {
        overlay.style.display = 'none';
        confirmCallback = null;
    };
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
            confirmCallback = null;
        }
    };
}

async function cargarPedidos() {

    try {

        const respuesta = await fetch('/pedidos', {
            credentials: 'same-origin'
        });

        if (respuesta.status === 401) {
            window.location.href = obtenerRutaLogin();
            return;
        }

        if (!respuesta.ok) {
            console.error('Error del servidor:', respuesta.status);
            return;
        }

        pedidosGlobal = await respuesta.json();

        document.getElementById('contadorPedidos').innerText =
            pedidosGlobal.length;

        renderizarPedidos();

    } catch (error) {

        console.error('Error cargando pedidos:', error);

        document.getElementById('listaPedidos').innerHTML =
            `
            <div class="pedido-card" style="grid-column: 1 / -1;">
                <p style="color: #dc2626; text-align: center; padding: 20px;">
                    Error al cargar los pedidos
                </p>
            </div>
        `;
    }
}

function obtenerClaseEstado(estado) {

    switch (estado) {

        case 'Pendiente':
            return 'estado-pendiente';

        case 'Enviado':
            return 'estado-enviado';

        case 'Entregado':
            return 'estado-entregado';

        case 'Pagado':
            return 'estado-pagado';

        case 'Cancelado':
            return 'estado-cancelado';

        default:
            return 'estado-pendiente';
    }
}

function renderizarPedidos() {

    const div = document.getElementById('listaPedidos');

    const textoBusqueda =
        document.getElementById('buscadorPedidos')?.value?.toLowerCase() || '';

    const pedidosFiltrados = pedidosGlobal.filter(pedido => {

        // Filtro por estado
        if (filtroActivo !== 'todos' && pedido.estado !== filtroActivo) {
            return false;
        }

        // Filtro por texto de busqueda
        return (
            (pedido.cliente || '').toLowerCase().includes(textoBusqueda) ||
            (pedido.telefono || '').toLowerCase().includes(textoBusqueda) ||
            (pedido.estado || '').toLowerCase().includes(textoBusqueda)
        );
    });

    if (pedidosFiltrados.length === 0) {

        div.innerHTML =
            `
            <div class="pedido-card" style="grid-column: 1 / -1;">
                <p style="text-align: center; padding: 20px; color: #6b7280; font-size: 18px;">
                    No hay pedidos registrados.
                </p>
            </div>
        `;

        return;
    }

    const inicio = (paginaActual - 1) * pedidosPorPagina;
    const fin = inicio + pedidosPorPagina;

    const pedidosPagina =
        pedidosFiltrados.slice(inicio, fin);

    div.innerHTML = '';

    pedidosPagina.forEach(pedido => {

        const items = pedido.items || [];
        const notas = pedido.notas || '';
        const estaFinal = pedido.estado === 'Entregado' || pedido.estado === 'Cancelado';

        // Generar HTML de productos
        let productosHtml = '';
        if (items.length > 0) {
            productosHtml = items.map(item =>
                `<div class="pedido-producto-item-expandido">
                    <span class="prod-nombre">${item.nombre}</span>
                    <span class="prod-cantidad">x${item.cantidad}</span>
                    <span class="prod-precio">$${item.precio}</span>
                </div>`
            ).join('');
        } else {
            productosHtml = `<p style="color: #9ca3af; font-size: 14px;">Sin productos registrados</p>`;
        }

        div.innerHTML += `
        
            <div class="pedido-card">

                <div class="pedido-header">

                    <div>

                        <div class="pedido-cliente">
                            Pedido #${pedido.id}
                        </div>

                        <p style="color: #9ca3af; font-size: 14px; margin-top: 4px;">
                            ${pedido.fecha || 'Sin fecha'}
                        </p>

                    </div>

                    <span class="estado-badge ${obtenerClaseEstado(pedido.estado)}">
                        ${pedido.estado}
                    </span>

                </div>

                <div class="pedido-detalles">

                    <div class="pedido-detalle">
                        <strong>Cliente:</strong> ${pedido.cliente || 'Sin nombre'}
                    </div>

                    <div class="pedido-detalle">
                        <strong>Telefono:</strong> ${pedido.telefono || 'Sin telefono'}
                    </div>

                    <div class="pedido-detalle">
                        <strong>Total:</strong> $${pedido.total || 0}
                    </div>

                    <div class="pedido-detalle">
                        <strong>Metodo de entrega:</strong> ${pedido.metodo_entrega === 'retiro_local' ? 'Retiro en local' : 'Coordinar con el vendedor'}
                    </div>

                </div>

                <!-- BOTON TOGGLE DETALLE -->
                <button class="pedido-toggle" data-pedido-id="${pedido.id}" onclick="toggleDetalle(this)">
                    <span>Ver detalle del pedido</span>
                    <span class="toggle-icon">&#9660;</span>
                </button>

                <!-- SECCION EXPANDIBLE -->
                <div class="pedido-expandible" data-pedido-id="${pedido.id}">
                    <div class="pedido-expandible-inner">

                        <h4>🛍️ Productos</h4>
                        <div class="pedido-productos-lista">
                            ${productosHtml}
                        </div>

                        <h4>📝 Notas</h4>
                        <div class="pedido-notas">
                            <textarea
                                id="notas-${pedido.id}"
                                ${estaFinal ? 'disabled' : ''}
                                placeholder="Agregar notas sobre el pedido..."
                            >${notas}</textarea>
                            ${!estaFinal ? `
                            <div class="pedido-notas-acciones">
                                <button class="btn-notas primary" onclick="guardarNotas(${pedido.id})">
                                    Guardar notas
                                </button>
                            </div>
                            ` : ''}
                        </div>

                        <!-- BOTON WHATSAPP -->
                        <button class="btn-whatsapp" onclick="abrirWhatsApp(${pedido.id})">
                            📱 Responder por WhatsApp
                        </button>

                    </div>
                </div>

                ${!estaFinal ? `
                <div class="pedido-acciones">

                    <button
                        onclick="cambiarEstado(${pedido.id}, 'Entregado')"
                        class="primary-btn" style="background: #16a34a;">
                        ✓ Entregado
                    </button>

                    <button
                        onclick="cambiarEstado(${pedido.id}, 'Cancelado')"
                        class="primary-btn" style="background: #dc2626;">
                        ✕ Cancelar
                    </button>

                </div>
                ` : ''}

            </div>

        `;
    });

    const totalPaginas =
        Math.ceil(pedidosFiltrados.length / pedidosPorPagina);

    document.getElementById('paginaActual').innerText =
        `Pagina ${paginaActual} de ${totalPaginas}`;

    document.getElementById('btnAnterior').disabled =
        paginaActual === 1;

    document.getElementById('btnSiguiente').disabled =
        paginaActual === totalPaginas;
}

function aplicarFiltro(estado) {

    filtroActivo = estado;
    paginaActual = 1;

    // Actualizar clase active en botones
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filtro === estado);
    });

    renderizarPedidos();
}

/* ===== Toggle detalle del pedido (acordeon) ===== */
function toggleDetalle(btn) {
    const pedidoId = btn.dataset.pedidoId;
    const expandible = document.querySelector(`.pedido-expandible[data-pedido-id="${pedidoId}"]`);

    if (!expandible) return;

    const isOpen = expandible.classList.contains('open');

    // Cerrar todos los demas
    document.querySelectorAll('.pedido-expandible.open').forEach(el => {
        if (el.dataset.pedidoId !== pedidoId) {
            el.classList.remove('open');
            const toggleBtn = document.querySelector(`.pedido-toggle[data-pedido-id="${el.dataset.pedidoId}"]`);
            if (toggleBtn) toggleBtn.classList.remove('open');
        }
    });

    // Toggle este
    expandible.classList.toggle('open');
    btn.classList.toggle('open');

    // Actualizar texto del boton
    const spanTexto = btn.querySelector('span:first-child');
    if (spanTexto) {
        spanTexto.textContent = isOpen ? 'Ver detalle del pedido' : 'Ocultar detalle';
    }
}

/* ===== Abrir WhatsApp con datos del pedido ===== */
function abrirWhatsApp(pedidoId) {
    const pedido = pedidosGlobal.find(p => p.id === pedidoId);
    if (!pedido) return;

    const telefono = (pedido.telefono || '').trim();
    if (!telefono) {
        mostrarToast('El pedido no tiene numero de telefono', 'error');
        return;
    }

    const cliente = pedido.cliente || 'Cliente';
    const numPedido = pedido.id;

    // Leer la nota directamente del textarea (toma el valor actual, incluso sin guardar)
    const textarea = document.getElementById(`notas-${pedidoId}`);
    const notas = textarea ? textarea.value.trim() : (pedido.notas || '');

    // Armar mensaje: saludo + nota
    let mensaje = `Hola ${cliente}, gracias por tu pedido #${numPedido}.`;

    if (notas) {
        mensaje += `\n\n${notas}`;
    }

    // Abrir WhatsApp Web (o app en mobile)
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

/* ===== Guardar notas ===== */
async function guardarNotas(pedidoId) {
    const textarea = document.getElementById(`notas-${pedidoId}`);
    if (!textarea) return;

    const notas = textarea.value;

    try {
        const respuesta = await fetch(`/pedidos/${pedidoId}/notas`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notas })
        });

        if (!respuesta.ok) {
            const data = await respuesta.json();
            mostrarToast(data.error || 'Error al guardar notas', 'error');
            return;
        }

        mostrarToast('Notas guardadas', 'exito');

        // Actualizar en memoria
        const pedido = pedidosGlobal.find(p => p.id === pedidoId);
        if (pedido) {
            pedido.notas = notas;
        }

    } catch (error) {
        console.error('Error al guardar notas:', error);
        mostrarToast('Error al guardar notas', 'error');
    }
}

async function cambiarEstado(id, estado) {

    const mensajes = {
        'Entregado': 'Marcar este pedido como ENTREGADO? Se descontara el stock.',
        'Cancelado': 'CANCELAR este pedido?'
    };

    mostrarConfirm(mensajes[estado] || 'Cambiar estado?', async () => {

        try {

            const respuesta = await fetch(`/pedidos/${id}`, {

                method: 'PUT',

                credentials: 'same-origin',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({ estado })
            });

            if (!respuesta.ok) {
                const data = await respuesta.json();
                mostrarToast(data.error || 'Error al actualizar', 'error');
                return;
            }

            mostrarToast('Estado actualizado', 'exito');
            cargarPedidos();

        } catch (error) {

            console.error('Error al cambiar estado:', error);

            mostrarToast('Error al actualizar el estado', 'error');
        }
    });
}

function eliminarPedido(id) {

    mostrarConfirm('Eliminar este pedido definitivamente?', async () => {

        try {

            await fetch(`/pedidos/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            mostrarToast('Pedido eliminado', 'exito');
            cargarPedidos();

        } catch (error) {

            console.error('Error al eliminar pedido:', error);

            mostrarToast('Error al eliminar el pedido', 'error');
        }
    });
}

// BUSCADOR
document.addEventListener('input', (e) => {

    if (e.target.id === 'buscadorPedidos') {

        paginaActual = 1;

        renderizarPedidos();
    }
});

// FILTROS RAPIDOS
document.addEventListener('click', (e) => {

    const btn = e.target.closest('.filtro-btn');

    if (btn) {
        aplicarFiltro(btn.dataset.filtro);
    }
});

// PAGINADO
document.getElementById('btnAnterior')
    ?.addEventListener('click', () => {

        if (paginaActual > 1) {

            paginaActual--;

            renderizarPedidos();
        }
    });

    document.getElementById('btnSiguiente')
    ?.addEventListener('click', () => {

        const totalPaginas =
            Math.ceil(pedidosGlobal.length / pedidosPorPagina);

        if (paginaActual < totalPaginas) {

            paginaActual++;

            renderizarPedidos();
        }
    });

// CARGA INICIAL
cargarPedidos();

// Refresco automático para reflejar cambios de webhook sin recargar manualmente
setInterval(() => {
    cargarPedidos();
}, 15000);
