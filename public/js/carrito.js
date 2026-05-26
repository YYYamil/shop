let carrito = JSON.parse(

    localStorage.getItem('carrito')

) || [];



function guardarCarrito() {

    localStorage.setItem(

        'carrito',

        JSON.stringify(carrito)

    );

}



function obtenerImagen(producto) {

    // Si tiene el array imagenes, tomar la primera

    if (producto.imagenes && producto.imagenes.length > 0) {

        return producto.imagenes[0];

    }

    // Si tiene imagen singular

    if (producto.imagen) {

        return producto.imagen;

    }

    // Placeholder

    return '';

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

    actualizarContadorGlobal();

}



function actualizarContadorGlobal() {

    // Actualizar el contador en la navbar si existe en esta página

    const contador = document.getElementById('contadorCarrito');

    if (contador) {

        let total = 0;

        carrito.forEach(p => { total += p.cantidad; });

        contador.textContent = total;

    }

}



function cargarCarrito() {

    const div =

        document.getElementById('carrito');

    const vacio = document.getElementById('carrito-vacio');

    const contenido = document.getElementById('carrito-contenido');



    if (carrito.length === 0) {

        div.innerHTML = '';

        if (vacio) vacio.style.display = 'block';

        if (contenido) contenido.style.display = 'none';

        return;

    }



    if (vacio) vacio.style.display = 'none';

    if (contenido) contenido.style.display = 'flex';



    div.innerHTML = '';



    let total = 0;

    let cantidadTotal = 0;



    carrito.forEach(producto => {

        const subtotal =

            producto.precio *

            producto.cantidad;



        total += subtotal;

        cantidadTotal += producto.cantidad;



        const imgSrc = obtenerImagen(producto);



        div.innerHTML += `

            <div class="carrito-item">

                <div class="carrito-item-img">

                    ${imgSrc

                        ? `<img src="${imgSrc}" alt="${producto.nombre}">`

                        : `<div class="carrito-item-placeholder">📷</div>`

                    }

                </div>

                <div class="carrito-item-info">

                    <h3>${producto.nombre}</h3>

                    <p class="carrito-item-precio">$ ${producto.precio}</p>

                    <div class="carrito-item-controles">

                        <button onclick="cambiarCantidad(${producto.id},-1)" class="btn-cant">−</button>

                        <span class="cantidad-num">${producto.cantidad}</span>

                        <button onclick="cambiarCantidad(${producto.id},1)" class="btn-cant">+</button>

                    </div>

                </div>

                <div class="carrito-item-subtotal">

                    <p class="subtotal-label">Subtotal</p>

                    <p class="subtotal-valor">$ ${subtotal}</p>

                </div>

                <button onclick="cambiarCantidad(${producto.id},-${producto.cantidad})" class="btn-eliminar" title="Eliminar producto">✕</button>

            </div>

        `;

    });



    document.getElementById(

        'total'

    ).textContent = '$ ' + total;



    const resumenCant = document.getElementById('resumen-cantidad');

    if (resumenCant) resumenCant.textContent = cantidadTotal + ' producto(s)';

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

        alert('Completá tu nombre y teléfono para finalizar');

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

        '🛒 *NUEVO PEDIDO* %0A%0A';



    mensaje +=

        '📋 Pedido: #' +

        data.pedidoId +

        '%0A';

    mensaje +=

        '👤 Cliente: ' +

        cliente +

        '%0A';

    mensaje +=

        '📞 Teléfono: ' +

        telefono +

        '%0A%0A';

    mensaje +=

        '━━━ *PRODUCTOS* ━━━%0A';



    carrito.forEach(producto => {

        const subtotal =

            producto.precio *

            producto.cantidad;

        mensaje +=

            '• ' +

            producto.nombre +

            ' x' +

            producto.cantidad +

            ' = $' +

            subtotal +

            '%0A';

    });



    mensaje +=

        '%0A━━━━━━━━━━━━━%0A';

    mensaje +=

        '*TOTAL: $ ' +

        total +

        '*';



    localStorage.removeItem('carrito');



    window.open(

        `https://wa.me/5493813845360?text=${mensaje}`,

        '_blank'

    );



    window.location = '/';

}



cargarCarrito();
