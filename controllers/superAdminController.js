const db = require('../database/db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const saasUtils = require('../utils/saasUtils');
const { insertarConfigPorDefecto, insertarCategoriasPorDefecto } = require('../utils/defaultConfig');

// GET /api/superadmin/tiendas - Listar todas las tiendas
exports.getTiendas = (req, res) => {
    try {
        // BLOQUE 3: ya NO se expone password_plain (nunca se guarda en altas nuevas).
        const tiendas = db.prepare(`
            SELECT t.*,
                   (SELECT COUNT(*) FROM usuarios WHERE tienda_id = t.id) as total_admins,
                   (SELECT COUNT(*) FROM productos WHERE tienda_id = t.id) as total_productos,
                   (SELECT COUNT(*) FROM pedidos WHERE tienda_id = t.id) as total_pedidos,
                   (SELECT usuario FROM usuarios WHERE tienda_id = t.id AND es_superadmin = 0 LIMIT 1) as admin_usuario
            FROM tiendas t
            ORDER BY t.id ASC
        `).all();
        res.json(tiendas);
    } catch (err) {
        console.error('Error al obtener tiendas:', err.message);
        res.status(500).json({ error: 'Error al obtener tiendas' });
    }
};

// POST /api/superadmin/tiendas - Crear nueva tienda con su admin
exports.crearTienda = (req, res) => {
    const { slug, nombre, admin_usuario, admin_password, plan } = req.body;

    if (!slug || !nombre) {
        return res.status(400).json({ error: 'Slug y nombre son requeridos' });
    }

    if (!admin_usuario || !admin_password) {
        return res.status(400).json({ error: 'Usuario admin y contraseña son requeridos' });
    }

    // Validar slug: solo letras, números y guiones
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ error: 'Slug inválido. Use solo minúsculas, números y guiones' });
    }

    try {
        // Verificar que el slug no exista
        const existente = db.prepare('SELECT id FROM tiendas WHERE slug = ?').get(slug);
        if (existente) {
            return res.status(400).json({ error: 'Ya existe una tienda con ese slug' });
        }

        // Verificar que el usuario admin no exista
        const userExistente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(admin_usuario);
        if (userExistente) {
            return res.status(400).json({ error: 'Ya existe un usuario con ese nombre' });
        }

        // BLOQUE 3: alta transaccional reutilizando utils/defaultConfig (misma
        // config/categorías que el alta DEMO del SaaS, BLOQUE 2) y SIN password_plain.
        // El SuperAdmin puede indicar plan 'demo' (trial calculado con la config
        // global saas.trial_days) o dejar el default 'ilimitado' (comportamiento
        // legacy: nunca se suspende sola). Hash ANTES de la transacción (bcrypt es
        // lento y no debe bloquear la DB).
        const planFinal = String(plan || '').toLowerCase() === 'demo' ? 'demo' : 'ilimitado';
        const hash = bcrypt.hashSync(admin_password, 10);

        const hoy = saasUtils.hoyBuenosAires();
        const trialDays = parseInt(saasUtils.getGlobalConfig('saas.trial_days'), 10) || 30;
        const trialFin = saasUtils.sumarDias(hoy, trialDays);

        const crearTodo = db.transaction(() => {
            // 1. Tienda (plan demo con trial calculado, o ilimitado legacy)
            const info = planFinal === 'demo'
                ? db.prepare(`INSERT INTO tiendas (slug, nombre, activo, plan, trial_inicio, trial_fin) VALUES (?, ?, 1, 'demo', ?, ?)`).run(slug, nombre, hoy, trialFin)
                : db.prepare(`INSERT INTO tiendas (slug, nombre, activo, plan) VALUES (?, ?, 1, 'ilimitado')`).run(slug, nombre);
            const tiendaId = Number(info.lastInsertRowid);

            // 2. Dueño (admin). Sin password_plain (BLOQUE 3).
            db.prepare('INSERT INTO usuarios (usuario, password, tienda_id, es_superadmin) VALUES (?, ?, ?, 0)').run(admin_usuario, hash, tiendaId);

            // 3. Config por defecto (con el nombre real de la tienda)
            insertarConfigPorDefecto(tiendaId, { tienda_nombre: nombre });

            // 4. Categorías por defecto
            insertarCategoriasPorDefecto(tiendaId);

            // 5. Evento de auditoría (si la tabla existe)
            try {
                db.prepare('INSERT INTO store_events (tienda_id, tipo, detalle) VALUES (?, ?, ?)').run(tiendaId, 'tienda_creada', planFinal === 'demo'
                    ? 'Alta manual DEMO ' + trialDays + ' días (válida hasta ' + trialFin + ')'
                    : 'Alta manual plan ilimitado (legacy)');
            } catch (e) { /* versiones antiguas sin store_events */ }

            return tiendaId;
        });

        const tiendaId = crearTodo();
        res.json({ ok: true, id: tiendaId, slug, nombre, admin_usuario, plan: planFinal });
    } catch (err) {
        console.error('Error al crear tienda:', err.message);
        res.status(500).json({ error: 'Error al crear tienda' });
    }
};

