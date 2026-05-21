let productosGlobal = [];



async function cargarCategorias() {

    const respuesta =

        await fetch('/categorias');



    const categorias =

        await respuesta.json();



    const select =

        document.getElementById('categoria_id');



    select.innerHTML = '';



    categorias.forEach(categoria => {

        select.innerHTML += `

            <option value="${categoria.id}">

                ${categoria.nombre}

            </option>

        `;

    });

}



async function guardarProducto() {

    const nombre =

        document.getElementById('nombre').value;



    if (nombre.trim() === '') {

        alert('Nombre requerido');

        return;

    }



    const id =

        document.getElementById('idProducto').value;



    const formData = new FormData();



    formData.append(

        'nombre',

        nombre

    );



    formData.append(

        'precio',

        document.getElementById('precio').value

    );



    formData.append(

        'stock',

        document.getElementById('stock').value

    );



    formData.append(

        'descripcion',

        document.getElementById('descripcion').value

    );



    formData.append(

        'categoria_id',

        document.getElementById('categoria_id').value

    );



    formData.append(

        'imagenActual',

        document.getElementById('imagenActual').value

    );



    const imagen =

        document.getElementById('imagen').files[0];



    if (imagen) {

        formData.append(

            'imagen',

            imagen

        );

    }



    if (id === '') {

        await fetch('/productos', {

            method: 'POST',

            body: formData

        });

    }

    else {

        await fetch('/productos/' + id, {

            method: 'PUT',

            body: formData

        });

    }



    limpiarFormulario();

    cargarProductos();

}



async function crearCategoria() {

    const nombre = prompt(

        'Nombre categoria'

    );



    if (!nombre) return;



    await fetch('/categorias', {

        method: 'POST',

        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify({

            nombre

        })

    });



    cargarCategorias();

}



function editarProducto(id) {

    const producto =

        productosGlobal.find(

            p => p.id === id

        );



    document.getElementById('idProducto').value =

        producto.id;



    document.getElementById('nombre').value =

        producto.nombre;



    document.getElementById('precio').value =

        producto.precio;



    document.getElementById('stock').value =

        producto.stock;



    document.getElementById('descripcion').value =

        producto.descripcion;



    document.getElementById('categoria_id').value =

        producto.categoria_id;



    document.getElementById('imagenActual').value =

        producto.imagen;

}



async function eliminarProducto(id) {

    const confirmar = confirm(

        'Eliminar producto?'

    );



    if (!confirmar) return;



    await fetch('/productos/' + id, {

        method: 'DELETE'

    });



    cargarProductos();

}



function limpiarFormulario() {

    document.getElementById('idProducto').value = '';

    document.getElementById('nombre').value = '';

    document.getElementById('precio').value = '';

    document.getElementById('stock').value = '';

    document.getElementById('descripcion').value = '';

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

                <img src="${producto.imagen}">



                <div class="producto-info">

                    <h3>

                        ${producto.nombre}

                    </h3>



                    <p>

                        ${producto.descripcion}

                    </p>



                    <p>

                        Categoria:

                        ${producto.categoria}

                    </p>



                    <p>

                        Stock:

                        ${producto.stock}

                    </p>



                    <button onclick="editarProducto(${producto.id})">

                        Editar

                    </button>



                    <button onclick="eliminarProducto(${producto.id})">

                        Eliminar

                    </button>

                </div>

            </div>

        `;

    });

}



cargarCategorias();

cargarProductos();