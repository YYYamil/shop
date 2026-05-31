const db = require('../database/db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// GET /api/superadmin/tiendas - Listar todas las tiendas
exports.getTiendas = (req, res) => {
    try {
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
    const { slug, nombre, admin_usuario, admin_password } = req.body;

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

        const result = db.prepare('INSERT INTO tiendas (slug, nombre) VALUES (?, ?)').run(slug, nombre);
        const tiendaId = result.lastInsertRowid;

        // Crear configuración por defecto para la nueva tienda
        // Mismos valores que el botón "Restaurar todos los textos" en Personalización
        const defaults = [
            ['tienda_nombre', nombre, 'texto', 'general'],
            ['tienda_descripcion', 'Descripción de mi tienda - Aquí podés contar qué ofrecés', 'texto', 'general'],
            ['color_primario', '#000000', 'color', 'oculto'],
            ['color_secundario', '#444444', 'color', 'oculto'],
            ['color_fondo', '#f4f4f4', 'color', 'oculto'],
            ['color_texto', '#111827', 'color', 'oculto'],
            ['color_boton', '#000000', 'color', 'apariencia'],
            ['color_boton_texto', '#ffffff', 'color', 'apariencia'],
            ['hero_titulo', 'Título de portada', 'texto', 'hero'],
            ['hero_descripcion', 'Descripción de portada - Contá lo que quieras destacar', 'texto', 'hero'],
            ['hero_fondo', '#ffffff', 'texto', 'hero'],
            ['hero_titulo_color', '#ffffff', 'color', 'hero'],
            ['hero_imagen', '', 'imagen', 'hero'],
            ['marquee_textos', '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA|✨ NUEVOS INGRESOS TODAS LAS SEMANAS|🎁 PROMOCIONES EXCLUSIVAS|⭐ CALIDAD PREMIUM|⚡ ENTREGA RÁPIDA', 'texto', 'general'],
            ['whatsapp_numero', '', 'texto', 'whatsapp'],
            ['whatsapp_mensaje', 'Hola! Quiero consultar por un producto', 'texto', 'whatsapp'],
            ['whatsapp_activo', 'true', 'booleano', 'whatsapp'],
            ['contacto_email', '', 'texto', 'contacto'],
            ['contacto_telefono', '', 'texto', 'contacto'],
            ['contacto_direccion', '', 'texto', 'contacto'],
            ['redes_instagram', 'https://instagram.com/', 'texto', 'redes'],
            ['redes_facebook', 'https://facebook.com/', 'texto', 'redes'],
            ['redes_tiktok', 'https://tiktok.com/', 'texto', 'redes'],
            ['redes_whatsapp', 'https://www.pagina.com/', 'texto', 'redes'],
            ['logo_imagen', '', 'imagen', 'apariencia'],
        ];

        const insertConfig = db.prepare('INSERT INTO configuracion (clave, valor, tipo, grupo, tienda_id) VALUES (?, ?, ?, ?, ?)');
        const insertAll = db.transaction((rows) => {
            for (const row of rows) insertConfig.run(...row, tiendaId);
        });
        insertAll(defaults);

        // Crear categorías por defecto
        db.prepare('INSERT INTO categorias(nombre, tienda_id) VALUES (?, ?)').run('Ropa', tiendaId);
        db.prepare('INSERT INTO categorias(nombre, tienda_id) VALUES (?, ?)').run('Calzado', tiendaId);
        db.prepare('INSERT INTO categorias(nombre, tienda_id) VALUES (?, ?)').run('Accesorios', tiendaId);

        // Crear usuario admin para la tienda
        const hash = bcrypt.hashSync(admin_password, 10);
        db.prepare('INSERT INTO usuarios (usuario, password, password_plain, tienda_id, es_superadmin) VALUES (?, ?, ?, ?, 0)').run(admin_usuario, hash, admin_password, tiendaId);

        res.json({ ok: true, id: tiendaId, slug, nombre, admin_usuario });
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

        params.push(id);
        db.prepare(`UPDATE tiendas SET ${updates.join(', ')} WHERE id = ?`).run(...params);
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
        db.prepare('DELETE FROM pedidos WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM productos WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM categorias WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM configuracion WHERE tienda_id = ?').run(id);
        db.prepare('DELETE FROM usuarios WHERE tienda_id = ? AND es_superadmin = 0').run(id);
        db.prepare('DELETE FROM tiendas WHERE id = ?').run(id);

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
            usuarios = db.prepare('SELECT id, usuario, password_plain, tienda_id, es_superadmin FROM usuarios WHERE tienda_id = ? ORDER BY id ASC').all(tiendaId);
        } else {
            usuarios = db.prepare('SELECT id, usuario, password_plain, tienda_id, es_superadmin FROM usuarios ORDER BY id ASC').all();
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
        db.prepare('INSERT INTO usuarios (usuario, password, password_plain, tienda_id, es_superadmin) VALUES (?, ?, ?, ?, 0)').run(usuario, hash, password, tienda_id);

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
            updates.push('password_plain = ?');
            params.push(password.trim());
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
            .filter(f => f.endsWith('.db'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                const tamanoKB = (stats.size / 1024).toFixed(1);
                return {
                    nombre: f,
                    tamano: tamanoKB + ' KB',
                    fecha: stats.mtime,
                    fechaFormateada: new Date(stats.mtime).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })
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

        // Validar que el nombre sea seguro (solo backup-*.db)
        if (!nombre || !nombre.match(/^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/)) {
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

        if (!nombre || !nombre.match(/^backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/)) {
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
