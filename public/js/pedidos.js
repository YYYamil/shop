// public/js/pedidos.js

let pedidosGlobal = [];
let paginaActual = 1;
const pedidosPorPagina = 6;
let confirmCallback = null;

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
            window.location.href = '/admin/login.html';
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
                        <strong>Teléfono:</strong> ${pedido.telefono || 'Sin teléfono'}
                    </div>

                    <div class="pedido-detalle">
                        <strong>Total:</strong> $${pedido.total || 0}
                    </div>

                </div>

                <div class="pedido-acciones">

                    <button
                        onclick="cambiarEstado(${pedido.id}, 'Pendiente')"
                        class="primary-btn" style="background: #eab308;">
                        Pendiente
                    </button>

                    <button
                        onclick="cambiarEstado(${pedido.id}, 'Entregado')"
                        class="primary-btn" style="background: #16a34a;">
                        Entregado
                    </button>

                    <button
                        onclick="eliminarPedido(${pedido.id})"
                        class="primary-btn" style="background: #dc2626;">
                        Eliminar
                    </button>

                </div>

            </div>

        `;
    });

    const totalPaginas =
        Math.ceil(pedidosFiltrados.length / pedidosPorPagina);

    document.getElementById('paginaActual').innerText =
        `Página ${paginaActual} de ${totalPaginas}`;

    document.getElementById('btnAnterior').disabled =
        paginaActual === 1;

    document.getElementById('btnSiguiente').disabled =
        paginaActual === totalPaginas;
}

async function cambiarEstado(id, estado) {

    try {

        await fetch(`/pedidos/${id}`, {

            method: 'PUT',

            credentials: 'same-origin',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({ estado })
        });

        mostrarToast('Estado actualizado', 'exito');
        cargarPedidos();

    } catch (error) {

        console.error('Error al cambiar estado:', error);

        mostrarToast('Error al actualizar el estado', 'error');
    }
}

function eliminarPedido(id) {

    mostrarConfirm('¿Eliminar este pedido definitivamente?', async () => {

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
