/* ===== SUPER ADMIN - GESTIÓN MULTI-TIENDA ===== */

let tiendas = [];
let usuarios = [];

function mostrarToast(mensaje, tipo) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + tipo;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function mostrarSeccion(seccion) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${seccion}"]`).classList.add('active');
    document.getElementById('seccionTiendas').classList.toggle('hidden', seccion !== 'tiendas');
    document.getElementById('seccionUsuarios').classList.toggle('hidden', seccion !== 'usuarios');
}

function cerrarModal(event, modalId) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById(modalId).classList.add('hidden');
}

async function cargarDatos() {
    try {
        const [tiendasRes, usuariosRes] = await Promise.all([
            fetch('/api/superadmin/tiendas', { credentials: 'same-origin' }),
            fetch('/api/superadmin/usuarios', { credentials: 'same-origin' })
        ]);

        if (!tiendasRes.ok) {
            if (tiendasRes.status === 401) {
                window.location = '/superadmin/login.html';
                return;
            }
            mostrarToast('Error al cargar datos de tiendas', 'error');
            return;
        }

        tiendas = await tiendasRes.json();
        usuarios = await usuariosRes.json();

        actualizarStats();
        renderizarTiendas();
        renderizarUsuarios();
        cargarSelectTiendas();
    } catch (err) {
        console.error('Error al cargar datos:', err);
        mostrarToast('Error al cargar datos del servidor', 'error');
    }
}

function actualizarStats() {
    document.getElementById('totalTiendas').textContent = tiendas.length;
    document.getElementById('totalUsuarios').textContent = usuarios.length;

    let totalProductos = 0;
    let totalPedidos = 0;
    tiendas.forEach(t => {
        totalProductos += t.total_productos || 0;
        totalPedidos += t.total_pedidos || 0;
    });
    document.getElementById('totalProductos').textContent = totalProductos;
    document.getElementById('totalPedidos').textContent = totalPedidos;
}

