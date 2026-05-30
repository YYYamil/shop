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

const superAdminRoutes = require('./routes/superAdminRoutes');





const app = express();



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

    saveUninitialized: false

}));



// Middleware de tienda global (detecta slug de tienda desde URL o sesión)
app.use(tiendaMiddleware);



// Middleware para deshabilitar cache en archivos JS y HTML (evitar problemas de cache en desarrollo)
app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.html') || req.path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use('/uploads', express.static('uploads'));

app.use(express.static('public'));



app.use('/auth', authRoutes);

app.use('/productos', productRoutes);

app.use('/pedidos', pedidoRoutes);

app.use('/categorias', categoriaRoutes);

app.use('/api/config', configRoutes);

app.use('/api/superadmin', superAdminRoutes);



// Ruta para verificar sesión (muy importante)
app.get('/auth/verificar', authMiddleware, (req, res) => {
    res.json({ success: true, admin: req.session.admin, user: req.session.user });
});



// ============================================
// RUTAS DINÁMICAS MULTI-TENANT
// ============================================

// Ruta raíz: sirve index.html (tienda por defecto)
app.get('/', (req, res) => {
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

// /:slug/ - Sirve la tienda pública para ese slug
// Ej: /tienda1/ → public/index.html con slug=tienda1
app.get('/:slug/', (req, res, next) => {
    const { slug } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// /:slug (sin slash) - Redirige a /:slug/
app.get('/:slug', (req, res, next) => {
    const { slug } = req.params;
    if (!slug.match(/^[a-z0-9-]+$/)) {
        return next();
    }
    res.redirect('/' + slug + '/');
});



app.listen(3001, () => {

    console.log(

        'Servidor funcionando en http://localhost:3001'

    );

});
