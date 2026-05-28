async function cargarDashboard() {

    const productosReq =
        await fetch('/productos');

    const productos =
        await productosReq.json();

    const pedidosReq =
        await fetch('/pedidos');

    const pedidos =
        await pedidosReq.json();

    let ventas = 0;

    pedidos.forEach(pedido => {

        ventas += pedido.total;
    });

    const sinStock =
        productos.filter(
            p => p.stock <= 0
        );

    document.getElementById(
        'ventas'
    ).textContent =
        '$ ' + ventas;

    document.getElementById(
        'pedidos'
    ).textContent =
        pedidos.length;

    document.getElementById(
        'productos'
    ).textContent =
        productos.length;

    document.getElementById(
        'sinStock'
    ).textContent =
        sinStock.length;

    // RESUMEN
    document.getElementById(
        'productosResumen'
    ).textContent =
        productos.length;

    document.getElementById(
        'pedidosResumen'
    ).textContent =
        pedidos.length;

    document.getElementById(
        'stockResumen'
    ).textContent =
        sinStock.length;

    // ACTIVIDAD
    const actividad =
        document.getElementById(
            'actividadReciente'
        );

    actividad.innerHTML = '';

    pedidos
        .slice(0, 5)
        .forEach(pedido => {

            actividad.innerHTML += `

                <div class="activity-item">

                    <span>

                        Pedido #${pedido.id}
                        - ${pedido.estado}

                    </span>

                    <small>

                        ${pedido.fecha || ''}

                    </small>

                </div>

            `;
        });

    // CHART GENERAL
    new Chart(

        document.getElementById(
            'resumenChart'
        ),

        {
            type: 'bar',

            data: {

                labels: [
                    'Pedidos',
                    'Productos',
                    'Sin stock'
                ],

                datasets: [{

                    label: 'Cantidad',

                    data: [
                        pedidos.length,
                        productos.length,
                        sinStock.length
                    ],

                    borderWidth: 1
                }]
            },

            options: {

                responsive: true,

                plugins: {

                    legend: {
                        display: false
                    }
                }
            }
        }
    );
}

/* ===== MODAL DE VENTAS ===== */

function abrirModalVentas() {
    const overlay = document.getElementById('modalVentasOverlay');
    const modal = document.getElementById('modalVentas');
    overlay.style.display = 'flex';
    // Animación de entrada
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        modal.classList.add('open');
    });
    cargarDetalleVentas();
    document.body.style.overflow = 'hidden';
}

function cerrarModalVentas(event) {
    // Si hay evento y el click NO fue en el overlay ni en el botón cerrar, ignorar
    if (event) {
        const target = event.target;
        const isOverlay = target === document.getElementById('modalVentasOverlay');
        const isCloseBtn = target.closest('.modal-ventas-cerrar');
        if (!isOverlay && !isCloseBtn) return;
    }
    const overlay = document.getElementById('modalVentasOverlay');
    const modal = document.getElementById('modalVentas');
    overlay.classList.remove('active');
    modal.classList.remove('open');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
}

async function cargarDetalleVentas() {
    try {
        const respuesta = await fetch('/pedidos');
        const pedidos = await respuesta.json();

        // Calcular totales
        let totalVentas = 0;
        pedidos.forEach(p => { totalVentas += p.total; });

        document.getElementById('modalVentasTotal').textContent = '$ ' + totalVentas;
        document.getElementById('modalVentasPedidos').textContent = pedidos.length;

        const promedio = pedidos.length > 0 ? (totalVentas / pedidos.length) : 0;
        document.getElementById('modalVentasPromedio').textContent = '$ ' + promedio.toFixed(2);

        // Agrupar por día
        const ventasPorDia = {};
        pedidos.forEach(p => {
            if (!p.fecha) return;
            // Normalizar fecha (primeros 10 chars: YYYY-MM-DD)
            const dia = p.fecha.substring(0, 10);
            if (!ventasPorDia[dia]) {
                ventasPorDia[dia] = { pedidos: 0, total: 0 };
            }
            ventasPorDia[dia].pedidos++;
            ventasPorDia[dia].total += p.total;
        });

        // Ordenar días descendente
        const dias = Object.keys(ventasPorDia).sort().reverse();

        const lista = document.getElementById('ventasDiariasLista');

        if (dias.length === 0) {
            lista.innerHTML = '<div class="ventas-vacio">No hay ventas registradas</div>';
            return;
        }

        lista.innerHTML = dias.map(dia => {
            const data = ventasPorDia[dia];
            // Formatear fecha para mostrar según el formato recibido
            let fechaMostrar = dia;
            if (dia.includes('-')) {
                // Formato YYYY-MM-DD
                const parts = dia.split('-');
                if (parts.length === 3) {
                    fechaMostrar = parts[2] + '/' + parts[1] + '/' + parts[0];
                }
            }
            // Si ya viene en DD/MM/YYYY o DD/M/YYYY, se muestra tal cual
            return `
                <div class="ventas-dia-row">
                    <span class="ventas-dia-fecha">${fechaMostrar}</span>
                    <span class="ventas-dia-pedidos">${data.pedidos}</span>
                    <span class="ventas-dia-total">$${data.total}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error al cargar detalle de ventas:', error);
        document.getElementById('ventasDiariasLista').innerHTML =
            '<div class="ventas-vacio" style="color:#dc2626;">Error al cargar datos</div>';
    }
}

// Cerrar modal con tecla Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('modalVentasOverlay');
        if (overlay && overlay.style.display === 'flex') {
            cerrarModalVentas();
        }
    }
});

cargarDashboard();