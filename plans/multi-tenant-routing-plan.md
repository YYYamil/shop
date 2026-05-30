# Plan de Reestructuración de Rutas Multi-Tenant

## Problema Actual

El superadmin está dentro de `/admin/superadmin.html`, que depende del middleware de tienda. El superadmin debe ser **independiente** de cualquier tienda.

## Arquitectura Objetivo

```
shop.yamy.fun/superadmin/login.html         → Login de superadmin (independiente)
shop.yamy.fun/superadmin/dashboard.html     → Panel superadmin (gestiona todas las tiendas)

shop.yamy.fun/tienda1                        → Tienda pública 1
shop.yamy.fun/tienda1/admin/login.html       → Login admin de tienda1
shop.yamy.fun/tienda1/admin/admin.html       → Panel admin de tienda1

shop.yamy.fun/tienda2                        → Tienda pública 2
shop.yamy.fun/tienda2/admin/login.html       → Login admin de tienda2
shop.yamy.fun/tienda2/admin/admin.html       → Panel admin de tienda2
```

## Cambios Necesarios

### 1. Server.js - Nuevas rutas de archivos estáticos

Agregar rutas dinámicas para servir el frontend de cada tienda y del superadmin.

```javascript
// Servir superadmin (independiente de tiendas)
app.use('/superadmin', express.static('public/superadmin'));

// Ruta dinámica: /:slug → sirve index.html de la tienda
// Ruta dinámica: /:slug/admin/* → sirve archivos admin de la tienda
app.get('/:slug', (req, res, next) => {
    const slug = req.params.slug;
    // Validar que sea un slug de tienda válido
    if (slug.match(/^[a-z0-9-]+$/)) {
        res.sendFile(path.join(__dirname, 'public', 'tienda.html'));
    } else {
        next();
    }
});

app.get('/:slug/admin/:file', (req, res) => {
    const { slug, file } = req.params;
    res.sendFile(path.join(__dirname, 'public', 'admin', file));
});
```

### 2. Middleware tiendaMiddleware.js - Detectar slug desde URL path

Modificar para que detecte el slug desde `req.params.slug` además de `req.query.slug`.

```javascript
// Detectar slug desde la URL path (/:slug/...)
const pathSlug = req.params.slug;
if (pathSlug) {
    const tienda = db.prepare('SELECT id, slug, nombre FROM tiendas WHERE slug = ? AND activo = 1').get(pathSlug);
    if (tienda) {
        req.tiendaId = tienda.id;
        req.tiendaSlug = tienda.slug;
        return next();
    }
}
```

### 3. Mover archivos de superadmin

Crear directorio `public/superadmin/` y mover/allí los archivos:
- `public/admin/superadmin.html` → `public/superadmin/index.html`
- `public/js/superadmin.js` → `public/superadmin/superadmin.js`
- Crear `public/superadmin/login.html` para login de superadmin

### 4. Frontend - obtenerSlug() en config.js

Modificar `obtenerSlug()` para que extraiga el slug del pathname correctamente:
```javascript
function obtenerSlug() {
    const match = window.location.pathname.match(/^\/([a-z0-9-]+)\//);
    return match ? match[1] : null;
}
```
Esto ya está implementado correctamente.

### 5. Frontend - admin/login.html

Modificar el login de admin para que después del login redirija a `/{slug}/admin/admin.html` en lugar de `/admin/admin.html`.

### 6. Frontend - admin HTMLs

Actualizar las rutas de los links en la sidebar para que apunten a `/{slug}/admin/...`.

### 7. Autenticación de superadmin separada

El superadmin necesita su propia sesión/ruta de login independiente, ya que no pertenece a ninguna tienda. Opciones:
- **Opción A (recomendada):** Usar una ruta `/superadmin/login` que haga login y guarde `es_superadmin` en sesión. El superadmin puede loguearse desde cualquier lado.
- **Opción B:** Crear un auth separado para superadmin con su propia tabla de sesiones.

**Opción recomendada: A** - El login de superadmin usa el mismo `/auth/login` pero verifica `es_superadmin`. Si es superadmin, redirige a `/superadmin/`. Si es admin de tienda, redirige a `/{slug}/admin/`.

### 8. server.js - Ruta catch-all para SPA

Agregar una ruta catch-all que sirva `index.html` para cualquier ruta no coincidente (para que funcione el frontend con URLs amigables).

## Resumen de Archivos a Modificar/Crear

| Archivo | Acción |
|---------|--------|
| `server.js` | Modificar - Agregar rutas dinámicas para slugs |
| `middleware/tiendaMiddleware.js` | Modificar - Detectar slug desde URL path |
| `public/superadmin/` (directorio) | Crear |
| `public/superadmin/index.html` | Mover desde `public/admin/superadmin.html` |
| `public/superadmin/superadmin.js` | Mover desde `public/js/superadmin.js` |
| `public/superadmin/login.html` | Crear - Login específico para superadmin |
| `public/js/auth.js` | Modificar - Redirigir según rol (superadmin vs admin tienda) |
| `public/admin/login.html` | Modificar - Redirigir a `/{slug}/admin/admin.html` |
| `public/admin/admin.html` | Modificar - Links de sidebar con slug |
| `public/admin/dashboard.html` | Modificar - Links de sidebar con slug |
| `public/admin/pedidos.html` | Modificar - Links de sidebar con slug |
| `public/admin/categorias.html` | Modificar - Links de sidebar con slug |
| `public/admin/personalizacion.html` | Modificar - Links de sidebar con slug |
| `public/index.html` | Sin cambios (sirve como fallback) |
| `public/js/config.js` | Sin cambios (ya tiene obtenerSlug()) |

## Flujo de Usuario

### Superadmin
1. Entra a `shop.yamy.fun/superadmin/login.html`
2. Ingresa credenciales de superadmin
3. Es redirigido a `shop.yamy.fun/superadmin/`
4. Ve todas las tiendas, puede crear/editar/desactivar
5. Puede crear admins para cada tienda

### Admin de Tienda
1. Entra a `shop.yamy.fun/mi-tienda/admin/login.html`
2. Ingresa credenciales de admin de esa tienda
3. Es redirigido a `shop.yamy.fun/mi-tienda/admin/admin.html`
4. Gestiona productos, pedidos, config de su tienda

### Cliente
1. Entra a `shop.yamy.fun/mi-tienda`
2. Ve la tienda pública con la configuración de esa tienda
3. Compra productos normalmente
