let productosGlobal = [];



let carrito = JSON.parse(

    localStorage.getItem('carrito')

) || [];



let timeoutBusqueda = null;



function actualizarContador() {

    let total = 0;



    carrito.forEach(producto => {

        total += producto.cantidad;

    });



    document.getElementById(

        'contadorCarrito'

    ).textContent = total;

}



/* ===== SKELETON ===== */

function mostrarSkeleton() {

    const contenedor =

        document.getElementById('productos');

    let html = '';

    for (let i = 0; i < 6; i++) {

        html += `

            <div class="skeleton-card">

                <div class="skeleton-img"></div>

                <div class="skeleton-line short"></div>

                <div class="skeleton-line medium"></div>

                <div class="skeleton-line"></div>

                <div class="skeleton-btn"></div>

            </div>

        `;

    }

    contenedor.innerHTML = html;

}

function ocultarSkeleton() {

    // No hace falta, renderizarProductos pisa el contenido

}



/* ===== TOAST ===== */

function mostrarToast(mensaje) {

    // Eliminar toast existente

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



/* ===== MODAL ===== */

function abrirModal(src) {

    const overlay = document.getElementById('modalOverlay');

    const img = document.getElementById('modalImagen');

    img.src = src;

    overlay.classList.add('active');

}

function cerrarModal() {

    const overlay = document.getElementById('modalOverlay');

    overlay.classList.remove('active');

}



/* ===== MENÚ HAMBURGUESA ===== */

function toggleMenu() {

    const menu = document.getElementById('navMenu');

    menu.classList.toggle('active');

}



/* ===== CARRUSEL ===== */

async function cargarProductos() {

    mostrarSkeleton();



    const respuesta =

        await fetch('/productos');



    const productos =

        await respuesta.json();



    productosGlobal = productos;



    renderizarProductos(productos);



    actualizarContador();

    actualizarPreviewCarrito();

}



function renderizarCarrusel(imagenes) {

    if (!imagenes || imagenes.length === 0) {

        return '<div class="carrusel-placeholder">Sin imagen</div>';

    }

    let html = '<div class="carrusel">';

    html += '<div class="carrusel-track">';

    imagenes.forEach((img, index) => {

        const active = index === 0 ? 'active' : '';

        html += `<div class="carrusel-slide ${active}"><img src="${img}" onclick="abrirModal('${img}')"></div>`;

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

    if (carruselIntervalos.has(idCarrusel)) {

        clearInterval(carruselIntervalos.get(idCarrusel));

    }

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

    }, 4000);

    carruselIntervalos.set(idCarrusel, intervalo);

}

function detenerAutoPlay(carrusel) {

    const idCarrusel = carrusel.dataset.carruselId;

    if (idCarrusel && carruselIntervalos.has(idCarrusel)) {

        clearInterval(carruselIntervalos.get(idCarrusel));

        carruselIntervalos.delete(idCarrusel);

    }

}



function carruselIrA(dot, index) {

    const carrusel = dot.closest('.carrusel');

    const slides = carrusel.querySelectorAll('.carrusel-slide');

    const dots = carrusel.querySelectorAll('.carrusel-dot');

    slides.forEach(s => s.classList.remove('active'));

    dots.forEach(d => d.classList.remove('active'));

    slides[index].classList.add('active');

    dots[index].classList.add('active');

    iniciarAutoPlay(carrusel);

}



function renderizarProductos(productos) {

    const contenedor =

        document.getElementById('productos');

    contenedor.innerHTML = '';



    if (productos.length === 0) {

        contenedor.innerHTML = '<div class="sin-resultados">No se encontraron productos</div>';

        return;

    }



    productos.forEach(producto => {

        let badges = '';

        if (producto.nuevo) {

            badges += '<span class="badge-nuevo">NUEVO</span>';

        }

        if (producto.descuento) {

            badges += `<span class="badge-descuento">-${producto.descuento}%</span>`;

        }

        contenedor.innerHTML += `

            <div class="producto">

                ${badges}

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

        mostrarToast('✗ Producto sin stock');

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

            mostrarToast('✗ Stock máximo alcanzado');

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

    actualizarPreviewCarrito();

    mostrarToast('✓ Producto agregado al carrito');

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

    // Limpiar timeout anterior (debounce)

    if (timeoutBusqueda) {

        clearTimeout(timeoutBusqueda);

    }

    timeoutBusqueda = setTimeout(() => {

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

    }, 300);

}



/* ===== PREVIEW CARRITO ===== */

function actualizarPreviewCarrito() {

    const preview = document.getElementById('carritoPreview');

    if (!preview) return;

    if (carrito.length === 0) {

        preview.innerHTML = '<div class="carrito-preview-vacio">Carrito vacío</div>';

        return;

    }

    let html = '';

    carrito.forEach(item => {

        html += `

            <div class="carrito-preview-item">

                <span class="preview-nombre">${item.nombre}</span>

                <span class="preview-cant">x${item.cantidad}</span>

            </div>

        `;

    });

    html += '<a href="/carrito.html" class="carrito-preview-ver">Ver carrito</a>';

    preview.innerHTML = html;

}



cargarProductos();
