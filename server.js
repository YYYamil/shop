require('dotenv').config();

const express = require('express');

const session = require('express-session');

const path = require('path');

const fs = require('fs');

const authMiddleware = require('./middleware/authMiddleware');
const tiendaMiddleware = require('./middleware/tiendaMiddleware');



require('./database/db');



const authRoutes = require('./routes/authRoutes');

const productRoutes = require('./routes/productRoutes');

const pedidoRoutes = require('./routes/pedidoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');

const configRoutes = require('./routes/configRoutes');
const mercadopagoRoutes = require('./routes/mercadopagoRoutes');

const superAdminRoutes = require('./routes/superAdminRoutes');





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



app.use('/uploads', express.static('uploads'));

// Servir archivos estáticos con headers anti-caché para JS, HTML y CSS
// Esto evita que el navegador use versiones cacheadas de archivos críticos
app.use(express.static('public', {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
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



// Ruta para verificar sesión (muy importante)
app.get('/auth/verificar', authMiddleware, (req, res) => {
    res.json({ success: true, admin: req.session.admin, user: req.session.user });
});

app.get('/auth/mercadopago/callback', require('./controllers/mercadopagoController').callback);



// ============================================
// RUTAS DINÁMICAS MULTI-TENANT
// ============================================

// Ruta raíz: sirve index.html (tienda por defecto)
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );
});

// /superadmin/ - Sirve archivos estáticos del superadmin
app.use('/superadmin', express.static(path.join(__dirname, 'public', 'superadmin')));

// /superadmin (sin slash) - Redirige a /superadmin/
app.get('/superadmin', (req, res) => {
    res.redirect('/superadmin/');
});

// /:slug/admin/:file - Sirve páginas admin de una tienda específica
// Ej: /tienda1/admin/admin.html, /tienda1/admin/pedidos.html
app.get('/:slug/admin/:file', (req, res, next) => {
    const { slug, file } = req.params;
    // Validar slug
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    const filePath = path.join(__dirname, 'public', 'admin', file);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        next();
    }
});

// /:slug/:file - Sirve páginas HTML públicas de una tienda específica
// Ej: /tienda1/carrito.html, /tienda1/index.html
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
    const filePath = path.join(__dirname, 'public', file);
    if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(filePath);
    } else {
        next();
    }
});

// /:slug/ - Sirve la tienda pública para ese slug
// Ej: /tienda1/ → public/index.html con slug=tienda1
app.get('/:slug/', (req, res, next) => {
    const { slug } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// /:slug (sin slash) - Sirve index.html directamente (sin redirección)
// para evitar problemas con express.static que podría interceptar la ruta
app.get('/:slug', (req, res, next) => {
    const { slug } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {

    console.log(

        'Servidor funcionando en http://localhost:' + PORT

    );

});
