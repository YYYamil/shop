/* ===== Toast ===== */
function mostrarToast(mensaje) {
    const existente = document.querySelector('.toast');
    if (existente) existente.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('oculto');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

/* ===== Cargar configuración al iniciar ===== */

document.addEventListener("DOMContentLoaded", function() {

    if (typeof cargarConfiguracion === "function") {

        cargarConfiguracion();

    }

});



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

        actualizarContadorGlobal();

        return;

    }



    if (vacio) vacio.style.display = 'none';

    if (contenido) contenido.style.display = 'flex';



    div.innerHTML = '';



    let total = 0;

    let cantidadTotal = 0;



    carrito.forEach(producto => {

        // Usar precioConDescuento si existe, sino el precio original (redondeado a 2 decimales)
        const precioUnitario = producto.precioConDescuento != null ? producto.precioConDescuento : producto.precio;

        const subtotal =

            Math.round(precioUnitario * producto.cantidad * 100) / 100;



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

                    <p class="carrito-item-precio">$ ${precioUnitario}</p>

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



    actualizarContadorGlobal();

}



/* ===== Control de campos de teléfono (solo dígitos) ===== */
document.addEventListener('input', function(e) {
    if (e.target.id === 'tel-codigo' || e.target.id === 'tel-numero') {
        e.target.value = e.target.value.replace(/\D/g, '');
        if (e.target.id === 'tel-codigo' && e.target.value.length > 4) {
            e.target.value = e.target.value.substring(0, 4);
        }
        if (e.target.id === 'tel-numero' && e.target.value.length > 9) {
            e.target.value = e.target.value.substring(0, 9);
        }
    }
});

async function finalizarCompra() {

    const cliente =

        document.getElementById('cliente').value;

    const codigo =

        document.getElementById('tel-codigo').value.replace(/\D/g, '');

    const numero =

        document.getElementById('tel-numero').value.replace(/\D/g, '');

    // Prefijo 549 (Argentina) + codigo de area + numero
    const telefono = '549' + codigo + numero;



    if (

        cliente.trim() === '' ||

        telefono.trim() === '' ||
        codigo.length < 3 ||
        numero.length < 5

    ) {

        mostrarToast('Completá tu nombre y un teléfono válido (código + número)');

        return;

    }



    let total = 0;

    let mensaje =

        '¡Hola! Quiero hacer un pedido:%0A%0A';

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

        const precioUnitario = producto.precioConDescuento != null ? producto.precioConDescuento : producto.precio;
        const subtotal = Math.round(precioUnitario * producto.cantidad * 100) / 100;

        total += subtotal;

        mensaje += '• ' + producto.nombre + ' x' + producto.cantidad + ' = $' + subtotal + '%0A';

    });

    mensaje += '%0A━━━━━━━━━━━━━%0A';

    mensaje += '*TOTAL: $ ' + total + '*';



    // Enviar pedido al servidor (no crítico para el mensaje)
    try {
        const slug = window.obtenerSlug ? obtenerSlug() : null;
        const url = slug ? '/pedidos?slug=' + slug : '/pedidos';
        await fetch(url, {
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
    } catch (e) {
        console.error('Error al enviar pedido al servidor:', e);
    }



    // Usar número de WhatsApp desde la configuración
    const wpNumero = window.__whatsappNumero;

    if (wpNumero) {
        window.open(
            `https://wa.me/${wpNumero}?text=${mensaje}`,
            '_blank'
        );
    } else {
        mostrarToast('No hay número de WhatsApp configurado para recibir pedidos');
    }

    localStorage.removeItem('carrito');

    window.location = '/';



}

cargarCarrito();
