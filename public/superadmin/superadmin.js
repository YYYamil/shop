/* ===== SUPER ADMIN - GESTIÓN MULTI-TIENDA ===== */

let tiendas = [];
let tiendaGestionActual = null; // tienda seleccionada en el modal de gestión

function mostrarToast(mensaje, tipo) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + tipo;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function mostrarSeccion(seccion) {
    // Ocultar todas las secciones
    document.getElementById('seccionTiendas').classList.add('hidden');
    document.getElementById('seccionBackups').classList.add('hidden');

    // Mostrar la sección seleccionada
    document.getElementById('seccion' + seccion.charAt(0).toUpperCase() + seccion.slice(1)).classList.remove('hidden');

    // Actualizar nav items
    document.querySelectorAll('.superadmin-sidebar .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === seccion);
    });

    // Si es la sección de backups, cargar la lista
    if (seccion === 'backups') {
        cargarBackups();
    }
}

function cerrarModal(event, modalId) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById(modalId).classList.add('hidden');
}

async function cargarDatos() {
    try {
        const tiendasRes = await fetch('/api/superadmin/tiendas', { credentials: 'same-origin' });

        if (!tiendasRes.ok) {
            if (tiendasRes.status === 401) {
                window.location = '/superadmin/login.html';
                return;
            }
            mostrarToast('Error al cargar datos de tiendas', 'error');
            return;
        }

        tiendas = await tiendasRes.json();
        actualizarStats();
        renderizarTiendas();
    } catch (err) {
        console.error('Error al cargar datos:', err);
        mostrarToast('Error al cargar datos del servidor', 'error');
    }
}

