let productosGlobal = [];



async function guardarProducto() {

    const id =
        document.getElementById('idProducto').value;

    const nombre =
        document.getElementById('nombre').value;

    const precio =
        document.getElementById('precio').value;

    const stock =
        document.getElementById('stock').value;

    const imagen =
        document.getElementById('imagen').value;

    const descripcion =
        document.getElementById('descripcion').value;



    const producto = {

        nombre,
        precio,
        stock,
        imagen,
        descripcion

    };



    if (id === '') {

        await fetch('/productos', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(producto)

        });

    }

    else {

        await fetch('/productos/' + id, {

            method: 'PUT',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(producto)

        });

    }



    limpiarFormulario();

    cargarProductos();

}



function editarProducto(id) {

    const producto =
        productosGlobal.find(p => p.id === id);



    document.getElementById('idProducto').value =
        producto.id;

    document.getElementById('nombre').value =
        producto.nombre;

    document.getElementById('precio').value =
        producto.precio;

    document.getElementById('stock').value =
        producto.stock;

    document.getElementById('imagen').value =
        producto.imagen;

    document.getElementById('descripcion').value =
        producto.descripcion;

}



function limpiarFormulario() {

    document.getElementById('idProducto').value = '';

    document.getElementById('nombre').value = '';

    document.getElementById('precio').value = '';

    document.getElementById('stock').value = '';

    document.getElementById('imagen').value = '';

    document.getElementById('descripcion').value = '';

}



async function eliminarProducto(id) {

    await fetch('/productos/' + id, {

        method: 'DELETE'

    });

    cargarProductos();

}



async function cargarProductos() {

    const respuesta =
        await fetch('/productos');

    const productos =
        await respuesta.json();



    productosGlobal = productos;



    const div =
        document.getElementById('listaProductos');



    div.innerHTML = '';



    productos.forEach(producto => {

        div.innerHTML += `

            <div class="producto">

                <img
                    src="${producto.imagen}"
                    width="120"
                >

                <h3>${producto.nombre}</h3>

                <p>${producto.descripcion}</p>

                <p>$ ${producto.precio}</p>

                <p>Stock: ${producto.stock}</p>

                <button onclick="editarProducto(${producto.id})">

                    Editar

                </button>

                <button onclick="eliminarProducto(${producto.id})">

                    Eliminar

                </button>

            </div>

        `;

    });

}



cargarProductos();