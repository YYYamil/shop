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

    // Indicadores (sin botones de navegación)
    if (imagenes.length > 1) {
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


// Intervalos de auto-play por carrusel
const carruselIntervalos = new Map();

function iniciarAutoPlay(carrusel) {
    const idCarrusel = carrusel.dataset.carruselId || Math.random().toString(36).substr(2, 9);
    carrusel.dataset.carruselId = idCarrusel;

    // Limpiar intervalo existente
    if (carruselIntervalos.has(idCarrusel)) {
        clearInterval(carruselIntervalos.get(idCarrusel));
    }

    // Solo auto-play si hay más de 1 slide
    const slides = carrusel.querySelectorAll('.carrusel-slide');
    if (slides.length <= 1) return;

    const intervalo = setInterval(() => {
        const dots = carrusel.querySelectorAll('.carrusel-dot');
        let currentIndex = 0;
        dots.forEach((d, i) => {
            if (d.classList.contains('active')) currentIndex = i;
        });
        const nextIndex = (currentIndex + 1) % dots.length;
        if (dots[nextIndex]) {
            dots[nextIndex].click();
        }
    }, 4000); // Cambia cada 4 segundos

    carruselIntervalos.set(idCarrusel, intervalo);
}

function detenerAutoPlay(carrusel) {
    const idCarrusel = carrusel.dataset.carruselId;
    if (idCarrusel && carruselIntervalos.has(idCarrusel)) {
        clearInterval(carruselIntervalos.get(idCarrusel));
        carruselIntervalos.delete(idCarrusel);
    }
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

    // Reiniciar auto-play al navegar manualmente
    iniciarAutoPlay(carrusel);
}



function carruselIrA(dot, index) {
    const carrusel = dot.closest('.carrusel');
    const slides = carrusel.querySelectorAll('.carrusel-slide');
    const dots = carrusel.querySelectorAll('.carrusel-dot');

    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');

    // Reiniciar auto-play al navegar manualmente
    iniciarAutoPlay(carrusel);
}



function renderizarProductos(productos) {

    const contenedor =

        document.getElementById('productos');



    contenedor.innerHTML = '';



    productos.forEach(producto => {

        contenedor.innerHTML += `

            <div class="producto">

                ${renderizarCarrusel(producto.imagenes)}

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

    // Iniciar auto-play en todos los carruseles
    document.querySelectorAll('.carrusel').forEach(carrusel => {
        iniciarAutoPlay(carrusel);
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