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

    // CHART STOCK
    new Chart(

        document.getElementById(
            'stockChart'
        ),

        {
            type: 'doughnut',

            data: {

                labels: [
                    'Con stock',
                    'Sin stock'
                ],

                datasets: [{

                    data: [
                        productos.length - sinStock.length,
                        sinStock.length
                    ]
                }]
            },

            options: {

                responsive: true
            }
        }
    );
}

cargarDashboard();