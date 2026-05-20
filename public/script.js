let carrito = JSON.parse(
    localStorage.getItem('carrito')
) || [];

let productosGlobal = [];



async function cargarProductos() {

    const respuesta =
        await fetch('/productos');

    const productos =
        await respuesta.json();



    productosGlobal = productos;



    const contenedor =
        document.getElementById('productos');



    contenedor.innerHTML = '';



    productos.forEach(producto => {

        contenedor.innerHTML += `

            <div class="producto">

                <img
                    src="${producto.imagen}"
                    width="150"
                >

                <h3>${producto.nombre}</h3>

                <p>${producto.descripcion}</p>

                <p>$ ${producto.precio}</p>

                <p>Stock: ${producto.stock}</p>

                <button onclick="agregarCarrito(${producto.id})">

                    Agregar

                </button>

            </div>

        `;

    });

}



function agregarCarrito(id) {

    const producto =
        productosGlobal.find(p => p.id === id);



    const existente =
        carrito.find(p => p.id === id);



    if (existente) {

        existente.cantidad++;

    }

    else {

        producto.cantidad = 1;

        carrito.push(producto);

    }



    localStorage.setItem(
        'carrito',
        JSON.stringify(carrito)
    );



    alert('Producto agregado');

}



cargarProductos();