function actualizarStats() {
    document.getElementById('totalTiendas').textContent = tiendas.length;

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
        <tr class="tienda-row" onclick="abrirModalGestion(${t.id})">
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
            <td class="acciones-desktop">
                <div class="action-buttons">
                    <button class="btn-warning" onclick="event.stopPropagation(); abrirModalEditarAdmin(${t.id}, '${escapeHtml(t.admin_usuario || '')}')" title="Modificar admin y contraseña">
                        👤 Admin
                    </button>
                    <button class="btn-success" onclick="event.stopPropagation(); toggleTienda(${t.id}, ${t.activo ? 0 : 1})">
                        ${t.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    ${t.id > 1 ? `
                        <button class="btn-danger" onclick="event.stopPropagation(); eliminarTienda(${t.id}, '${escapeHtml(t.nombre)}')">Eliminar</button>
                    ` : ''}
                </div>
            </td>
        </tr>
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

// ===== MODAL CREAR TIENDA =====
function abrirModalTienda() {
    const modal = document.getElementById('modalTienda');
    if (!modal) return;
    document.getElementById('tiendaNombre').value = '';
    document.getElementById('tiendaAdminUsuario').value = '';
    document.getElementById('tiendaAdminPassword').value = '';
    document.getElementById('previewSlug').textContent = 'nombre-de-la-tienda';
    document.getElementById('modalTiendaTitle').textContent = 'Nueva Tienda';
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
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

// ===== MODAL EDITAR ADMIN DE TIENDA =====
let tiendaEditandoId = null;

function abrirModalEditarAdmin(tiendaId, adminUsuario) {
    const modal = document.getElementById('modalEditarAdmin');
    if (!modal) return;
    tiendaEditandoId = tiendaId;
    document.getElementById('editarAdminUsuario').value = adminUsuario || '';
    document.getElementById('editarAdminPassword').value = '';
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    document.getElementById('editarAdminUsuario').focus();
}

async function guardarEditarAdmin() {
    const usuario = document.getElementById('editarAdminUsuario').value.trim();
    const password = document.getElementById('editarAdminPassword').value;

    if (!usuario && !password) {
        mostrarToast('Completá al menos el usuario o la contraseña', 'error');
        return;
    }

    try {
        // Primero obtener el admin de esta tienda
        const usuariosRes = await fetch('/api/superadmin/usuarios?tienda_id=' + tiendaEditandoId, {
            credentials: 'same-origin'
        });
        const usuarios = await usuariosRes.json();
        const admin = usuarios.find(u => !u.es_superadmin);

        if (!admin) {
            mostrarToast('No se encontró un admin para esta tienda', 'error');
            return;
        }

        const body = {};
        if (usuario) body.usuario = usuario;
        if (password) body.password = password;

        const res = await fetch('/api/superadmin/usuarios/' + admin.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.ok) {
            mostrarToast('Admin actualizado correctamente', 'success');
            cerrarModal(null, 'modalEditarAdmin');
            cargarDatos();
        } else {
            mostrarToast(data.error || 'Error al actualizar admin', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarToast('Error de conexión', 'error');
    }
}

// ===== MODAL GESTIÓN DE TIENDA (mobile) =====

function abrirModalGestion(id) {
    const t = tiendas.find(t => t.id === id);
    if (!t) return;
    tiendaGestionActual = t;

    document.getElementById('gestionTitulo').textContent = '🏪 ' + escapeHtml(t.nombre);
    document.getElementById('gestionProductos').textContent = t.total_productos || 0;
    document.getElementById('gestionPedidos').textContent = t.total_pedidos || 0;
    document.getElementById('gestionAdmins').textContent = t.total_admins || 0;

    const slug = t.slug;
    const adminUser = t.admin_usuario || '—';
    document.getElementById('gestionInfo').innerHTML =
        '<strong>Slug:</strong> ' + slug + '<br>' +
        '<strong>Admin:</strong> ' + escapeHtml(adminUser) + '<br>' +
        '<strong>Estado:</strong> ' + (t.activo ? '✅ Activo' : '❌ Inactivo');

    // Botón toggle
    const btnToggle = document.getElementById('gestionBtnToggle');
    btnToggle.textContent = t.activo ? '🔴 Desactivar tienda' : '🟢 Activar tienda';
    btnToggle.className = t.activo ? 'btn-gestion-toggle' : 'btn-gestion-toggle off';

    // Botón eliminar: ocultar para tienda 1 (principal)
    const btnEliminar = document.getElementById('gestionBtnEliminar');
    btnEliminar.style.display = t.id > 1 ? 'block' : 'none';

    document.getElementById('modalGestion').classList.remove('hidden');
}

function gestionEditarAdmin() {
    const t = tiendaGestionActual;
    if (!t) return;
    cerrarModal(null, 'modalGestion');
    // Pequeño delay para que se cierre el modal antes de abrir el otro
    setTimeout(() => {
        abrirModalEditarAdmin(t.id, t.admin_usuario || '');
    }, 200);
}

function gestionToggleTienda() {
    const t = tiendaGestionActual;
    if (!t) return;
    cerrarModal(null, 'modalGestion');
    setTimeout(() => {
        toggleTienda(t.id, t.activo ? 0 : 1);
    }, 200);
}

function gestionEliminarTienda() {
    const t = tiendaGestionActual;
    if (!t) return;
    cerrarModal(null, 'modalGestion');
    setTimeout(() => {
        eliminarTienda(t.id, t.nombre);
    }, 200);
}

// ===== BACKUPS =====


async function cargarBackups() {
    try {
        const res = await fetch('/api/superadmin/backups', { credentials: 'same-origin' });
        if (!res.ok) {
            mostrarToast('Error al cargar backups', 'error');
            return;
        }
        const backups = await res.json();
        renderizarBackups(backups);
    } catch (err) {
        console.error('Error al cargar backups:', err);
        mostrarToast('Error al cargar backups', 'error');
    }
}

function renderizarBackups(backups) {
    const tbody = document.getElementById('tablaBackups');
    if (!backups || backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No hay backups todavía</td></tr>';
        return;
    }
    tbody.innerHTML = backups.map(b => `
        <tr>
            <td><code>${escapeHtml(b.nombre)}</code></td>
            <td>${b.fechaFormateada}</td>
            <td>${b.tamano}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-success" onclick="descargarBackup('${escapeHtml(b.nombre)}')" title="Descargar backup">⬇️ Descargar</button>
                    <button class="btn-danger" onclick="eliminarBackup('${escapeHtml(b.nombre)}')" title="Eliminar backup">🗑️ Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function crearBackup() {
    const btn = document.querySelector('#seccionBackups .btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ Creando...';

    try {
        const res = await fetch('/api/superadmin/backups', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();

        if (data.ok) {
            mostrarToast('✅ Backup creado: ' + data.backup.nombre, 'success');
            cargarBackups();
        } else {
            mostrarToast(data.error || 'Error al crear backup', 'error');
        }
    } catch (err) {
        console.error('Error al crear backup:', err);
        mostrarToast('Error de conexión al crear backup', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '+ Crear Backup';
    }
}

function descargarBackup(nombre) {
    // Abrir en nueva pestaña para descargar
    window.open('/api/superadmin/backups/' + encodeURIComponent(nombre) + '/download', '_blank');
}

async function eliminarBackup(nombre) {
    if (!confirm('¿Eliminar el backup "' + nombre + '"?\n\nEsta acción no se puede deshacer.')) return;

    try {
        const res = await fetch('/api/superadmin/backups/' + encodeURIComponent(nombre), {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const data = await res.json();

        if (data.ok) {
            mostrarToast('Backup eliminado', 'success');
            cargarBackups();
        } else {
            mostrarToast(data.error || 'Error al eliminar backup', 'error');
        }
    } catch (err) {
        console.error('Error al eliminar backup:', err);
        mostrarToast('Error de conexión', 'error');
    }
}


// NOTA: La inicialización se hace desde index.html después de verificarAuth()
// para asegurar que la sesión esté lista antes de cargar datos.
// Ver: public/superadmin/index.html
