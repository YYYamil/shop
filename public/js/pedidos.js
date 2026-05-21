// public/js/pedidos.js

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

        const pedidos = await respuesta.json();

        const div = document.getElementById('listaPedidos');
        div.innerHTML = '';

        if (pedidos.length === 0) {
            div.innerHTML = '<p style="color:#666; padding:20px;">No hay pedidos registrados aún.</p>';
            return;
        }

        pedidos.forEach(pedido => {
            div.innerHTML += `
                <div class="producto">
                    <div class="producto-info">
                        <h2>Pedido #${pedido.id}</h2>
                        
                        <p><strong>Cliente:</strong> ${pedido.cliente || 'Sin nombre'}</p>
                        <p><strong>Teléfono:</strong> ${pedido.telefono || 'Sin teléfono'}</p>
                        <p><strong>Total:</strong> $${pedido.total || 0}</p>
                        <p><strong>Estado:</strong> <span style="font-weight:bold">${pedido.estado}</span></p>
                        <p><strong>Fecha:</strong> ${pedido.fecha || 'Sin fecha'}</p>

                        <div style="margin-top:10px;">
                            <button onclick="cambiarEstado(${pedido.id}, 'Pendiente')">Pendiente</button>
                            <button onclick="cambiarEstado(${pedido.id}, 'Enviado')">Enviado</button>
                            <button onclick="cambiarEstado(${pedido.id}, 'Entregado')">Entregado</button>
                        </div>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error('Error cargando pedidos:', error);
        document.getElementById('listaPedidos').innerHTML = 
            '<p style="color:red;">Error al cargar los pedidos</p>';
    }
}

async function cambiarEstado(id, estado) {
    try {
        await fetch(`/pedidos/${id}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });

        cargarPedidos(); // recargar lista
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        alert('Error al actualizar el estado');
    }
}

// Cargar al iniciar
cargarPedidos();