function renderizarTiendas() {
    const tbody = document.getElementById('tablaTiendas');
    tbody.innerHTML = tiendas.map(t => `
        <tr>
            <td>${t.id}</td>
            <td><code>${t.slug}</code></td>
            <td><strong>${escapeHtml(t.nombre)}</strong></td>
            <td>
                <span class="badge ${t.activo ? 'badge-active' : 'badge-inactive'}">
                    ${t.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>${t.total_admins || 0}</td>
            <td>${t.total_productos || 0}</td>
            <td>${t.total_pedidos || 0}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-success" onclick="toggleTienda(${t.id}, ${t.activo ? 0 : 1})">
                        ${t.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    ${t.id > 1 ? `
                        <button class="btn-danger" onclick="eliminarTienda(${t.id}, '${escapeHtml(t.nombre)}')">Eliminar</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderizarUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${escapeHtml(u.usuario)}</td>
            <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px;">${escapeHtml(u.password_plain || '—')}</code></td>
            <td>${u.tienda_id}</td>
            <td>${u.es_superadmin ? '✅ Sí' : '❌ No'}</td>
            <td>
                ${!u.es_superadmin ? `
                    <button class="btn-danger" onclick="eliminarUsuario(${u.id})">Eliminar</button>
                ` : '<span style="color:#94a3b8;font-size:12px;">Protegido</span>'}
            </td>
        </tr>
    `).join('');
}

function cargarSelectTiendas() {
    const select = document.getElementById('usuarioTienda');
    select.innerHTML = tiendas.map(t => `
        <option value="${t.id}">${escapeHtml(t.nombre)} (${t.slug})</option>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Utilidad: convertir nombre a slug =====
function nombreToSlug(texto) {
    return texto
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')  // quitar caracteres especiales
        .replace(/\s+/g, '-')           // espacios a guiones
        .replace(/-+/g, '-')            // guiones múltiples a uno
        .replace(/^-|-$/g, '');         // quitar guiones al inicio/final
}

// ===== MODAL TIENDA =====
function abrirModalTienda() {
    document.getElementById('tiendaNombre').value = '';
    document.getElementById('tiendaAdminUsuario').value = '';
    document.getElementById('tiendaAdminPassword').value = '';
    document.getElementById('previewSlug').textContent = 'nombre-de-la-tienda';
    document.getElementById('modalTiendaTitle').textContent = 'Nueva Tienda';
    document.getElementById('modalTienda').classList.remove('hidden');
}

// Preview del slug en vivo
document.addEventListener('DOMContentLoaded', function() {
    const nombreInput = document.getElementById('tiendaNombre');
    if (nombreInput) {
        nombreInput.addEventListener('input', function() {
            const slug = nombreToSlug(this.value);
            document.getElementById('previewSlug').textContent = slug || 'nombre-de-la-tienda';
        });
    }
});

async function guardarTienda() {
    const nombre = document.getElementById('tiendaNombre').value.trim();
    const slug = nombreToSlug(nombre);
    const admin_usuario = document.getElementById('tiendaAdminUsuario').value.trim();
    const admin_password = document.getElementById('tiendaAdminPassword').value;

    if (!nombre) {
        mostrarToast('Ingresá el nombre de la tienda', 'error');
        return;
    }

    if (!slug) {
        mostrarToast('El nombre no genera un slug válido', 'error');
        return;
    }

    if (!admin_usuario || !admin_password) {
        mostrarToast('Completá usuario y contraseña del admin', 'error');
        return;
    }

    try {
        const res = await fetch('/api/superadmin/tiendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ slug, nombre, admin_usuario, admin_password })
        });

        const data = await res.json();

        if (data.ok) {
            mostrarToast('Tienda creada exitosamente', 'success');
            cerrarModal(null, 'modalTienda');
            cargarDatos();
        } else {
            mostrarToast(data.error || 'Error al crear tienda', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

async function eliminarTienda(id, nombre) {
    if (!confirm(`¿Estás seguro de eliminar la tienda "${nombre}"?\n\nSe eliminarán TODOS sus datos: productos, pedidos, categorías, configuración y usuarios admin.\n\nEsta acción NO se puede deshacer.`)) return;

    try {
        const res = await fetch('/api/superadmin/tiendas/' + id, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        const data = await res.json();

        if (data.ok) {
            mostrarToast(data.mensaje || 'Tienda eliminada', 'success');
            cargarDatos();
        } else {
            mostrarToast(data.error || 'Error al eliminar tienda', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

async function toggleTienda(id, activo) {
    try {
        const res = await fetch('/api/superadmin/tiendas/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ activo })
        });

        const data = await res.json();

        if (data.ok) {
            mostrarToast(activo ? 'Tienda activada' : 'Tienda desactivada', 'success');
            cargarDatos();
        } else {
            mostrarToast(data.error || 'Error al actualizar', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

// ===== MODAL USUARIO =====
function abrirModalUsuario() {
    document.getElementById('usuarioNombre').value = '';
    document.getElementById('usuarioPassword').value = '';
    document.getElementById('modalUsuario').classList.remove('hidden');
}

async function guardarUsuario() {
    const usuario = document.getElementById('usuarioNombre').value.trim();
    const password = document.getElementById('usuarioPassword').value;
    const tienda_id = document.getElementById('usuarioTienda').value;

    if (!usuario || !password || !tienda_id) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }

    try {
        const res = await fetch('/api/superadmin/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ usuario, password, tienda_id: parseInt(tienda_id) })
        });

        const data = await res.json();

        if (data.ok) {
            mostrarToast('Admin creado exitosamente', 'success');
            cerrarModal(null, 'modalUsuario');
            cargarDatos();
        } else {
            mostrarToast(data.error || 'Error al crear admin', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
        const res = await fetch('/api/superadmin/usuarios/' + id, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        const data = await res.json();

        if (data.ok) {
            mostrarToast('Usuario eliminado', 'success');
            cargarDatos();
        } else {
            mostrarToast(data.error || 'Error al eliminar', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

// NOTA: La inicialización se hace desde index.html después de verificarAuth()
// para asegurar que la sesión esté lista antes de cargar datos.
// Ver: public/superadmin/index.html
