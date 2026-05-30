let productosGlobal = [];

/* ===== MENÚ HAMBURGUESA CATEGORÍAS (mobile) ===== */

function toggleMenuCategorias() {
    const sidebar = document.getElementById('sidebarCategorias');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (!sidebar || !overlay || !btn) return;
    const abrir = !sidebar.classList.contains('abierto');
    sidebar.classList.toggle('abierto');
    overlay.classList.toggle('abierto');
    btn.classList.toggle('abierto');
    document.body.style.overflow = abrir ? 'hidden' : '';
}

// Cerrar menú con tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sidebar = document.getElementById('sidebarCategorias');
        if (sidebar && sidebar.classList.contains('abierto')) {
            toggleMenuCategorias();
        }
    }
});



let carrito = JSON.parse(

    localStorage.getItem('carrito')

) || [];



let timeoutBusqueda = null;



/* ===== Cargar configuración al iniciar ===== */

document.addEventListener("DOMContentLoaded", function() {

    if (typeof cargarConfiguracion === "function") {

        cargarConfiguracion();

    }

});



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



function toggleSearch() {

    const wrapper = document.querySelector('.search-wrapper');

    if (!wrapper) return;

    const isActive = wrapper.classList.contains('active');

    if (isActive) {

        wrapper.classList.remove('active');

    } else {

        wrapper.classList.add('active');

        const input = wrapper.querySelector('#busqueda');

        if (input) input.focus();

    }

}

// Cerrar búsqueda al hacer clic fuera del wrapper

document.addEventListener('click', function(e) {

    const wrapper = document.querySelector('.search-wrapper');

    const toggle = document.querySelector('.search-toggle');

    if (!wrapper || !toggle) return;

    if (!wrapper.contains(e.target) && !toggle.contains(e.target)) {

        wrapper.classList.remove('active');

    }

});

// Cerrar búsqueda con Escape

document.addEventListener('keydown', function(e) {

    if (e.key === 'Escape') {

        const wrapper = document.querySelector('.search-wrapper');

        if (wrapper) wrapper.classList.remove('active');

    }

});



/* ===== CARRUSEL ===== */

async function cargarProductos() {

    mostrarSkeleton();

    // Detectar slug desde la URL (para multi-tenant)
    const slug = window.obtenerSlug ? obtenerSlug() : null;
    const cacheBuster = '&_=' + Date.now();
    const url = slug ? '/productos/public?slug=' + slug + cacheBuster : '/productos/public?_=' + Date.now();

    const respuesta =

        await fetch(url);



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

        html += `<div class="carrusel-slide ${active}"><img src="${img}" alt="Imagen ${index + 1}"></div>`;

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

    const idCarrusel =
        carrusel.dataset.carruselId ||
        Math.random().toString(36).substr(2, 9);

    carrusel.dataset.carruselId =
        idCarrusel;

    if (carruselIntervalos.has(idCarrusel)) {

        clearInterval(
            carruselIntervalos.get(idCarrusel)
        );
    }

    const slides =
        carrusel.querySelectorAll('.carrusel-slide');

    if (slides.length <= 1) return;

    const intervalo = setInterval(() => {

        const currentIndex =
            parseInt(carrusel.dataset.index || 0);

        const nextIndex =
            (currentIndex + 1) % slides.length;

        actualizarCarrusel(
            carrusel,
            nextIndex
        );

    }, 4000);

    carruselIntervalos.set(
        idCarrusel,
        intervalo
    );
}

function detenerAutoPlay(carrusel) {

    const idCarrusel = carrusel.dataset.carruselId;

    if (idCarrusel && carruselIntervalos.has(idCarrusel)) {

        clearInterval(carruselIntervalos.get(idCarrusel));

        carruselIntervalos.delete(idCarrusel);

    }

}


