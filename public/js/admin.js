let productosGlobal = [];
let paginaActual = 1;
const productosPorPagina = 6;



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

        'imagenesActual',

        document.getElementById('imagenesActual').value

    );



    // Agregar hasta 4 imágenes
    for (let i = 0; i < 4; i++) {
        const fileInput = document.getElementById('imagen' + i);
        if (fileInput && fileInput.files[0]) {
            formData.append('imagenes', fileInput.files[0]);
        }
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



    document.getElementById('imagenesActual').value =

        JSON.stringify(producto.imagenes || []);

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

    document.getElementById('imagenesActual').value = '';

    // Limpiar inputs file
    for (let i = 0; i < 4; i++) {
        const input = document.getElementById('imagen' + i);
        if (input) input.value = '';
    }

}



function renderizarCarrusel(imagenes) {
    if (!imagenes || imagenes.length === 0) {
        return '<div class="carrusel-placeholder">Sin imagen</div>';
    }

    let html = '<div class="carrusel">';
    html += '<div class="carrusel-track">';

    imagenes.forEach((img, index) => {
        const active = index === 0 ? 'active' : '';
        html += `<div class="carrusel-slide ${active}"><img src="${img}"></div>`;
    });

    html += '</div>';

    // Flechas de navegación solo si hay más de 1 imagen
    if (imagenes.length > 1) {
        html += '<button class="carrusel-prev" onclick="carruselNavegar(this, -1)">&#10094;</button>';
        html += '<button class="carrusel-next" onclick="carruselNavegar(this, 1)">&#10095;</button>';

        // Indicadores
        html += '<div class="carrusel-indicadores">';
        imagenes.forEach((_, index) => {
            const active = index === 0 ? 'active' : '';
            html += `<span class="carrusel-dot ${active}" onclick="carruselIrA(this, ${index})"></span>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}



function carruselNavegar(btn, direccion) {
    const carrusel = btn.closest('.carrusel');
    const slides = carrusel.querySelectorAll('.carrusel-slide');
    const dots = carrusel.querySelectorAll('.carrusel-dot');
    let currentIndex = 0;

    slides.forEach((s, i) => {
        if (s.classList.contains('active')) currentIndex = i;
    });

    slides[currentIndex].classList.remove('active');
    if (dots[currentIndex]) dots[currentIndex].classList.remove('active');

    let newIndex = currentIndex + direccion;
    if (newIndex < 0) newIndex = slides.length - 1;
    if (newIndex >= slides.length) newIndex = 0;

    slides[newIndex].classList.add('active');
    if (dots[newIndex]) dots[newIndex].classList.add('active');
}



function carruselIrA(dot, index) {
    const carrusel = dot.closest('.carrusel');
    const slides = carrusel.querySelectorAll('.carrusel-slide');
    const dots = carrusel.querySelectorAll('.carrusel-dot');

    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');
}



// async function cargarProductos() {

//     const respuesta =

//         await fetch('/productos');



//     const productos =

//         await respuesta.json();



//     productosGlobal = productos;



//     const div =

//         document.getElementById('listaProductos');



//     div.innerHTML = '';



//     productos.forEach(producto => {

//         div.innerHTML += `

//             <div class="producto">

//                 ${renderizarCarrusel(producto.imagenes)}

//                 <div class="producto-info">

//                     <h3>

//                         ${producto.nombre}

//                     </h3>



//                     <p>

//                         ${producto.descripcion}

//                     </p>



//                     <p>

//                         Categoria:

//                         ${producto.categoria}

//                     </p>



//                     <p>

//                         Stock:

//                         ${producto.stock}

//                     </p>



//                     <button onclick="editarProducto(${producto.id})">

//                         Editar

//                     </button>



//                     <button onclick="eliminarProducto(${producto.id})">

//                         Eliminar

//                     </button>

//                 </div>

//             </div>

//         `;

//     });

// }

async function cargarProductos() {

    const respuesta =
        await fetch('/productos');

    const productos =
        await respuesta.json();

    productosGlobal = productos;

    document.getElementById('contadorProductos').innerText =
        productos.length;

    renderizarProductos();
}

function renderizarProductos() {

    const div =
        document.getElementById('listaProductos');

    const textoBusqueda =
        document.getElementById('buscadorProductos')
        ?.value
        ?.toLowerCase() || '';

    const productosFiltrados =
        productosGlobal.filter(producto => {

            return (
                producto.nombre.toLowerCase().includes(textoBusqueda)
                ||
                producto.categoria.toLowerCase().includes(textoBusqueda)
            );
        });

    const inicio =
        (paginaActual - 1) * productosPorPagina;

    const fin =
        inicio + productosPorPagina;

    const productosPagina =
        productosFiltrados.slice(inicio, fin);

    div.innerHTML = '';

    productosPagina.forEach(producto => {

        div.innerHTML += `

            <div class="producto">

                ${renderizarCarrusel(producto.imagenes)}

                <div class="producto-info">

                    <h3>

                        ${producto.nombre}

                    </h3>

                    <p>

                        ${producto.descripcion}

                    </p>

                    <p>

                        <strong>Categoría:</strong>

                        ${producto.categoria}

                    </p>

                    <p>

                        <strong>Stock:</strong>

                        ${producto.stock}

                    </p>

                    <div>

                        <button onclick="editarProducto(${producto.id})">

                            Editar

                        </button>

                        <button onclick="eliminarProducto(${producto.id})">

                            Eliminar

                        </button>

                    </div>

                </div>

            </div>

        `;
    });

    const totalPaginas =
        Math.ceil(productosFiltrados.length / productosPorPagina);

    document.getElementById('paginaActual').innerText =
        `Página ${paginaActual} de ${totalPaginas}`;
}



cargarCategorias();

cargarProductos();

document.addEventListener('input', (e) => {

    if (e.target.id === 'buscadorProductos') {

        paginaActual = 1;

        renderizarProductos();
    }
});

document.getElementById('btnAnterior')
?.addEventListener('click', () => {

    if (paginaActual > 1) {

        paginaActual--;

        renderizarProductos();
    }
});

document.getElementById('btnSiguiente')
?.addEventListener('click', () => {

    const totalPaginas =
        Math.ceil(productosGlobal.length / productosPorPagina);

    if (paginaActual < totalPaginas) {

        paginaActual++;

        renderizarProductos();
    }
});