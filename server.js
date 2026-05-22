require('dotenv').config();

const express = require('express');

const session = require('express-session');

const path = require('path');

const fs = require('fs');

const authMiddleware = require('./middleware/authMiddleware');



require('./database/db');



const authRoutes = require('./routes/authRoutes');

const productRoutes = require('./routes/productRoutes');

const pedidoRoutes = require('./routes/pedidoRoutes');

const categoriaRoutes = require('./routes/categoriaRoutes');



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



app.use('/uploads', express.static('uploads'));

app.use(express.static('public'));



app.use('/auth', authRoutes);

app.use('/productos', productRoutes);

app.use('/pedidos', pedidoRoutes);

app.use('/categorias', authMiddleware, categoriaRoutes);

// Ruta para verificar sesión (muy importante)
app.get('/auth/verificar', authMiddleware, (req, res) => {
    res.json({ success: true, admin: req.session.admin });
});


app.get('/', (req, res) => {

    res.sendFile(

        path.join(__dirname, 'public', 'index.html')

    );

});



app.listen(3001, () => {

    console.log(

        'Servidor funcionando en http://localhost:3001'

    );

});