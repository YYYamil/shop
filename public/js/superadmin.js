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
            fetch('/api/superadmin/tiendas'),
            fetch('/api/superadmin/usuarios')
        ]);

        if (!tiendasRes.ok) {
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

// ===== MODAL TIENDA =====
function abrirModalTienda() {
    document.getElementById('tiendaSlug').value = '';
    document.getElementById('tiendaNombre').value = '';
    document.getElementById('modalTiendaTitle').textContent = 'Nueva Tienda';
    document.getElementById('modalTienda').classList.remove('hidden');
}

async function guardarTienda() {
    const slug = document.getElementById('tiendaSlug').value.trim();
    const nombre = document.getElementById('tiendaNombre').value.trim();

    if (!slug || !nombre) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }

    try {
        const res = await fetch('/api/superadmin/tiendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, nombre })
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

async function toggleTienda(id, activo) {
    try {
        const res = await fetch('/api/superadmin/tiendas/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
            method: 'DELETE'
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

// Inicializar
document.addEventListener('DOMContentLoaded', cargarDatos);
