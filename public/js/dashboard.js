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

}



cargarDashboard();