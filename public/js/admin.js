let productosGlobal = [];
let paginaActual = 1;
const productosPorPagina = 10;
let editandoId = null;
let imagenesAEliminar = [];

/* ===== TOAST ===== */
function mostrarToast(mensaje, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast' + (tipo ? ' ' + tipo : '');
    toast.textContent = mensaje;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('oculto');
        setTimeout(() => toast.remove(), 250);
    }, 2500);
}

/* ===== CATEGORÍAS ===== */
async function cargarCategorias() {
    const respuesta = await fetch('/categorias');
    const categorias = await respuesta.json();

    const select = document.getElementById('categoria_id');
    select.innerHTML = '<option value="">Seleccionar categoría</option>';
    categorias.forEach(categoria => {
        const nombreVisual = categoria.nombre_personalizado || categoria.nombre;
        select.innerHTML += `<option value="${categoria.id}">${nombreVisual}</option>`;
    });

    // También cargar filtro de categorías
    const filtroCat = document.getElementById('filtroCategoria');
    if (filtroCat) {
        filtroCat.innerHTML = '<option value="">Todas</option>';
        categorias.forEach(categoria => {
            const nombreVisual = categoria.nombre_personalizado || categoria.nombre;
            filtroCat.innerHTML += `<option value="${categoria.id}">${nombreVisual}</option>`;
        });
    }
}

async function crearCategoria() {
    const nombre = prompt('Nombre de la nueva categoría:');
    if (!nombre || nombre.trim() === '') return;

    try {
        const respuesta = await fetch('/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim() })
        });

        if (!respuesta.ok) {
            const err = await respuesta.json().catch(() => ({}));
            mostrarToast(err.error || 'Error al crear categoría', 'error');
            return;
        }

        mostrarToast('✓ Categoría creada', 'exito');
        await cargarCategorias();
    } catch (error) {
        mostrarToast('Error de conexión', 'error');
    }
}