function carruselIrA(dot, index) {

    const carrusel =
        dot.closest('.carrusel');

    actualizarCarrusel(
        carrusel,
        index
    );

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
                        ${producto.descuento
                            ? `<span class="precio-original">$ ${producto.precio}</span><span class="precio-descuento">$ ${(producto.precio * (1 - producto.descuento / 100)).toFixed(2)}</span>`
                            : `$ ${producto.precio}`
                        }
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

    // Iniciar auto-play y touch slider en todos los carruseles

    document.querySelectorAll('.carrusel').forEach(carrusel => {

        actualizarCarrusel(carrusel, 0);

    iniciarAutoPlay(carrusel);

        initTouchSlider(carrusel);

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

    // Calcular precio con descuento si aplica (redondeado a 2 decimales)
    const precioConDescuento = producto.descuento
        ? Math.round(producto.precio * (1 - producto.descuento / 100) * 100) / 100
        : producto.precio;

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

        // Actualizar precio por si cambió el descuento
        existente.precioConDescuento = precioConDescuento;

    }

    else {

        const item = {
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            precioConDescuento: precioConDescuento,
            descuento: producto.descuento || 0,
            imagenes: producto.imagenes,
            stock: producto.stock,
            cantidad: 1
        };

        carrito.push(item);

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

    // Sincronizar clase .activo en ambos contenedores de categorías
    document.querySelectorAll('#categorias button, #menuCategorias button').forEach(btn => {
        btn.classList.remove('activo');
    });
    // Activar botón correspondiente: data-cat-id="0" para Todos, o el ID real
    document.querySelectorAll(`#categorias button[data-cat-id="${id}"], #menuCategorias button[data-cat-id="${id}"]`).forEach(btn => {
        btn.classList.add('activo');
    });

    // Activar animación de entrada en las cards al cambiar de categoría
    const contenedor = document.getElementById('productos');
    contenedor.classList.add('cambiando');

    if (id === 0) {

        renderizarProductos(productosGlobal);

        // Quitar la clase después de que termine la animación
        setTimeout(() => contenedor.classList.remove('cambiando'), 400);

        return;

    }

    const filtrados =

        productosGlobal.filter(

            p => p.categoria_id == id

        );

    renderizarProductos(filtrados);

    // Quitar la clase después de que termine la animación
    setTimeout(() => contenedor.classList.remove('cambiando'), 400);

}



function buscarProductos() {

    const input = document.getElementById('busqueda');

    // Toggle clase has-text para mostrar/ocultar la cruz de limpiar
    if (input.value.trim().length > 0) {
        input.classList.add('has-text');
    } else {
        input.classList.remove('has-text');
    }

    // Limpiar timeout anterior (debounce)

    if (timeoutBusqueda) {

        clearTimeout(timeoutBusqueda);

    }

    timeoutBusqueda = setTimeout(() => {

        const texto =

            input

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

function limpiarBusqueda() {

    const input = document.getElementById('busqueda');

    if (input) {
        input.value = '';
        input.classList.remove('has-text');
        input.focus();
        // Renderizar todos los productos
        renderizarProductos(productosGlobal);
    }

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

function actualizarCarrusel(carrusel, index) {

    const track =
        carrusel.querySelector('.carrusel-track');

    const slides =
        carrusel.querySelectorAll('.carrusel-slide');

    const dots =
        carrusel.querySelectorAll('.carrusel-dot');

    track.style.transform =
        `translateX(-${index * 100}%)`;

    slides.forEach(s =>
        s.classList.remove('active')
    );

    dots.forEach(d =>
        d.classList.remove('active')
    );

    if (slides[index]) {

        slides[index].classList.add('active');
    }

    if (dots[index]) {

        dots[index].classList.add('active');
    }

    carrusel.dataset.index = index;
}


/* ===== TOUCH SLIDER para carruseles ===== */

function initTouchSlider(carrusel) {
    if (carrusel.dataset.touchInit) return;
    carrusel.dataset.touchInit = 'true';

    const track = carrusel.querySelector('.carrusel-track');
    if (!track) return;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let moved = false;

    function getSlideIndex() {
        return parseInt(carrusel.dataset.index || 0);
    }

    function getTotalSlides() {
        return carrusel.querySelectorAll('.carrusel-slide').length;
    }

    function onTouchStart(e) {
        const touch = e.touches[0];
        startX = touch.clientX;
        currentX = startX;
        isDragging = true;
        moved = false;
        track.style.transition = 'none';
        detenerAutoPlay(carrusel);
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        currentX = touch.clientX;
        const diff = currentX - startX;

        if (Math.abs(diff) > 5) {
            moved = true;
            // Evitar scroll vertical mientras se desliza horizontal
            e.preventDefault();
        }

        const currentIndex = getSlideIndex();
        const offset = -currentIndex * 100 + (diff / carrusel.offsetWidth) * 100;
        track.style.transform = `translateX(${offset}%)`;
    }

    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;
        track.style.transition = '';

        const diff = currentX - startX;
        const threshold = carrusel.offsetWidth * 0.15;
        const currentIndex = getSlideIndex();
        const total = getTotalSlides();

        let newIndex = currentIndex;

        if (moved) {
            if (diff < -threshold && currentIndex < total - 1) {
                newIndex = currentIndex + 1;
            } else if (diff > threshold && currentIndex > 0) {
                newIndex = currentIndex - 1;
            }
        } else {
            // Fue un tap (toque sin deslizar) -> abrir modal
            const img = carrusel.querySelector('.carrusel-slide.active img');
            if (img) {
                abrirModal(img.src);
            }
            iniciarAutoPlay(carrusel);
            return;
        }

        actualizarCarrusel(carrusel, newIndex);
        iniciarAutoPlay(carrusel);
    }

    // Eventos touch
    carrusel.addEventListener('touchstart', onTouchStart, { passive: true });
    carrusel.addEventListener('touchmove', onTouchMove, { passive: false });
    carrusel.addEventListener('touchend', onTouchEnd, { passive: true });

    // Eventos mouse (para escritorio también)
    let mouseDown = false;
    let mouseStartX = 0;
    let mouseCurrentX = 0;
    let mouseMoved = false;

    function onMouseDown(e) {
        mouseDown = true;
        mouseStartX = e.clientX;
        mouseCurrentX = mouseStartX;
        mouseMoved = false;
        track.style.transition = 'none';
        detenerAutoPlay(carrusel);
    }

    function onMouseMove(e) {
        if (!mouseDown) return;
        mouseCurrentX = e.clientX;
        const diff = mouseCurrentX - mouseStartX;
        if (Math.abs(diff) > 5) {
            mouseMoved = true;
        }
        const currentIndex = getSlideIndex();
        const offset = -currentIndex * 100 + (diff / carrusel.offsetWidth) * 100;
        track.style.transform = `translateX(${offset}%)`;
    }

    function onMouseUp() {
        if (!mouseDown) return;
        mouseDown = false;
        track.style.transition = '';

        const diff = mouseCurrentX - mouseStartX;
        const threshold = carrusel.offsetWidth * 0.15;
        const currentIndex = getSlideIndex();
        const total = getTotalSlides();

        let newIndex = currentIndex;

        if (mouseMoved) {
            if (diff < -threshold && currentIndex < total - 1) {
                newIndex = currentIndex + 1;
            } else if (diff > threshold && currentIndex > 0) {
                newIndex = currentIndex - 1;
            }
        } else {
            // Click sin arrastre -> abrir modal
            const img = carrusel.querySelector('.carrusel-slide.active img');
            if (img) {
                abrirModal(img.src);
            }
            iniciarAutoPlay(carrusel);
            return;
        }

        actualizarCarrusel(carrusel, newIndex);
        iniciarAutoPlay(carrusel);
    }

    carrusel.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}


cargarProductos();