// PUT /api/superadmin/tiendas/:id - Actualizar tienda
exports.actualizarTienda = (req, res) => {
    const id = req.params.id;
    const { nombre, activo } = req.body;

    try {
        const updates = [];
        const params = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            params.push(nombre);
        }

        if (activo !== undefined) {
            updates.push('activo = ?');
            params.push(activo ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        // BLOQUE 4.5: estado previo para el evento de auditoría
        const previa = db.prepare('SELECT nombre, activo FROM tiendas WHERE id = ?').get(id);
        if (!previa) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        params.push(id);
        db.prepare(`UPDATE tiendas SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        // Auditoría de cambios
        const detalles = [];
        if (nombre !== undefined && String(nombre) !== String(previa.nombre)) {
            detalles.push('nombre: "' + previa.nombre + '" → "' + nombre + '"');
        }
        if (activo !== undefined && Number(Boolean(activo)) !== Number(Boolean(previa.activo))) {
            detalles.push('activo: ' + (previa.activo ? '1' : '0') + ' → ' + (activo ? '1' : '0'));
        }
        if (detalles.length) {
            registrarEvento(parseInt(id, 10), 'tienda_actualizada', detalles.join(' | '));
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al actualizar tienda:', err.message);
        res.status(500).json({ error: 'Error al actualizar tienda' });
    }
};

// DELETE /api/superadmin/tiendas/:id - Eliminar tienda y todos sus datos
exports.eliminarTienda = (req, res) => {
    const id = req.params.id;

    try {
        // No permitir eliminar la tienda por defecto (id=1)
        if (parseInt(id) === 1) {
            return res.status(400).json({ error: 'No se puede eliminar la tienda por defecto' });
        }

        // Verificar que la tienda existe
        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(id);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        // Eliminar todos los datos asociados a la tienda (en orden por FK)
        // 1) Hijos de pedidos y eventos (FK -> pedidos/tiendas)
        db.prepare('DELETE FROM pedido_items WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM store_events WHERE tienda_id = ?').run(id);
        // 2) Hijos directos de tiendas
        db.prepare('DELETE FROM pedidos WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM productos WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM categorias WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM configuracion WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM usuarios WHERE tienda_id = ? AND es_superadmin = 0').run(id);
        db.prepare('DELETE FROM tiendas WHERE id = ?').run(id);

        // BLOQUE 4.5: evento global de auditoría. La tienda ya no existe, así que
        // el evento queda con tienda_id NULL (no viola la FK a tiendas).
        registrarEvento(null, 'tienda_eliminada',
            'Tienda eliminada: ' + tienda.nombre + ' (slug: ' + tienda.slug + ', id: ' + id + ')');

        res.json({ ok: true, mensaje: `Tienda "${tienda.nombre}" eliminada correctamente` });
    } catch (err) {
        console.error('Error al eliminar tienda:', err.message);
        res.status(500).json({ error: 'Error al eliminar tienda' });
    }
};

// GET /api/superadmin/usuarios - Listar usuarios de una tienda específica
exports.getUsuarios = (req, res) => {
    const tiendaId = req.query.tienda_id;

    try {
        let usuarios;
        if (tiendaId) {
            usuarios = db.prepare('SELECT id, usuario, tienda_id, es_superadmin FROM usuarios WHERE tienda_id = ? ORDER BY id ASC').all(tiendaId);
        } else {
            usuarios = db.prepare('SELECT id, usuario, tienda_id, es_superadmin FROM usuarios ORDER BY id ASC').all();
        }
        res.json(usuarios);
    } catch (err) {
        console.error('Error al obtener usuarios:', err.message);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

// POST /api/superadmin/usuarios - Crear admin para una tienda
exports.crearUsuario = async (req, res) => {
    const { usuario, password, tienda_id } = req.body;

    if (!usuario || !password || !tienda_id) {
        return res.status(400).json({ error: 'Usuario, password y tienda_id son requeridos' });
    }

    try {
        // Verificar que el usuario no exista
        const existente = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario);
        if (existente) {
            return res.status(400).json({ error: 'Ya existe un usuario con ese nombre' });
        }

        // Verificar que la tienda exista
        const tienda = db.prepare('SELECT id FROM tiendas WHERE id = ?').get(tienda_id);
        if (!tienda) {
            return res.status(400).json({ error: 'Tienda no encontrada' });
        }

        const hash = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO usuarios (usuario, password, tienda_id, es_superadmin) VALUES (?, ?, ?, 0)').run(usuario, hash, tienda_id);

        res.json({ ok: true });
    } catch (err) {
        console.error('Error al crear usuario:', err.message);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
};

// PUT /api/superadmin/usuarios/:id - Actualizar usuario (admin) y/o contraseña
exports.actualizarUsuario = async (req, res) => {
    const id = req.params.id;
    const { usuario, password } = req.body;

    try {
        // Verificar que el usuario existe
        const existente = db.prepare('SELECT id, tienda_id, es_superadmin FROM usuarios WHERE id = ?').get(id);
        if (!existente) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // No permitir modificar al SuperAdmin
        if (existente.es_superadmin) {
            return res.status(400).json({ error: 'No se puede modificar al SuperAdmin' });
        }

        const updates = [];
        const params = [];

        if (usuario !== undefined && usuario !== null && usuario.trim() !== '') {
            // Verificar que el nuevo nombre de usuario no exista (excepto el mismo)
            const duplicado = db.prepare('SELECT id FROM usuarios WHERE usuario = ? AND id != ?').get(usuario.trim(), id);
            if (duplicado) {
                return res.status(400).json({ error: 'Ya existe otro usuario con ese nombre' });
            }
            updates.push('usuario = ?');
            params.push(usuario.trim());
        }

        if (password !== undefined && password !== null && password.trim() !== '') {
            const hash = bcrypt.hashSync(password.trim(), 10);
            updates.push('password = ?');
            params.push(hash);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        params.push(id);
        db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        res.json({ ok: true, mensaje: 'Admin actualizado correctamente' });
    } catch (err) {
        console.error('Error al actualizar usuario:', err.message);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

// DELETE /api/superadmin/usuarios/:id - Eliminar usuario (no permite eliminarse a sí mismo)
exports.eliminarUsuario = (req, res) => {
    const id = req.params.id;

    try {
        // No permitir eliminarse a sí mismo
        if (req.session.user && req.session.user.id === parseInt(id)) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error al eliminar usuario:', err.message);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};

// ============================================
// BACKUPS
// ============================================

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Asegurar que el directorio de backups exista
function asegurarBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

// GET /api/superadmin/backups - Listar backups disponibles
exports.listarBackups = (req, res) => {
    try {
        asegurarBackupDir();
        const archivos = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.db') || f.endsWith('.json'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                const tamanoKB = (stats.size / 1024).toFixed(1);
                const esTienda = f.startsWith('backup-tienda-');
                return {
                    nombre: f,
                    tamano: tamanoKB + ' KB',
                    fecha: stats.mtime,
                    fechaFormateada: new Date(stats.mtime).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }),
                    tipo: esTienda ? 'tienda' : 'completo'
                };
            })
            .sort((a, b) => b.fecha - a.fecha); // más reciente primero

        res.json(archivos);
    } catch (err) {
        console.error('Error al listar backups:', err.message);
        res.status(500).json({ error: 'Error al listar backups' });
    }
};

// POST /api/superadmin/backups - Crear un backup
exports.crearBackup = (req, res) => {
    try {
        asegurarBackupDir();

        const dbPath = path.join(__dirname, '..', 'database.db');
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ error: 'No se encuentra la base de datos' });
        }

        // Generar nombre: backup-YYYY-MM-DD_HH-mm-ss.db
        const now = new Date();
        const sufijo = now.getFullYear() + '-'
            + String(now.getMonth() + 1).padStart(2, '0') + '-'
            + String(now.getDate()).padStart(2, '0') + '_'
            + String(now.getHours()).padStart(2, '0') + '-'
            + String(now.getMinutes()).padStart(2, '0') + '-'
            + String(now.getSeconds()).padStart(2, '0');
        const nombreBackup = 'backup-' + sufijo + '.db';
        const backupPath = path.join(BACKUP_DIR, nombreBackup);

        // Hacer una copia del archivo database.db
        fs.copyFileSync(dbPath, backupPath);

        const stats = fs.statSync(backupPath);
        const tamanoKB = (stats.size / 1024).toFixed(1);

        console.log('[BACKUP] Creado: ' + nombreBackup + ' (' + tamanoKB + ' KB)');
        res.json({
            ok: true,
            backup: {
                nombre: nombreBackup,
                tamano: tamanoKB + ' KB',
                fechaFormateada: new Date().toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                })
            }
        });
    } catch (err) {
        console.error('Error al crear backup:', err.message);
        res.status(500).json({ error: 'Error al crear backup' });
    }
};

// DELETE /api/superadmin/backups/:nombre - Eliminar un backup
exports.eliminarBackup = (req, res) => {
    try {
        asegurarBackupDir();
        const nombre = req.params.nombre;

        // Validar que el nombre sea seguro
        const esValido = /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(nombre) ||
                         /^backup-tienda-[a-z0-9-]+\.json$/.test(nombre);
        if (!nombre || !esValido) {
            return res.status(400).json({ error: 'Nombre de backup inválido' });
        }

        const backupPath = path.join(BACKUP_DIR, nombre);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        fs.unlinkSync(backupPath);
        console.log('[BACKUP] Eliminado: ' + nombre);
        res.json({ ok: true, mensaje: 'Backup eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar backup:', err.message);
        res.status(500).json({ error: 'Error al eliminar backup' });
    }
};

// GET /api/superadmin/backups/:nombre/download - Descargar un backup
exports.descargarBackup = (req, res) => {
    try {
        asegurarBackupDir();
        const nombre = req.params.nombre;

        // Validar que el nombre sea seguro
        const esValido = /^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(nombre) ||
                         /^backup-tienda-[a-z0-9-]+\.json$/.test(nombre);
        if (!nombre || !esValido) {
            return res.status(400).json({ error: 'Nombre de backup inválido' });
        }

        const backupPath = path.join(BACKUP_DIR, nombre);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        res.download(backupPath, nombre);
    } catch (err) {
        console.error('Error al descargar backup:', err.message);
        res.status(500).json({ error: 'Error al descargar backup' });
    }
};

// POST /api/superadmin/backups/tienda/:id - Backup de una tienda específica (solo texto, reemplaza el anterior)
exports.backupTienda = (req, res) => {
    try {
        asegurarBackupDir();
        const tiendaId = parseInt(req.params.id);
        if (!tiendaId) {
            return res.status(400).json({ error: 'ID de tienda inválido' });
        }

        // Obtener datos de la tienda
        const tienda = db.prepare('SELECT * FROM tiendas WHERE id = ?').get(tiendaId);
        if (!tienda) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        // Obtener usuarios admin de la tienda (sin SuperAdmin)
        const usuarios = db.prepare('SELECT id, usuario, tienda_id, es_superadmin FROM usuarios WHERE tienda_id = ? AND es_superadmin = 0').all(tiendaId);

        // Obtener configuración
        const configuracion = db.prepare('SELECT * FROM configuracion WHERE tienda_id = ?').all(tiendaId);

        // Obtener categorías
        const categorias = db.prepare('SELECT * FROM categorias WHERE tienda_id = ?').all(tiendaId);

        // Obtener productos (SIN imagenes)
        const productos = db.prepare('SELECT id, nombre, precio, descripcion, stock, categoria_id, nuevo, descuento, tienda_id FROM productos WHERE tienda_id = ?').all(tiendaId);

        // Obtener pedidos
        const pedidos = db.prepare('SELECT * FROM pedidos WHERE tienda_id = ?').all(tiendaId);

        // Obtener items de pedidos
        const pedidoItems = db.prepare('SELECT * FROM pedido_items WHERE tienda_id = ?').all(tiendaId);

        // Armar objeto de backup
        const backupData = {
            version: 1,
            tipo: 'backup-tienda',
            creado: new Date().toISOString(),
            tienda: {
                id: tienda.id,
                slug: tienda.slug,
                nombre: tienda.nombre,
                activo: tienda.activo
            },
            datos: {
                usuarios,
                configuracion,
                categorias,
                productos,
                pedidos,
                pedidoItems
            }
        };

        // Nombre del archivo: backup-tienda-[slug].json (SIEMPRE el mismo, reemplaza al anterior)
        const nombreArchivo = 'backup-tienda-' + tienda.slug + '.json';
        const rutaBackup = path.join(BACKUP_DIR, nombreArchivo);

        // Guardar como JSON
        fs.writeFileSync(rutaBackup, JSON.stringify(backupData, null, 2), 'utf-8');

        const stats = fs.statSync(rutaBackup);
        const tamanoKB = (stats.size / 1024).toFixed(1);

        console.log('[BACKUP-TIENDA] Creado: ' + nombreArchivo + ' (' + tamanoKB + ' KB) - Tienda: ' + tienda.nombre + ' (ID: ' + tiendaId + ')');
        res.json({
            ok: true,
            backup: {
                nombre: nombreArchivo,
                tamano: tamanoKB + ' KB',
                fechaFormateada: new Date().toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }),
                tipo: 'tienda'
            }
        });
    } catch (err) {
        console.error('Error al crear backup de tienda:', err.message);
        res.status(500).json({ error: 'Error al crear backup de tienda: ' + err.message });
    }
};

// ============================================
// BLOQUE 4 - Configuración global del SaaS editable
// ============================================

// Claves SaaS editables por el SuperAdmin (orden estable para la UI y validación).
const SAAS_CONFIG_KEYS = [
    { clave: 'saas.plan_name', etiqueta: 'Nombre del plan', tipoEsperado: 'texto' },
    { clave: 'saas.monto_mensual_ars', etiqueta: 'Precio mensual (ARS)', tipoEsperado: 'entero' },
    { clave: 'saas.trial_days', etiqueta: 'Días de prueba DEMO', tipoEsperado: 'entero' },
    { clave: 'saas.warning_days', etiqueta: 'Días de aviso de vencimiento', tipoEsperado: 'entero' },
];

function validarValorSaas(clave, valor) {
    const def = SAAS_CONFIG_KEYS.find(k => k.clave === clave);
    if (!def) return { ok: false, error: 'Clave SaaS no editable: ' + clave };
    if (valor === undefined || valor === null || String(valor).trim() === '') {
        return { ok: false, error: 'El valor no puede estar vacío' };
    }
    const texto = String(valor).trim();
    switch (def.tipoEsperado) {
        case 'entero':
            if (!/^\d+$/.test(texto)) return { ok: false, error: 'Debe ser un número entero' };
            const entero = parseInt(texto, 10);
            if (clave === 'saas.trial_days' && entero < 1) {
                return { ok: false, error: 'Debe ser mayor a 0' };
            }
            return { ok: true, valor: String(entero) };
        case 'numero':
            if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
                return { ok: false, error: 'Precio inválido (ej: 9 o 9.99)' };
            }
            return { ok: true, valor: texto };
        default:
            if (texto.length > 60) return { ok: false, error: 'Máximo 60 caracteres' };
            return { ok: true, valor: texto };
    }
}

// Registra un evento de auditoría en store_events. `tiendaId` puede ser null
// para eventos globales del SaaS. Tolerante a esquemas viejos (try/catch).
function registrarEvento(tiendaId, tipo, detalle) {
    try {
        const params = tiendaId
            ? [tiendaId, tipo, detalle]
            : [tipo, detalle];
        const sql = tiendaId
            ? 'INSERT INTO store_events (tienda_id, tipo, detalle) VALUES (?, ?, ?)'
            : 'INSERT INTO store_events (tipo, detalle) VALUES (?, ?)';
        db.prepare(sql).run(...params);
    } catch (e) {
        console.warn('[EVENTOS] No se pudo registrar evento:', tipo, '-', e.message);
    }
}

// GET /api/superadmin/saas-config - Lista la configuración global del SaaS
exports.getSaasConfig = (req, res) => {
    try {
        const filas = db.prepare(
            "SELECT clave, valor, tipo, grupo FROM configuracion WHERE tienda_id IS NULL AND grupo = 'saas' ORDER BY clave"
        ).all();
        const valores = {};
        for (const f of filas) valores[f.clave] = f.valor;
        const config = SAAS_CONFIG_KEYS.map(def => ({
            clave: def.clave,
            etiqueta: def.etiqueta,
            tipoEsperado: def.tipoEsperado,
            valor: Object.prototype.hasOwnProperty.call(valores, def.clave) ? valores[def.clave] : null,
        }));
        res.json({ ok: true, config });
    } catch (err) {
        console.error('Error al obtener config SaaS:', err.message);
        res.status(500).json({ error: 'Error al obtener config SaaS' });
    }
};

// PUT /api/superadmin/saas-config - Actualiza UNA clave de configuración global del SaaS
exports.updateSaasConfig = (req, res) => {
    try {
        const { clave, valor } = req.body || {};
        const val = validarValorSaas(clave, valor);
        if (!val.ok) {
            return res.status(400).json({ error: val.error });
        }

        const anterior = saasUtils.getGlobalConfig(clave);

        // Upsert robusto: la fila global es un singleton lógico (clave + tienda_id NULL).
        // En SQLite dos NULL no colisionan en la PK compuesta, así que se hace
        // delete + insert dentro de una transacción para evitar duplicados.
        const guardar = db.transaction(() => {
            db.prepare('DELETE FROM configuracion WHERE clave = ? AND tienda_id IS NULL').run(clave);
            db.prepare(
                "INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, 'texto', 'saas', NULL)"
            ).run(clave, val.valor);
        });
        guardar();

        registrarEvento(null, 'config_saas_actualizada',
            clave + ': ' + (anterior || '(vacío)') + ' → ' + val.valor);

        console.log('[SAAS-CONFIG] Actualizada ' + clave + ' = ' + val.valor + ' (antes: ' + (anterior || '(vacío)') + ')');
        res.json({ ok: true, clave, valor: val.valor, anterior: anterior || null });
    } catch (err) {
        console.error('Error al actualizar config SaaS:', err.message);
        res.status(500).json({ error: 'Error al actualizar config SaaS' });
    }
};

// Helper reutilizable por otros controladores (BLOQUE 4.5: eventos en acciones clave)
exports.registrarEvento = registrarEvento;

// GET /api/superadmin/eventos - Lista eventos de auditoría (store_events).
// Filtros opcionales: ?tienda_id=ID&tipo=tienda_eliminada&limite=100
exports.getEventos = (req, res) => {
    try {
        const tiendaId = req.query.tienda_id ? parseInt(req.query.tienda_id, 10) : null;
        const tipo = (req.query.tipo || '').trim();
        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 100, 1), 500);

        let sql = `
            SELECT e.id, e.tienda_id, e.tipo, e.detalle, e.created_at,
                   t.slug AS tienda_slug, t.nombre AS tienda_nombre
            FROM store_events e
            LEFT JOIN tiendas t ON t.id = e.tienda_id
        `;
        const where = [];
        const params = [];
        if (tiendaId && !isNaN(tiendaId)) {
            where.push('e.tienda_id = ?');
            params.push(tiendaId);
        }
        if (tipo) {
            where.push('e.tipo = ?');
            params.push(tipo);
        }
        if (where.length) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY e.id DESC LIMIT ?';
        params.push(limite);

        const eventos = db.prepare(sql).all(...params);
        res.json({ ok: true, eventos });
    } catch (err) {
        console.error('Error al obtener eventos:', err.message);
        res.status(500).json({ error: 'Error al obtener eventos' });
    }
};
