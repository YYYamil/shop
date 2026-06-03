async function cargarDashboard() {

    const productosReq =
        await fetch('/productos');

    const productos =
        await productosReq.json();

    const pedidosReq =
        await fetch('/pedidos');

    const pedidos =
        await pedidosReq.json();

    // Solo pedidos ENTREGADOS para métricas de ventas
    const pedidosEntregados = pedidos.filter(p => p.estado === 'Entregado');

    let ventas = 0;

    pedidosEntregados.forEach(pedido => {

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
        pedidosEntregados.length;

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
        pedidosEntregados.length;

    document.getElementById(
        'stockResumen'
    ).textContent =
        sinStock.length;

    // ACTIVIDAD (muestra todos los pedidos, útil para seguimiento)
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

    // CHART: Ventas de la última semana (solo entregados)
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Generar los últimos 7 días (hoy + 6 anteriores)
    const hoy = new Date();
    const ultimos7Dias = [];
    for (let i = 6; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - i);
        ultimos7Dias.push(fecha);
    }

    // Agrupar pedidos ENTREGADOS por día (normalizar a YYYY-MM-DD)
    const ventasPorDia = {};
    pedidosEntregados.forEach(p => {
        if (!p.fecha) return;
        // La fecha viene en formato locale: "DD/MM/YYYY, HH:mm:ss" ej: "28/5/2026, 01:05:41"
        // Extraer solo la parte de la fecha (antes de la coma)
        const comaIdx = p.fecha.indexOf(',');
        const raw = comaIdx !== -1 ? p.fecha.substring(0, comaIdx) : p.fecha.substring(0, 10);
        const parts = raw.split('/'); // ["28", "5", "2026"]
        if (parts.length === 3) {
            const dd = parts[0].padStart(2, '0');
            const mm = parts[1].padStart(2, '0');
            const yyyy = parts[2];
            const dia = `${yyyy}-${mm}-${dd}`; // "2026-05-28"
            if (!ventasPorDia[dia]) {
                ventasPorDia[dia] = 0;
            }
            ventasPorDia[dia]++;
        }
    });

    // Construir labels y datos para los últimos 7 días
    const labels = [];
    const data = [];
    ultimos7Dias.forEach(fecha => {
        const yyyy = fecha.getFullYear();
        const mm = String(fecha.getMonth() + 1).padStart(2, '0');
        const dd = String(fecha.getDate()).padStart(2, '0');
        const clave = `${yyyy}-${mm}-${dd}`;
        const diaSemana = diasSemana[fecha.getDay()];
        labels.push(`${diaSemana} ${dd}/${mm}`);
        data.push(ventasPorDia[clave] || 0);
    });

    new Chart(

        document.getElementById(
            'resumenChart'
        ),

        {
            type: 'bar',

            data: {

                labels: labels,

                datasets: [{

                    label: 'Ventas',

                    data: data,

                    backgroundColor: 'rgba(99, 102, 241, 0.7)',

                    borderColor: 'rgba(99, 102, 241, 1)',

                    borderWidth: 2,

                    borderRadius: 6,

                    barPercentage: 0.6
                }]
            },

            options: {

                responsive: true,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' pedido' + (context.parsed.y !== 1 ? 's' : '');
                            }
                        }
                    }
                },

                scales: {

                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Cantidad de ventas'
                        }
                    },

                    x: {
                        title: {
                            display: true,
                            text: 'Día de la semana'
                        }
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

        // Solo pedidos ENTREGADOS para métricas de ventas
        const entregados = pedidos.filter(p => p.estado === 'Entregado');

        // Calcular totales
        let totalVentas = 0;
        entregados.forEach(p => { totalVentas += p.total; });

        document.getElementById('modalVentasTotal').textContent = '$ ' + totalVentas;
        document.getElementById('modalVentasPedidos').textContent = entregados.length;

        const promedio = entregados.length > 0 ? (totalVentas / entregados.length) : 0;
        document.getElementById('modalVentasPromedio').textContent = '$ ' + promedio.toFixed(2);

        // Agrupar por día (solo entregados)
        const ventasPorDia = {};
        entregados.forEach(p => {
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