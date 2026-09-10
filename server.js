require('dotenv').config();

const express = require('express');

const session = require('express-session');

const path = require('path');

const fs = require('fs');

const authMiddleware = require('./middleware/authMiddleware');
const tiendaMiddleware = require('./middleware/tiendaMiddleware');
const { cargarPlanEstado } = require('./middleware/planEstadoMiddleware');



require('./database/db');



const authRoutes = require('./routes/authRoutes');

const productRoutes = require('./routes/productRoutes');

const pedidoRoutes = require('./routes/pedidoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');

const configRoutes = require('./routes/configRoutes');
const mercadopagoRoutes = require('./routes/mercadopagoRoutes');

const superAdminRoutes = require('./routes/superAdminRoutes');

const saasRoutes = require('./routes/saasRoutes');

const seoController = require('./controllers/seoController');





const app = express();

// Confiar en proxy inverso (Nginx) para headers X-Forwarded-Proto y X-Forwarded-For
// Necesario para que req.protocol y req.secure funcionen correctamente detrás de HTTPS
app.set('trust proxy', 1);



if (!fs.existsSync('uploads')) {

    fs.mkdirSync('uploads');

}



app.use(express.json());

app.use(express.urlencoded({

    extended: true

}));



app.use(session({

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: true

}));



// Middleware de tienda global (detecta slug de tienda desde URL o sesión)
app.use(tiendaMiddleware);

// Adjunta a req el estado comercial DERIVADO de la tienda actual
// (demo/activo/suspendido) + datos del plan, para guards y vistas (BLOQUE 3)
app.use(cargarPlanEstado);



app.use('/uploads', express.static('uploads'));

// /carrito.html (raíz) - Página de proceso privada → noindex
// Debe ir ANTES de express.static para que no la sirva como archivo crudo
app.get('/carrito.html', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'carrito.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(seoController.inyectarNoindex(html));
});

// Servir archivos estáticos con headers anti-caché para JS, HTML y CSS
// Esto evita que el navegador use versiones cacheadas de archivos críticos
// index:false → NO servir index.html en "/" (lo maneja la ruta raíz con redirect SEO)
app.use(express.static('public', {
    etag: false,
    lastModified: false,
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.endsWith('.html') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));



app.use('/auth', authRoutes);

app.use('/productos', productRoutes);

app.use('/pedidos', pedidoRoutes);

app.use('/categorias', categoriaRoutes);

app.use('/api/config', configRoutes);
app.use('/api/mercadopago', mercadopagoRoutes);

app.use('/api/superadmin', superAdminRoutes);

app.use('/api/saas', saasRoutes);



// Ruta para verificar sesión (muy importante)
app.get('/auth/verificar', authMiddleware, (req, res) => {
    res.json({ success: true, admin: req.session.admin, user: req.session.user });
});

app.get('/auth/mercadopago/callback', require('./controllers/mercadopagoController').callback);



// ============================================
// RUTAS SEO GLOBALES (robots.txt / sitemap.xml)
// ============================================

// /robots.txt - Dinámico (bloquea zonas privadas y APIs, permite assets)
app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(seoController.generarRobotsTxt(req));
});

// /sitemap.xml - Dinámico (solo homes canónicas de tiendas activas)
app.get('/sitemap.xml', (req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(seoController.generarSitemapXml(req));
});

// ============================================
// RUTAS DINÁMICAS MULTI-TENANT
// ============================================

// Ruta raíz: sirve la landing del producto/SaaS.
// Las tiendas individuales se siguen sirviendo en /:slug/.
app.get('/', (req, res) => {
    const landingPath = path.join(__dirname, 'public', 'landing.html');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(landingPath);
});

// /home y /home/ → 301 canónico a la landing en la raíz (evita contenido duplicado)
app.get(['/home', '/home/'], (req, res) => {
    res.redirect(301, '/');
});