/* ===== PANEL PRODUCTO (slide-in) ===== */
function abrirPanelProducto(id) {
    const panel = document.getElementById('panelProducto');
    const overlay = document.getElementById('panelOverlay');

    if (!id) {
        // Nuevo producto
        editandoId = null;
        document.getElementById('panelProductoTitulo').textContent = 'Nuevo producto';
        limpiarFormulario();
        panel.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        return;
    }

    // Editar producto existente
    const producto = productosGlobal.find(p => p.id === id);
    if (!producto) return;

    editandoId = id;
    document.getElementById('panelProductoTitulo').textContent = 'Editar producto';

    document.getElementById('idProducto').value = producto.id;
    document.getElementById('nombre').value = producto.nombre;
    document.getElementById('precio').value = producto.precio;
    document.getElementById('stock').value = producto.stock;
    document.getElementById('descripcion').value = producto.descripcion;
    document.getElementById('categoria_id').value = producto.categoria_id;
    document.getElementById('imagenesActual').value = JSON.stringify(producto.imagenes || []);
    document.getElementById('nuevo').checked = producto.nuevo == 1;
    document.getElementById('descuento').value = producto.descuento || 0;

    // Mostrar preview de imágenes existentes
    const imagenes = producto.imagenes || [];
    for (let i = 0; i < 4; i++) {
        const placeholder = document.getElementById('placeholder' + i);
        const preview = document.getElementById('preview' + i);
        const previewImg = document.getElementById('previewImg' + i);
        const fileInput = document.getElementById('imagen' + i);

        fileInput.value = '';

        if (imagenes[i]) {
            placeholder.style.display = 'none';
            preview.style.display = 'block';
            previewImg.src = imagenes[i];
        } else {
            placeholder.style.display = 'flex';
            preview.style.display = 'none';
            previewImg.src = '';
        }
    }

    panel.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarPanelProducto() {
    const panel = document.getElementById('panelProducto');
    const overlay = document.getElementById('panelOverlay');

    panel.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

/* ===== PREVIEW DE IMÁGENES ===== */
function previewImagen(input, index) {
    const placeholder = document.getElementById('placeholder' + index);
    const preview = document.getElementById('preview' + index);
    const previewImg = document.getElementById('previewImg' + index);

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            placeholder.style.display = 'none';
            preview.style.display = 'block';
            previewImg.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removerImagen(index) {
    const placeholder = document.getElementById('placeholder' + index);
    const preview = document.getElementById('preview' + index);
    const previewImg = document.getElementById('previewImg' + index);
    const fileInput = document.getElementById('imagen' + index);

    fileInput.value = '';
    placeholder.style.display = 'flex';
    preview.style.display = 'none';
    previewImg.src = '';

    // Si estaba editando y la imagen era existente, marcarla para eliminar
    const imagenesActual = document.getElementById('imagenesActual');
    if (imagenesActual.value) {
        try {
            const imagenes = JSON.parse(imagenesActual.value);
            if (imagenes[index]) {
                imagenesAEliminar.push(imagenes[index]);
                imagenes[index] = null;
                imagenesActual.value = JSON.stringify(imagenes.filter(Boolean));
            }
        } catch(e) {}
    }
}

/* ===== GUARDAR PRODUCTO ===== */
async function guardarProducto() {
    const nombre = document.getElementById('nombre').value.trim();
    if (!nombre) {
        mostrarToast('El nombre es obligatorio', 'error');
        document.getElementById('nombre').focus();
        return;
    }

    const precio = document.getElementById('precio').value;
    if (!precio || parseFloat(precio) <= 0) {
        mostrarToast('Ingresa un precio válido', 'error');
        document.getElementById('precio').focus();
        return;
    }

    const categoria_id = document.getElementById('categoria_id').value;
    if (!categoria_id) {
        mostrarToast('Selecciona una categoría', 'error');
        return;
    }

    // Deshabilitar botón y mostrar spinner
    const btnGuardar = document.getElementById('btnGuardarProducto');
    const btnTexto = document.getElementById('btnGuardarTexto');
    const btnSpinner = document.getElementById('btnGuardarSpinner');
    btnGuardar.disabled = true;
    btnTexto.textContent = 'Guardando...';
    btnSpinner.style.display = 'inline-block';

    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('precio', precio);
    formData.append('stock', document.getElementById('stock').value || 0);
    formData.append('descripcion', document.getElementById('descripcion').value.trim());
    formData.append('categoria_id', categoria_id);
    formData.append('imagenesActual', document.getElementById('imagenesActual').value);
    formData.append('nuevo', document.getElementById('nuevo').checked ? 'true' : 'false');
    formData.append('descuento', document.getElementById('descuento').value || 0);

    // Agregar imágenes nuevas
    for (let i = 0; i < 4; i++) {
        const fileInput = document.getElementById('imagen' + i);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append('imagenes', fileInput.files[0]);
        }
    }

    try {
        const id = document.getElementById('idProducto').value;
        let respuesta;

        if (id === '') {
            respuesta = await fetch('/productos', {
                method: 'POST',
                body: formData
            });
        } else {
            respuesta = await fetch('/productos/' + id, {
                method: 'PUT',
                body: formData
            });
        }

        if (!respuesta.ok) {
            const errorData = await respuesta.json().catch(() => ({}));
            mostrarToast(errorData.error || 'Error al guardar', 'error');
            btnGuardar.disabled = false;
            btnTexto.textContent = 'Guardar producto';
            btnSpinner.style.display = 'none';
            return;
        }

        mostrarToast('✓ Producto guardado', 'exito');
        cerrarPanelProducto();
        limpiarFormulario();
        await cargarProductos();
    } catch (error) {
        mostrarToast('Error de conexión', 'error');
    }

    btnGuardar.disabled = false;
    btnTexto.textContent = 'Guardar producto';
    btnSpinner.style.display = 'none';
}

/* ===== ELIMINAR PRODUCTO ===== */
async function eliminarProducto(id) {
    const producto = productosGlobal.find(p => p.id === id);
    if (!producto) return;

    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;

    try {
        const respuesta = await fetch('/productos/' + id, { method: 'DELETE' });

        if (!respuesta.ok) {
            const err = await respuesta.json().catch(() => ({}));
            mostrarToast(err.error || 'Error al eliminar', 'error');
            return;
        }

        mostrarToast('✓ Producto eliminado', 'exito');
        await cargarProductos();
    } catch (error) {
        mostrarToast('Error de conexión', 'error');
    }
}

/* ===== LIMPIAR FORMULARIO ===== */
function limpiarFormulario() {
    document.getElementById('idProducto').value = '';
    document.getElementById('nombre').value = '';
    document.getElementById('precio').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('descripcion').value = '';
    document.getElementById('categoria_id').value = '';
    document.getElementById('imagenesActual').value = '';
    document.getElementById('nuevo').checked = false;
    document.getElementById('descuento').value = 0;
    imagenesAEliminar = [];

    for (let i = 0; i < 4; i++) {
        const fileInput = document.getElementById('imagen' + i);
        if (fileInput) fileInput.value = '';
        const placeholder = document.getElementById('placeholder' + i);
        const preview = document.getElementById('preview' + i);
        if (placeholder) placeholder.style.display = 'flex';
        if (preview) preview.style.display = 'none';
    }
}

/* ===== CARRUSEL EN ADMIN ===== */
function renderizarCarruselAdmin(imagenes) {
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

    if (imagenes.length > 1) {
        html += '<div class="carrusel-indicadores">';
        imagenes.forEach((_, index) => {
            const active = index === 0 ? 'active' : '';
            html += `<span class="carrusel-dot ${active}"></span>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

/* ===== TOUCH SLIDER para carruseles del admin ===== */
function initTouchSliderAdmin(carrusel) {
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

    function actualizarCarrusel(index) {
        const slides = carrusel.querySelectorAll('.carrusel-slide');
        const dots = carrusel.querySelectorAll('.carrusel-dot');

        track.style.transform = `translateX(-${index * 100}%)`;

        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));

        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');

        carrusel.dataset.index = index;
    }

    function onTouchStart(e) {
        const touch = e.touches[0];
        startX = touch.clientX;
        currentX = startX;
        isDragging = true;
        moved = false;
        track.style.transition = 'none';
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        currentX = touch.clientX;
        const diff = currentX - startX;

        if (Math.abs(diff) > 5) {
            moved = true;
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
        }

        actualizarCarrusel(newIndex);
    }

    carrusel.addEventListener('touchstart', onTouchStart, { passive: true });
    carrusel.addEventListener('touchmove', onTouchMove, { passive: false });
    carrusel.addEventListener('touchend', onTouchEnd, { passive: true });

    // Mouse events
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
    }

    function onMouseMove(e) {
        if (!mouseDown) return;
        mouseCurrentX = e.clientX;
        const diff = mouseCurrentX - mouseStartX;
        if (Math.abs(diff) > 5) mouseMoved = true;

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
        }

        actualizarCarrusel(newIndex);
    }

    carrusel.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Inicializar
    actualizarCarrusel(0);
}

/* ===== CARGAR Y RENDERIZAR PRODUCTOS ===== */
async function cargarProductos() {
    try {
        const respuesta = await fetch('/productos');
        const productos = await respuesta.json();
        productosGlobal = productos;
        document.getElementById('contadorInfo').textContent = productos.length + ' productos en total';
        renderizarProductos();
    } catch (error) {
        mostrarToast('Error al cargar productos', 'error');
    }
}

function renderizarProductos() {
    const div = document.getElementById('listaProductos');
    const textoBusqueda = (document.getElementById('buscadorProductos')?.value || '').toLowerCase();
    const filtroCategoria = document.getElementById('filtroCategoria')?.value || '';
    const filtroStock = document.getElementById('filtroStock')?.value || '';
    const filtroOrden = document.getElementById('filtroOrden')?.value || 'nombre';

    let productosFiltrados = productosGlobal.filter(producto => {
        // Búsqueda por texto
        if (textoBusqueda) {
            const coincide = producto.nombre.toLowerCase().includes(textoBusqueda)
                || (producto.categoria && producto.categoria.toLowerCase().includes(textoBusqueda));
            if (!coincide) return false;
        }

        // Filtro por categoría
        if (filtroCategoria && producto.categoria_id != filtroCategoria) return false;

        // Filtro por stock
        if (filtroStock === 'bajo' && producto.stock > 5) return false;
        if (filtroStock === 'agotado' && producto.stock > 0) return false;
        if (filtroStock === 'disponible' && producto.stock <= 0) return false;

        return true;
    });

    // Ordenar
    switch (filtroOrden) {
        case 'nombre':
            productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            break;
        case 'nombre_desc':
            productosFiltrados.sort((a, b) => b.nombre.localeCompare(a.nombre));
            break;
        case 'precio':
            productosFiltrados.sort((a, b) => a.precio - b.precio);
            break;
        case 'precio_desc':
            productosFiltrados.sort((a, b) => b.precio - a.precio);
            break;
        case 'stock':
            productosFiltrados.sort((a, b) => a.stock - b.stock);
            break;
    }

    // Paginación
    const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / productosPorPagina));
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosPagina = productosFiltrados.slice(inicio, fin);

    // Renderizar
    if (productosFiltrados.length === 0) {
        div.innerHTML = `
            <div class="estado-vacio">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <h3>${textoBusqueda ? 'Sin resultados' : 'No hay productos'}</h3>
                <p>${textoBusqueda ? 'Intenta con otra búsqueda' : 'Agregá tu primer producto'}</p>
            </div>
        `;
        document.getElementById('paginacion').style.display = 'none';
        return;
    }

    document.getElementById('paginacion').style.display = 'flex';

    div.innerHTML = productosPagina.map(producto => {
        const stockClass = producto.stock <= 0 ? 'agotado' : producto.stock <= 5 ? 'bajo' : 'disponible';
        const stockText = producto.stock <= 0 ? 'Sin stock' : producto.stock <= 5 ? 'Stock bajo: ' + producto.stock : producto.stock + ' disponibles';

        return `
            <div class="producto-card">
                <div class="producto-card-body">
                    <div class="producto-card-carrusel">
                        ${renderizarCarruselAdmin(producto.imagenes)}
                    </div>
                    <div class="producto-card-info">
                        <div class="producto-card-nombre">${producto.nombre}</div>
                        <div class="producto-card-categoria">${producto.categoria || 'Sin categoría'}</div>
                        <div class="producto-card-precio">$${producto.precio}</div>
                        <div class="producto-card-stock ${stockClass === 'disponible' ? 'stock-disponible' : stockClass === 'bajo' ? 'stock-bajo' : 'stock-agotado'}">
                            <span class="stock-dot ${stockClass}"></span>
                            ${stockText}
                        </div>
                    </div>
                </div>
                <div class="producto-card-acciones">
                    <button class="btn-editar" onclick="abrirPanelProducto(${producto.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    <button class="btn-eliminar" onclick="eliminarProducto(${producto.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Eliminar
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Inicializar touch sliders en los carruseles
    div.querySelectorAll('.producto-card-carrusel .carrusel').forEach(carrusel => {
        initTouchSliderAdmin(carrusel);
    });

    // Actualizar paginación
    document.getElementById('paginaActual').textContent = `Página ${paginaActual} de ${totalPaginas}`;
    document.getElementById('btnAnterior').disabled = paginaActual <= 1;
    document.getElementById('btnSiguiente').disabled = paginaActual >= totalPaginas;
}

/* ===== FILTROS ===== */
function toggleFiltros() {
    const panel = document.getElementById('filtrosPanel');
    const btn = document.getElementById('btnFiltrar');
    panel.classList.toggle('open');
    btn.classList.toggle('active');
}

/* ===== EVENTOS ===== */
document.addEventListener('DOMContentLoaded', function() {
    // Búsqueda con debounce
    const buscador = document.getElementById('buscadorProductos');
    const btnLimpiar = document.getElementById('btnLimpiarBusqueda');

    let timeoutBusqueda = null;
    buscador.addEventListener('input', function() {
        // Mostrar/ocultar botón limpiar
        if (this.value.length > 0) {
            btnLimpiar.classList.add('visible');
        } else {
            btnLimpiar.classList.remove('visible');
        }

        clearTimeout(timeoutBusqueda);
        timeoutBusqueda = setTimeout(() => {
            paginaActual = 1;
            renderizarProductos();
        }, 300);
    });

    btnLimpiar.addEventListener('click', function() {
        buscador.value = '';
        btnLimpiar.classList.remove('visible');
        paginaActual = 1;
        renderizarProductos();
        buscador.focus();
    });

    // Filtros
    document.getElementById('filtroCategoria')?.addEventListener('change', function() {
        paginaActual = 1;
        renderizarProductos();
    });

    document.getElementById('filtroStock')?.addEventListener('change', function() {
        paginaActual = 1;
        renderizarProductos();
    });

    document.getElementById('filtroOrden')?.addEventListener('change', function() {
        paginaActual = 1;
        renderizarProductos();
    });

    // Paginación
    document.getElementById('btnAnterior')?.addEventListener('click', function() {
        if (paginaActual > 1) {
            paginaActual--;
            renderizarProductos();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('btnSiguiente')?.addEventListener('click', function() {
        const totalPaginas = Math.ceil(productosGlobal.length / productosPorPagina);
        if (paginaActual < totalPaginas) {
            paginaActual++;
            renderizarProductos();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Cerrar panel con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarPanelProducto();
        }
    });
});

// Inicializar
cargarCategorias();
cargarProductos();
