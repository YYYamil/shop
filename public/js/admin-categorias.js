/* ===== ADMIN - GESTIÓN DE CATEGORÍAS ===== */

let categoriasGlobal = [];

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

/* ===== CARGAR CATEGORÍAS ===== */
async function cargarCategoriasAdmin() {
    try {
        const respuesta = await fetch('/categorias');
        if (!respuesta.ok) {
            if (respuesta.status === 401) {
                window.location.href = obtenerRutaLogin();
                return;
            }
            throw new Error('Error ' + respuesta.status);
        }
        const categorias = await respuesta.json();
        categoriasGlobal = categorias;
        renderizarCategoriasAdmin(categorias);
    } catch (err) {
        console.error('Error al cargar categorías:', err);
        mostrarToast('Error al cargar categorías', 'error');
    }
}

/* ===== RENDERIZAR CATEGORÍAS ===== */
function renderizarCategoriasAdmin(categorias) {
    const contenedor = document.getElementById('listaCategorias');
    if (!contenedor) return;

    if (categorias.length === 0) {
        contenedor.innerHTML = `
            <div class="estado-vacio">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 7V4h16v3"/>
                    <path d="M9 20h6"/>
                    <path d="M12 4v16"/>
                </svg>
                <h3>No hay categorías</h3>
                <p>Creá una categoría desde el panel de productos</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = categorias.map(cat => {
        const visible = cat.visible === 1 || cat.visible === true;
        const nombreOriginal = cat.nombre || 'Categoría ' + cat.id;
        const nombrePersonalizado = cat.nombre_personalizado || '';
        const count = cat.product_count || 0;

        return `
            <div class="categoria-card" data-id="${cat.id}">
                <div class="categoria-card-header">
                    <div class="categoria-card-titulo">
                        <h3>${escapeHtml(nombreOriginal)}</h3>
                        <span class="categoria-card-id">#${cat.id}</span>
                    </div>
                    <span class="categoria-card-count">${count} producto(s)</span>
                </div>
                <div class="categoria-card-body">
                    <div class="categoria-campo">
                        <label for="nombre_${cat.id}">Nombre personalizado (opcional)</label>
                        <input type="text"
                               id="nombre_${cat.id}"
                               class="input-nombre"
                               value="${escapeHtml(nombrePersonalizado)}"
                               placeholder="${escapeHtml(nombreOriginal)}">
                        <small class="categoria-ayuda">Dejá vacío para usar: "${escapeHtml(nombreOriginal)}"</small>
                    </div>
                    <div class="categoria-campo-toggle">
                        <label>Visible en tienda</label>
                        <div class="toggle-wrapper">
                            <label class="switch-categoria">
                                <input type="checkbox"
                                       class="input-visible"
                                       data-id="${cat.id}"
                                       ${visible ? 'checked' : ''}>
                                <span class="toggle-slider-categoria"></span>
                            </label>
                            <span class="toggle-status" id="status_${cat.id}">
                                ${visible ? 'Visible' : 'Oculta'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="categoria-card-footer">
                    <button onclick="guardarCategoria(${cat.id})" class="btn-guardar-categoria">
                        💾 Guardar cambios
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Actualizar texto del toggle al cambiar
    document.querySelectorAll('.input-visible').forEach(input => {
        input.addEventListener('change', function() {
            const statusSpan = document.getElementById('status_' + this.dataset.id);
            if (statusSpan) {
                statusSpan.textContent = this.checked ? 'Visible' : 'Oculta';
            }
        });
    });
}

/* ===== ESCAPAR HTML para evitar XSS ===== */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ===== GUARDAR CATEGORÍA ===== */
async function guardarCategoria(id) {
    const card = document.querySelector(`.categoria-card[data-id="${id}"]`);
    if (!card) return;

    const nombreInput = card.querySelector('.input-nombre');
    const visibleInput = card.querySelector('.input-visible');

    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const visible = visibleInput ? visibleInput.checked : true;

    const body = {};
    // Siempre enviar nombre_personalizado (vacío = NULL en backend)
    body.nombre_personalizado = nombre;
    body.visible = visible;

    // Deshabilitar botón
    const btn = card.querySelector('.btn-guardar-categoria');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';
    }

    try {
        const respuesta = await fetch('/categorias/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!respuesta.ok) {
            const err = await respuesta.json().catch(() => ({}));
            mostrarToast(err.error || 'Error al guardar', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '💾 Guardar cambios';
            }
            return;
        }

        mostrarToast('✓ Categoría actualizada', 'exito');
        await cargarCategoriasAdmin();
    } catch (err) {
        console.error('Error al guardar categoría:', err);
        mostrarToast('Error de conexión', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💾 Guardar cambios';
        }
    }
}

/* ===== INICIALIZAR ===== */
document.addEventListener('DOMContentLoaded', function() {
    cargarCategoriasAdmin();
});