// /registro y /registro/ → formulario público de alta de tienda (noindex)
app.get(['/registro', '/registro/', '/registrate', '/registrate/'], (req, res) => {
    const filePath = path.join(__dirname, 'public', 'registro.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(seoController.inyectarNoindex(html));
});

// /recuperar y /recuperar.html → recuperación de contraseña por correo (Fase 1)
app.get(['/recuperar', '/recuperar/', '/recuperar.html'], (req, res) => {
    const filePath = path.join(__dirname, 'public', 'recuperar.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(seoController.inyectarNoindex(html));
});

// /superadmin/ - Sirve archivos estáticos del superadmin
app.use('/superadmin', express.static(path.join(__dirname, 'public', 'superadmin')));

// /superadmin (sin slash) - Redirige a /superadmin/
app.get('/superadmin', (req, res) => {
    res.redirect('/superadmin/');
});

// /:slug/admin/:file - Sirve páginas admin de una tienda específica (noindex)
// Ej: /tienda1/admin/admin.html, /tienda1/admin/pedidos.html
app.get('/:slug/admin/:file', (req, res, next) => {
    const { slug, file } = req.params;
    // Validar slug
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    const filePath = path.join(__dirname, 'public', 'admin', file);
    if (fs.existsSync(filePath)) {
        // Inyectar noindex en páginas admin (privadas, sin valor SEO)
        if (file.endsWith('.html')) {
            const html = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return res.send(seoController.inyectarNoindex(html));
        }
        return res.sendFile(filePath);
    }
    next();
});

// /:slug/:file - Sirve páginas HTML públicas de una tienda específica
// Ej: /tienda1/carrito.html (noindex) — /tienda1/index.html → 301 a /tienda1/
app.get('/:slug/:file', (req, res, next) => {
    const { slug, file } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    // Solo servir archivos HTML públicos (no admin, no rutas conocidas)
    const rutasConocidas = ['admin', 'api', 'auth', 'superadmin', 'uploads'];
    if (rutasConocidas.includes(file)) {
        return next();
    }
    if (!file.endsWith('.html')) {
        return next();
    }

    // /:slug/index.html es duplicado de /:slug/ → redirigir a la versión canónica
    if (file === 'index.html') {
        return res.redirect(301, '/' + slug + '/');
    }

    const filePath = path.join(__dirname, 'public', file);
    if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        // Las páginas de proceso (carrito) no deben indexarse
        if (file === 'carrito.html') {
            const html = fs.readFileSync(filePath, 'utf8');
            return res.send(seoController.inyectarNoindex(html));
        }
        return res.sendFile(filePath);
    }
    next();
});

// /:slug y /:slug/ - Home pública de la tienda con SEO dinámico
// Express 4 sin strict routing trata "/vibra" y "/vibra/" como la misma ruta,
// así que distingue por req.path para evitar bucles de redirección.
//   - Con slash final → renderiza la home con SEO
//   - Sin slash final → 301 a la versión canónica "/:slug/"
//   - Slug inexistente o inactivo → 404 real (evita soft-404)
app.get('/:slug', (req, res, next) => {
    const { slug } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    // Slugs reservados del producto/SaaS nunca se interpretan como tienda
    if (['saas', 'registro', 'registrate', 'recuperar', 'home'].includes(slug)) {
        return next();
    }

    // Sin trailing slash → redirigir a la versión canónica (301)
    if (!req.path.endsWith('/')) {
        return res.redirect(301, '/' + slug + '/');
    }

    // Con trailing slash → renderizar tienda con SEO (404 si no existe)
    seoController.renderizarTienda(req, res, next, slug);
});

// 404 real para slugs inexistentes o rutas no encontradas
app.use((req, res) => {
    res.status(404);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    if (req.accepts('html')) {
        return res.send('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>404 - No encontrado</title></head><body><h1>404</h1><p>La página que buscás no existe.</p></body></html>');
    }
    res.json({ error: 'Not Found' });
});



const PORT = process.env.PORT || 3001;

// Solo escuchar si este archivo se ejecuta directamente.
// Si se importa (require) desde una prueba, se exporta la app sin escuchar.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('Servidor funcionando en http://localhost:' + PORT);
    });
}

module.exports = app;
