let productosGlobal = [];



let carrito = JSON.parse(

    localStorage.getItem('carrito')

) || [];



function actualizarContador() {

    let total = 0;



    carrito.forEach(producto => {

        total += producto.cantidad;

    });



    document.getElementById(

        'contadorCarrito'

    ).textContent = total;

}



async function cargarProductos() {

    const respuesta =

        await fetch('/productos');



    const productos =

        await respuesta.json();



    productosGlobal = productos;



    renderizarProductos(productos);



    actualizarContador();

}



function renderizarProductos(productos) {

    const contenedor =

        document.getElementById('productos');



    contenedor.innerHTML = '';



    productos.forEach(producto => {

        contenedor.innerHTML += `

            <div class="producto">

                <img src="${producto.imagen}">



                <div class="producto-info">

                    <h3>

                        ${producto.nombre}

                    </h3>



                    <p>

                        ${producto.descripcion}

                    </p>



                    <div class="precio">

                        $ ${producto.precio}

                    </div>



                    <div class="stock">

                        Stock:

                        ${producto.stock}

                    </div>



                   
                    ${
                        producto.stock > 0
                    
                        ?
                    
                        `
                    
                        <button onclick="agregarCarrito(${producto.id})">
                    
                            Agregar al carrito
                    
                        </button>
                    
                        `
                    
                        :
                    
                        `
                    
                        <button disabled>
                    
                            Sin stock
                    
                        </button>
                    
                        `
                    }
                </div>

            </div>

        `;

    });

}


function agregarCarrito(id) {

    const producto =

        productosGlobal.find(

            p => p.id === id

        );



    if (producto.stock <= 0) {

        alert('Producto sin stock');

        return;

    }



    const existente =

        carrito.find(

            p => p.id === id

        );



    if (existente) {

        if (

            existente.cantidad >= producto.stock

        ) {

            alert('Stock máximo alcanzado');

            return;

        }



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



    actualizarContador();



    alert('Producto agregado');

}


function filtrarCategoria(id) {

    if (id === 0) {

        renderizarProductos(productosGlobal);

        return;

    }



    const filtrados =

        productosGlobal.filter(

            p => p.categoria_id == id

        );



    renderizarProductos(filtrados);

}



function buscarProductos() {

    const texto =

        document.getElementById('busqueda')

        .value

        .toLowerCase();



    const filtrados =

        productosGlobal.filter(producto =>

            producto.nombre

                .toLowerCase()

                .includes(texto)

        );



    renderizarProductos(filtrados);

}



cargarProductos();