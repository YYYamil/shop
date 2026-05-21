let carrito = JSON.parse(

    localStorage.getItem('carrito')

) || [];



function guardarCarrito() {

    localStorage.setItem(

        'carrito',

        JSON.stringify(carrito)

    );

}



function cambiarCantidad(id, cambio) {

    const producto =

        carrito.find(

            p => p.id === id

        );



    producto.cantidad += cambio;



    if (producto.cantidad <= 0) {

        carrito = carrito.filter(

            p => p.id !== id

        );

    }



    guardarCarrito();

    cargarCarrito();

}



function cargarCarrito() {

    const div =

        document.getElementById('carrito');



    div.innerHTML = '';



    let total = 0;



    carrito.forEach(producto => {

        const subtotal =

            producto.precio *

            producto.cantidad;



        total += subtotal;



        div.innerHTML += `

            <div class="producto">

                <img src="${producto.imagen}">



                <div class="producto-info">

                    <h3>

                        ${producto.nombre}

                    </h3>



                    <p>

                        Cantidad:

                        ${producto.cantidad}

                    </p>



                    <p>

                        Subtotal:

                        $ ${subtotal}

                    </p>



                    <button onclick="cambiarCantidad(${producto.id},1)">

                        +

                    </button>



                    <button onclick="cambiarCantidad(${producto.id},-1)">

                        -

                    </button>

                </div>

            </div>

        `;

    });



    document.getElementById(

        'total'

    ).textContent =

        'Total: $ ' + total;

}



async function finalizarCompra() {

    const cliente =

        document.getElementById('cliente').value;



    const telefono =

        document.getElementById('telefono').value;



    if (

        cliente.trim() === '' ||

        telefono.trim() === ''

    ) {

        alert('Completar datos');

        return;

    }



    let total = 0;



    carrito.forEach(producto => {

        total +=

            producto.precio *

            producto.cantidad;

    });



    const respuesta = await fetch('/pedidos', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify({

            cliente,

            telefono,

            productos: carrito,

            total

        })

    });



    const data = await respuesta.json();



    if (data.error) {

        alert(data.error);

        return;

    }



    let mensaje =

        '🛒 NUEVO PEDIDO %0A%0A';



    mensaje +=

        'Pedido: #' +

        data.pedidoId +

        '%0A';



    mensaje +=

        'Cliente: ' +

        cliente +

        '%0A';



    mensaje +=

        'Telefono: ' +

        telefono +

        '%0A%0A';



    carrito.forEach(producto => {

        mensaje +=

            producto.nombre +

            ' x' +

            producto.cantidad +

            '%0A';

    });



    mensaje +=

        '%0ATOTAL: $ ' +

        total;



    localStorage.removeItem('carrito');



    window.open(

        `https://wa.me/5493764000000?text=${mensaje}`,

        '_blank'

    );



    window.location = '/';

}



cargarCarrito();