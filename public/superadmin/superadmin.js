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
    const secSaas = document.getElementById('seccionSaasConfig');
    if (secSaas) secSaas.classList.add('hidden');
    const secEv = document.getElementById('seccionEventos');
    if (secEv) secEv.classList.add('hidden');

    // Mostrar la sección seleccionada. Mapa nombre de sección → id real del
    // elemento HTML (ej.: 'saasconfig' → 'seccionSaasConfig').
    const MAPA_SECCIONES = {
        tiendas: 'seccionTiendas',
        backups: 'seccionBackups',
        saasconfig: 'seccionSaasConfig',
        eventos: 'seccionEventos'
    };
    const secEl = document.getElementById(MAPA_SECCIONES[seccion] || seccion);
    if (secEl) secEl.classList.remove('hidden');

    // Actualizar nav items
    document.querySelectorAll('.superadmin-sidebar .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === seccion);
    });

    // Cargar datos según la sección
    if (seccion === 'backups') {
        cargarBackups();
    } else if (seccion === 'saasconfig') {
        cargarSaasConfig();
        cargarEstadoPlataforma();
    } else if (seccion === 'eventos') {
        cargarEventos();
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

// Estado comercial derivado (misma lógica que utils/saasUtils.obtenerEstadoTienda).
// Recibe la fila de tienda que ya incluye plan/trial_fin/suscripcion_fin (SELECT t.*).
function calcularEstadoTienda(t) {
    // Fecha de Buenos Aires (en-CA => YYYY-MM-DD), igual que el backend.
    const fechaHoy = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const activo = t.activo === 1 || t.activo === true || t.activo === null;
    if (!activo) {
        return { estado: 'suspendido', plan: String(t.plan || 'ilimitado'), diasRestantes: null, motivo: 'manual' };
    }
    const plan = String(t.plan || 'ilimitado');
    let estado = 'activo';
    let diasRestantes = null;
    let motivo = null;
    if (plan === 'demo') {
        if (!t.trial_fin || fechaHoy > String(t.trial_fin).slice(0, 10)) {
            estado = 'suspendido';
            motivo = 'trial-vencido';
        } else {
            estado = 'demo';
            diasRestantes = diasEntreFechas(fechaHoy, String(t.trial_fin).slice(0, 10));
        }
    } else if (plan !== 'ilimitado') {
        if (t.suscripcion_fin && fechaHoy > String(t.suscripcion_fin).slice(0, 10)) {
            estado = 'suspendido';
            motivo = 'suscripcion-vencida';
        } else if (t.suscripcion_fin) {
            diasRestantes = diasEntreFechas(fechaHoy, String(t.suscripcion_fin).slice(0, 10));
        }
    }
    return { estado, plan, diasRestantes, motivo };
}

function diasEntreFechas(aISO, bISO) {
    const a = new Date(aISO + 'T12:00:00');
    const b = new Date(bISO + 'T12:00:00');
    return Math.max(0, Math.round((b - a) / 86400000));
}

function etiquetaEstadoFront(t) {
    const e = calcularEstadoTienda(t);
    if (e.estado === 'demo') return 'Período de prueba';
    if (e.estado === 'suspendido') return e.motivo === 'manual' ? 'Inactiva (manual)' : 'Suspendida';
    return 'Activa';
}

function etiquetaPlanFront(t) {
    const plan = String(t.plan || 'ilimitado');
    if (plan === 'demo') return 'DEMO';
    if (plan === 'ilimitado') return 'Ilimitado';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function claseEstadoFront(t) {
    const e = calcularEstadoTienda(t);
    if (e.estado === 'demo') return 'badge-demo';
    if (e.estado === 'suspendido') return 'badge-inactive';
    return 'badge-active';
}

function clasePlanFront(t) {
    const plan = String(t.plan || 'ilimitado');
    if (plan === 'demo') return 'badge-plan-demo';
    if (plan === 'ilimitado') return 'badge-plan-ilimitado';
    return 'badge-plan-pago';
}

function renderizarTiendas() {
    const tbody = document.getElementById('tablaTiendas');
    tbody.innerHTML = tiendas.map(t => `
        <tr class="tienda-row" onclick="abrirModalGestion(${t.id})">
            <td>${t.id}</td>
            <td><code>${t.slug}</code></td>
            <td><strong>${escapeHtml(t.nombre)}</strong></td>
            <td>
                <div class="estado-col">
                    <span class="badge ${claseEstadoFront(t)}">${etiquetaEstadoFront(t)}</span>
                    <span class="badge badge-plan ${clasePlanFront(t)}">${etiquetaPlanFront(t)}</span>
                </div>
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
    const selPlan = document.getElementById('tiendaPlan');
    if (selPlan) selPlan.value = 'demo';
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
    const planSel = document.getElementById('tiendaPlan');
    const plan = (planSel && planSel.value) || 'demo';

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
            body: JSON.stringify({ slug, nombre, admin_usuario, admin_password, plan })
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
    const est = calcularEstadoTienda(t);
    const planLabel = etiquetaPlanFront(t);
    const estadoLabel = etiquetaEstadoFront(t);
    let planDetalle = '';
    if (est.plan === 'demo') {
        planDetalle = t.trial_fin
            ? ' · vence <strong>' + String(t.trial_fin).slice(0, 10) + '</strong>' + (est.diasRestantes !== null ? ' (' + est.diasRestantes + ' días)' : '')
            : '';
    } else if (est.plan !== 'ilimitado' && t.suscripcion_fin) {
        planDetalle = ' · vence <strong>' + String(t.suscripcion_fin).slice(0, 10) + '</strong>' + (est.diasRestantes !== null ? ' (' + est.diasRestantes + ' días)' : '');
    }
    const fechaAlt = est.plan === 'demo'
        ? (t.trial_fin ? ' · fin prueba: ' + String(t.trial_fin).slice(0, 10) : '')
        : (t.suscripcion_fin ? ' · fin suscripción: ' + String(t.suscripcion_fin).slice(0, 10) : '');

    document.getElementById('gestionInfo').innerHTML =
        '<strong>Slug:</strong> ' + slug + '<br>' +
        '<strong>Admin:</strong> ' + escapeHtml(adminUser) + '<br>' +
        '<strong>Plan:</strong> ' + planLabel + planDetalle + '<br>' +
        '<strong>Estado:</strong> ' + (est.estado === 'demo' ? '🧪 ' : est.estado === 'suspendido' ? '🔴 ' : '✅ ') + estadoLabel +
        (est.estado === 'suspendido' ? fechaAlt : '');

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

async function gestionBackupTienda() {
    const t = tiendaGestionActual;
    if (!t) return;

    const btn = document.getElementById('gestionBtnBackup');
    btn.disabled = true;
    btn.textContent = '⏳ Respaldando...';

    try {
        const res = await fetch('/api/superadmin/backups/tienda/' + t.id, {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();

        if (data.ok) {
            mostrarToast('✅ Backup de "' + t.nombre + '" creado: ' + data.backup.nombre, 'success');
        } else {
            mostrarToast(data.error || 'Error al crear backup', 'error');
        }
    } catch (err) {
        console.error('Error al crear backup de tienda:', err);
        mostrarToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Backup tienda';
    }
}

function gestionResumenTienda() {
    const t = tiendaGestionActual;
    if (!t) return;

    const dominio = 'shop.yamy.fun';
    const slug = t.slug;
    const adminUser = t.admin_usuario || '—';

    // BLOQUE 3: password_plain ya NO existe (ni se expone ni se guarda).
    // El superadmin solo puede definir una contraseña nueva desde "Modificar Admin".
    const texto = `🛍️ Guía rápida para usar tu tienda online: ${t.nombre}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Dos direcciones importantes

| Para | Dirección |
|------|-----------|
| 🏪 Ver tu tienda (lo que ven tus clientes) | https://${dominio}/${slug} |
| 🔐 Administrar tu tienda (solo para vos) | https://${dominio}/${slug}/admin/login.html |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 En 5 pasos tenés tu tienda lista

1️⃣ Ingresá al panel de administración
Entrá a https://${dominio}/${slug}/admin/login.html con el usuario ${adminUser}.
La contraseña es la que definiste al crear la tienda. Si la olvidaste, usá
"👤 Modificar Admin" en el panel de Super Admin para asignar una nueva.

2️⃣ Personalizá el diseño
Andá a "Personalizar Tienda" y configurá:
- Nombre y descripción de tu negocio
- Colores de botones y fondo
- Logo e imagen de portada
- Tipografía que más te guste

3️⃣ Agregá categorías
En "Categorías" organizá tus productos en grupos (ej: Remeras, Pantalones, Accesorios).
- Podés cambiarles el nombre cuando quieras
- Podés ocultarlas temporalmente sin perder los productos

4️⃣ Cargá tus productos
En "Productos" agregá cada artículo con:
- Nombre, precio y stock
- Fotos (una o varias)
- Categoría correspondiente

5️⃣ Conectá WhatsApp
En "Personalizar Tienda" → sección WhatsApp, ingresá tu código de área + número (sin el 15). Todos los pedidos te llegarán automáticamente ahí.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Listo para vender

Compartí el link de tu tienda (https://${dominio}/${slug}) con tus clientes. Ellos pueden:
- 👀 Ver todos tus productos con fotos
- 🛒 Armar su carrito
- 💬 Enviarte el pedido directo por WhatsApp`;

    navigator.clipboard.writeText(texto).then(() => {
        mostrarToast('✅ Guía rápida copiada al portapapeles', 'success');
    }).catch(() => {
        // Fallback para navegadores sin permisos
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        mostrarToast('✅ Guía rápida copiada al portapapeles', 'success');
    });
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
    tbody.innerHTML = backups.map(b => {
        const esTienda = b.tipo === 'tienda';
        const badge = esTienda
            ? '<span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">TIENDA</span>'
            : '<span style="display:inline-block;background:#f3e8ff;color:#7c3aed;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">COMPLETO</span>';
        return `
        <tr>
            <td><code>${escapeHtml(b.nombre)}</code>${badge}</td>
            <td>${b.fechaFormateada}</td>
            <td>${b.tamano}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-success" onclick="descargarBackup('${escapeHtml(b.nombre)}')" title="Descargar backup">⬇️ Descargar</button>
                    <button class="btn-danger" onclick="eliminarBackup('${escapeHtml(b.nombre)}')" title="Eliminar backup">🗑️ Eliminar</button>
                </div>
            </td>
        </tr>`;
    }).join('');
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


/* ===== CONFIG SAAS GLOBAL (BLOQUE 4) ===== */

let saasConfigCache = [];

async function cargarSaasConfig() {
    const lista = document.getElementById('saasConfigList');
    if (!lista) return;
    lista.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Cargando configuración...</div>';
    try {
        const res = await fetch('/api/superadmin/saas-config', { credentials: 'same-origin' });
        if (res.status === 401) {
            window.location = '/superadmin/login.html';
            return;
        }
        if (!res.ok) {
            lista.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Error al cargar la configuración</div>';
            return;
        }
        const data = await res.json();
        saasConfigCache = (data && data.config) || [];
        renderizarSaasConfig();
    } catch (err) {
        console.error('Error al cargar config SaaS:', err);
        lista.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Error de conexión al cargar la configuración</div>';
    }
}

function renderizarSaasConfig() {
    const lista = document.getElementById('saasConfigList');
    if (!lista) return;
    if (!saasConfigCache.length) {
        lista.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">No hay parámetros configurados.</div>';
        return;
    }
    lista.innerHTML = saasConfigCache.map(item => {
        const valorActual = item.valor !== null && item.valor !== undefined ? escapeHtml(String(item.valor)) : '';
        return `
        <div class="saas-field">
            <div class="saas-info">
                <div class="saas-label">${escapeHtml(item.etiqueta)}</div>
                <div class="saas-key">${escapeHtml(item.clave)}</div>
            </div>
            <div class="saas-input-wrap">
                <input
                    type="text"
                    id="saasInput_${escapeHtml(item.clave)}"
                    value="${valorActual}"
                    data-tipo="${escapeHtml(item.tipoEsperado)}"
                    onkeydown="if(event.key === 'Enter') guardarSaasConfig('${escapeHtml(item.clave)}', this.value)"
                />
            </div>
            <div class="saas-item-actions">
                <button class="btn-primary" onclick="guardarSaasConfig('${escapeHtml(item.clave)}', document.getElementById('saasInput_${escapeHtml(item.clave)}').value)">Guardar</button>
            </div>
        </div>`;
    }).join('');
}

/* ===== CUENTA DE COBRO DEL SaaS (Mercado Pago del SuperAdmin) - BLOQUE 5 ===== */

const ESTADO_MP_PLATAFORMA = {
    conectado: { texto: 'Conectada · cobra la mensualidad en ARS', color: '#166534', clase: '' },
    no_conectado: { texto: 'No conectada. Conectá tu cuenta de Mercado Pago para cobrar la mensualidad de las tiendas.', color: '#92400e', clase: '' },
    expirado: { texto: 'La conexión con Mercado Pago expiró. Volvé a conectar tu cuenta.', color: '#991b1b', clase: '' },
    proximo_a_vencer: { texto: 'La conexión vence pronto. Reconectá para evitar cortes en el cobro.', color: '#92400e', clase: '' },
    sin_fecha: { texto: 'Conectada (sin fecha de vencimiento conocida).', color: '#166534', clase: '' },
};

async function cargarEstadoPlataforma() {
    const card = document.getElementById('mpPlataformaCard');
    const estadoEl = document.getElementById('mpPlataformaEstado');
    const accionesEl = document.getElementById('mpPlataformaAcciones');
    if (!estadoEl || !accionesEl) return;
    estadoEl.textContent = 'Cargando…';
    accionesEl.innerHTML = '';
    try {
        const res = await fetch('/api/superadmin/mp-plataforma/status', { credentials: 'same-origin' });
        if (res.status === 401) {
            window.location = '/superadmin/login.html';
            return;
        }
        const data = await res.json().catch(() => ({}));
        if (!data || data.ok !== true) {
            estadoEl.textContent = 'No se pudo consultar el estado de la cuenta de cobro.';
            estadoEl.style.color = '#991b1b';
            return;
        }

        const info = ESTADO_MP_PLATAFORMA[data.estadoTexto] || { texto: 'Estado desconocido', color: '#475569' };
        estadoEl.textContent = info.texto + (data.userId ? ' (usuario ' + data.userId + ')' : '') + ' · moneda ARS';
        estadoEl.style.color = info.color;

        if (data.conectado) {
            const btn = document.createElement('button');
            btn.className = 'btn-secondary';
            btn.textContent = 'Desconectar';
            btn.onclick = async function () {
                if (!confirm('¿Desconectar tu cuenta de Mercado Pago? Las tiendas no podrán renovar el plan hasta reconectar.')) return;
                btn.disabled = true;
                btn.textContent = 'Desconectando…';
                try {
                    const r = await fetch('/api/superadmin/mp-plataforma/disconnect', {
                        method: 'POST',
                        credentials: 'same-origin',
                    });
                    if (r.ok) {
                        mostrarToast('Cuenta de cobro desconectada', 'success');
                        cargarEstadoPlataforma();
                    } else {
                        const d = await r.json().catch(() => ({}));
                        mostrarToast('❌ ' + (d.error || 'No se pudo desconectar'), 'error');
                    }
                } catch (e) {
                    mostrarToast('Error de conexión', 'error');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Desconectar';
                }
            };
            accionesEl.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = 'Conectar Mercado Pago';
            btn.onclick = function () {
                // /connect responde 302 al OAuth de MP cuando está todo bien. Si faltan
                // credenciales o la sesión no es válida responde JSON de error. Con
                // redirect:'manual' el 302 llega como respuesta "opaqueredirect"
                // (status 0 en navegadores), por eso hay que detectar ese caso para
                // navegar al OAuth; si no, el botón no hace nada.
                const urlConnect = '/api/superadmin/mp-plataforma/connect';
                fetch(urlConnect, { credentials: 'same-origin', redirect: 'manual' })
                    .then(r => {
                        if (r.type === 'opaqueredirect' || r.status === 0 || (r.status >= 300 && r.status < 400)) {
                            window.location = urlConnect;
                            return null;
                        }
                        return r.json().catch(() => ({}));
                    })
                    .then(d => {
                        if (d && d.error) {
                            mostrarToast('❌ ' + d.error, 'error');
                        }
                    })
                    .catch(() => {
                        // El fetch puede abortarse al navegar: es el flujo esperado de OAuth
                        window.location = urlConnect;
                    });
            };
            accionesEl.appendChild(btn);
        }
    } catch (err) {
        console.error('Error al cargar estado plataforma:', err);
        estadoEl.textContent = 'Error de conexión al consultar la cuenta de cobro.';
        estadoEl.style.color = '#991b1b';
    }
}

/* ===== EVENTOS DE AUDITORÍA (BLOQUE 4) ===== */

function etiquetaTipoEvento(tipo) {
    const map = {
        'tienda_creada': 'Tienda creada',
        'tienda_actualizada': 'Tienda actualizada',
        'tienda_eliminada': 'Tienda eliminada',
        'config_saas_actualizada': 'Config SaaS actualizada',
        // BLOQUE 5 — Pagos de la mensualidad del plan
        'suscripcion_activada': 'Suscripción activada',
        'suscripcion_renovada': 'Suscripción renovada',
        'mp_plataforma_conectada': 'Cuenta de cobro conectada',
        'mp_plataforma_desconectada': 'Cuenta de cobro desconectada',
    };
    return map[tipo] || tipo;
}

function claseTipoEvento(tipo) {
    if (tipo === 'tienda_eliminada') return 'badge-inactive';
    if (tipo === 'tienda_creada') return 'badge-active';
    if (tipo === 'config_saas_actualizada' || tipo === 'mp_plataforma_conectada' || tipo === 'mp_plataforma_desconectada') return 'badge-plan-demo';
    // suscripcion_activada / suscripcion_renovada → badge de pago
    if (tipo === 'suscripcion_activada' || tipo === 'suscripcion_renovada') return 'badge-plan-pago';
    return 'badge-plan-pago';
}

function formatearFechaEvento(fecha) {
    // created_at viene con formato SQLite: YYYY-MM-DD HH:MM:SS
    if (!fecha) return '—';
    const txt = String(fecha).replace(' ', 'T') + (String(fecha).includes('.') ? '' : '');
    const d = new Date(txt);
    if (isNaN(d.getTime())) return String(fecha);
    return d.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

async function cargarEventos() {
    const tbody = document.getElementById('tablaEventos');
    if (!tbody) return;
    const tipoSel = document.getElementById('filtroEventosTipo');
    const tipo = (tipoSel && tipoSel.value) || '';

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Cargando eventos...</td></tr>';
    try {
        let url = '/api/superadmin/eventos?limite=150';
        if (tipo) url += '&tipo=' + encodeURIComponent(tipo);
        const res = await fetch(url, { credentials: 'same-origin' });
        if (res.status === 401) {
            window.location = '/superadmin/login.html';
            return;
        }
        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;">Error al cargar eventos</td></tr>';
            return;
        }
        const data = await res.json();
        renderizarEventos((data && data.eventos) || []);
    } catch (err) {
        console.error('Error al cargar eventos:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;">Error de conexión</td></tr>';
    }
}

function renderizarEventos(eventos) {
    const tbody = document.getElementById('tablaEventos');
    if (!tbody) return;
    if (!eventos.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Sin eventos para el filtro seleccionado</td></tr>';
        return;
    }
    tbody.innerHTML = eventos.map(ev => {
        const tienda = ev.tienda_slug
            ? '<code>' + escapeHtml(ev.tienda_slug) + '</code> <span style="font-size:12px;color:#64748b;">#' + ev.tienda_id + '</span>'
            : '<span style="color:#94a3b8;">Global</span>';
        return `
        <tr>
            <td style="color:#94a3b8;">${ev.id}</td>
            <td style="white-space:nowrap;">${formatearFechaEvento(ev.created_at)}</td>
            <td><span class="badge ${claseTipoEvento(ev.tipo)}">${escapeHtml(etiquetaTipoEvento(ev.tipo))}</span></td>
            <td>${tienda}</td>
            <td style="max-width:420px;overflow-wrap:anywhere;">${escapeHtml(ev.detalle || '')}</td>
        </tr>`;
    }).join('');
}

async function guardarSaasConfig(clave, valor) {
    try {
        const res = await fetch('/api/superadmin/saas-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ clave, valor })
        });
        const data = await res.json();
        if (data.ok) {
            mostrarToast('✅ ' + clave + ' = ' + data.valor, 'success');
            cargarSaasConfig();
        } else {
            mostrarToast('❌ ' + (data.error || 'Error al guardar'), 'error');
            // Restaurar el valor mostrado con lo que realmente quedó en servidor
            cargarSaasConfig();
        }
    } catch (err) {
        console.error('Error al guardar config SaaS:', err);
        mostrarToast('Error de conexión al guardar', 'error');
    }
}


// NOTA: La inicialización se hace desde index.html después de verificarAuth()
// para asegurar que la sesión esté lista antes de cargar datos.
// Ver: public/superadmin/index.html
