let carrito = JSON.parse(
    localStorage.getItem('carrito')
) || [];



function guardarCarrito() {

    localStorage.setItem(
        'carrito',
        JSON.stringify(carrito)
    );

}



function eliminarProducto(id) {

    carrito =
        carrito.filter(p => p.id !== id);

    guardarCarrito();

    cargarCarrito();

}



function cambiarCantidad(id, cambio) {

    const producto =
        carrito.find(p => p.id === id);



    producto.cantidad += cambio;



    if (producto.cantidad <= 0) {

        eliminarProducto(id);

        return;

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
            producto.precio * producto.cantidad;

        total += subtotal;



        div.innerHTML += `

            <div class="producto">

                <h3>${producto.nombre}</h3>

                <p>
                    $ ${producto.precio}
                </p>

                <p>
                    Cantidad:
                    ${producto.cantidad}
                </p>

                <p>
                    Subtotal:
                    $ ${subtotal}
                </p>

                <button onclick="
                    cambiarCantidad(
                        ${producto.id},
                        1
                    )
                ">

                    +

                </button>

                <button onclick="
                    cambiarCantidad(
                        ${producto.id},
                        -1
                    )
                ">

                    -

                </button>

                <button onclick="
                    eliminarProducto(
                        ${producto.id}
                    )
                ">

                    Eliminar

                </button>

            </div>

        `;

    });



    document.getElementById('total')
        .textContent =
        'Total: $' + total;

}



function enviarWhatsapp() {

    let mensaje =
        'Hola quiero comprar:%0A%0A';

    let total = 0;



    carrito.forEach(producto => {

        const subtotal =
            producto.precio * producto.cantidad;



        mensaje +=

            producto.nombre +

            ' x' +

            producto.cantidad +

            ' = $' +

            subtotal +

            '%0A';



        total += subtotal;

    });



    mensaje +=

        '%0ATotal: $' +

        total;



    const telefono =
        '5493764000000';



    const url =
        `https://wa.me/${telefono}?text=${mensaje}`;



    window.open(url, '_blank');

}



cargarCarrito();