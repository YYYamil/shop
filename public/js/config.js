/* ===== CONFIGURACIÓN DINÁMICA DE LA TIENDA ===== */

/**
 * Carga toda la configuración desde /api/config y aplica:
 * - Colores CSS (variables)
 * - Nombre de la tienda
 * - Logo
 * - Hero (título, descripción, imagen de fondo)
 * - Categorías dinámicas
 * - Redes sociales en footer
 * - WhatsApp flotante
 */
async function cargarConfiguracion() {

    try {

        const respuesta = await fetch('/api/config');

        if (!respuesta.ok) {

            console.error('Error al cargar configuración:', respuesta.status);

            return;

        }

        const datos = await respuesta.json();

        // datos es un objeto { clave: valor }
        aplicarConfiguracion(datos);

    } catch (error) {

        console.error('Error al cargar configuración:', error);

    }

}

/**
 * Aplica todos los valores de configuración al DOM
 */
function aplicarConfiguracion(config) {

    // 0. Guardar número de WhatsApp para carrito.js
    if (config.whatsapp_numero) {
        window.__whatsappNumero = config.whatsapp_numero;
    }

    // 1. Colores CSS
    aplicarColores(config);

    // 2. Nombre de la tienda
    aplicarNombreTienda(config);

    // 3. Logo (y nombre al lado)
    aplicarLogo(config);

    // 4. Hero
    aplicarHero(config);

    // 5. Fondo general de la página (hero_fondo se aplica al body)
    aplicarFondoPagina(config);

    // 6. Favicon dinámico
    aplicarFavicon(config);

    // 7. Categorías dinámicas
    renderizarCategorias();

    // 8. Redes sociales en footer
    renderizarRedes(config);

    // 9. WhatsApp flotante
    renderizarWhatsApp(config);

}

/* ===== COLORES ===== */

function aplicarColores(config) {

    const root = document.documentElement;

    // Mapeo completo: [clave DB, variable CSS]
    // Usamos array de pares para permitir que una misma clave DB
    // actualice MÚLTIPLES variables CSS (ej: color_primario → --color-primario y --color-navbar-fondo)
    const mapaColores = [
        // Colores base
        ['color_primario', '--color-primario'],
        ['color_fondo', '--color-fondo'],
        ['color_texto', '--color-texto'],
        ['color_boton', '--color-boton'],
        ['color_boton_texto', '--color-boton-texto'],
        // Navbar
        ['color_primario', '--color-navbar-fondo'],
        ['color_texto', '--color-navbar-texto'],
        // Categorías activas
        ['color_primario', '--color-categoria-activo'],
        ['color_texto', '--color-categoria-texto'],
        // Footer
        ['color_boton_texto', '--color-footer-texto'],
        // Tarjetas
        ['color_boton_texto', '--color-tarjeta-fondo'],
        // Precio
        ['color_primario', '--color-precio'],
        // Hero texto
        ['color_boton_texto', '--color-hero-texto'],
    ];

    for (const [clave, variable] of mapaColores) {

        if (config[clave]) {

            root.style.setProperty(variable, config[clave]);

        }

    }

}

/* ===== NOMBRE TIENDA ===== */

function aplicarNombreTienda(config) {

    if (!config.tienda_nombre) return;

    const nombre = config.tienda_nombre;

    // Logo en navbar
    const logo = document.querySelector('.logo');

    if (logo) logo.textContent = nombre;

    // Nombre en footer
    const footerTitulo = document.querySelector('.footer-brand h2');

    if (footerTitulo) footerTitulo.textContent = nombre;

    // Descripción en footer (abajo del nombre)
    const footerDesc = document.querySelector('.footer-brand p');

    if (footerDesc) {

        footerDesc.textContent = config.tienda_descripcion || '';

    }

    // Copyright en footer
    const footerBottom = document.querySelector('.footer-bottom');

    if (footerBottom) {

        const year = new Date().getFullYear();

        footerBottom.textContent = `© ${year} ${nombre} - Todos los derechos reservados`;

    }

    // Título de la página
    document.title = nombre;

}

/* ===== LOGO ===== */

function aplicarLogo(config) {

    const logo = document.querySelector('.logo');

    if (!logo) return;

    const nombre = config.tienda_nombre || 'Mi Shop';

    if (config.logo_imagen) {

        // Logo centrado: imagen circular + nombre siempre visible
        logo.innerHTML = `
            <a href="/" class="logo-link">
                <img src="${config.logo_imagen}" alt="${nombre}" class="logo-img">
                <span class="logo-nombre">${nombre}</span>
            </a>
        `;

    } else {

        // Sin logo, solo el nombre como link
        logo.innerHTML = `
            <a href="/" class="logo-link-solo">${nombre}</a>
        `;

    }

}

/* ===== HERO ===== */

function aplicarHero(config) {

    // Hero título
    if (config.hero_titulo) {

        const titulo = document.querySelector('.hero-content h1');

        if (titulo) titulo.textContent = config.hero_titulo;

    }

    // Hero descripción
    if (config.hero_descripcion) {

        const desc = document.querySelector('.hero-content p');

        if (desc) desc.textContent = config.hero_descripcion;

    }

    // Hero imagen de fondo (si hay imagen subida)
    if (config.hero_imagen) {

        const hero = document.querySelector('.hero');

        if (hero) {

            hero.style.backgroundImage = `url("${config.hero_imagen}")`;

        }

    } else if (config.hero_fondo) {

        // Si no hay imagen, usar el gradient/fondo definido
        const hero = document.querySelector('.hero');

        if (hero) {

            hero.style.background = config.hero_fondo;

        }

        // También actualizar la variable CSS para que los estilos
        // que usan var(--color-hero-fondo) se actualicen
        const root = document.documentElement;
        root.style.setProperty('--color-hero-fondo', config.hero_fondo);

    }

}

/* ===== CATEGORÍAS DINÁMICAS ===== */

async function renderizarCategorias() {

    const contenedor = document.getElementById('categorias');

    if (!contenedor) return;

    try {

        const respuesta = await fetch('/categorias');

        if (!respuesta.ok) {

            console.error('Error al cargar categorías:', respuesta.status);

            return;

        }

        const categorias = await respuesta.json();

        let html = '';

        categorias.forEach((cat, index) => {

            html += `
                <button onclick="filtrarCategoria(${index})">
                    ${cat.nombre}
                </button>
            `;

        });

        contenedor.innerHTML = html;

        // Activar la primera (Todos) por defecto
        const botones = contenedor.querySelectorAll('button');

        if (botones.length > 0) {

            botones[0].classList.add('activo');

        }

    } catch (error) {

        console.error('Error al renderizar categorías:', error);

    }

}

/* ===== REDES SOCIALES ===== */

function renderizarRedes(config) {

    const contenedor = document.getElementById('footerSocial');

    if (!contenedor) return;

    const redes = [
        { clave: 'redes_instagram', label: 'Instagram', icono: 'instagram' },
        { clave: 'redes_facebook', label: 'Facebook', icono: 'facebook' },
        { clave: 'redes_tiktok', label: 'TikTok', icono: 'tiktok' },
    ];

    let html = '';

    for (const red of redes) {

        const url = config[red.clave];

        if (url && url.trim() !== '') {

            html += `
                <a href="${url}"
                   target="_blank"
                   class="social-btn ${red.icono}">
                    ${getIconoSocial(red.icono)}
                </a>
            `;

        }

    }

    contenedor.innerHTML = html;

}

function getIconoSocial(tipo) {

    const iconos = {
        instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a5.507 5.507 0 0 0-1.985 1.286A5.507 5.507 0 0 0 .42 3.69c-.198.509-.332 1.09-.372 1.943C.01 6.486 0 6.759 0 8.93c0 2.171.01 2.444.048 3.297.04.853.174 1.434.372 1.943.24.621.566 1.148 1.286 1.985a5.507 5.507 0 0 0 1.985 1.286c.509.198 1.09.332 1.943.372C5.556 15.99 5.829 16 8 16s2.444-.01 3.297-.048c.853-.04 1.434-.174 1.943-.372a5.507 5.507 0 0 0 1.985-1.286 5.507 5.507 0 0 0 1.286-1.985c.198-.509.332-1.09.372-1.943.038-.853.048-1.126.048-3.297s-.01-2.444-.048-3.297c-.04-.853-.174-1.434-.372-1.943a5.507 5.507 0 0 0-1.286-1.985A5.507 5.507 0 0 0 13.24.42c-.509-.198-1.09-.332-1.943-.372C10.444.01 10.171 0 8 0Zm0 1.441a6.559 6.559 0 1 1 0 13.118A6.559 6.559 0 0 1 8 1.441Zm0 2.279a4.28 4.28 0 1 0 0 8.56 4.28 4.28 0 0 0 0-8.56Zm5.446-.405a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>
        </svg>`,
        facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path d="M16 8.049C16 3.603 12.418 0 8 0S0 3.603 0 8.049C0 12.073 2.925 15.387 6.75 16v-5.625H4.719V8.049H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.875 0 1.79.157 1.79.157v1.98h-1.008c-.994 0-1.304.621-1.304 1.258v1.51h2.218l-.354 2.326H9.25V16C13.075 15.387 16 12.073 16 8.049Z"/>
        </svg>`,
        tiktok: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path d="M9.5 0h2.5c.2 1.7 1.2 3 2.9 3.2v2.6c-1.1 0-2.1-.3-2.9-.8v5.4c0 2.8-2.2 5-5 5S2 13.2 2 10.4 4.2 5.4 7 5.4c.3 0 .6 0 .9.1v2.6c-.3-.1-.6-.2-.9-.2-1.4 0-2.5 1.1-2.5 2.5S5.6 13 7 13s2.5-1.1 2.5-2.5V0z"/>
        </svg>`,
        whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.601 2.326A7.854 7.854 0 0 0 8.004 0C3.58 0 0 3.58 0 8.004a7.95 7.95 0 0 0 1.09 4.013L0 16l4.107-1.074a7.95 7.95 0 0 0 3.897 1.002h.003c4.423 0 8.003-3.58 8.003-8.003a7.95 7.95 0 0 0-2.409-5.599ZM8.007 14.5a6.47 6.47 0 0 1-3.3-.902l-.236-.14-2.438.638.651-2.377-.154-.245A6.47 6.47 0 0 1 1.5 8.004C1.5 4.42 4.42 1.5 8.004 1.5a6.47 6.47 0 0 1 4.595 1.903 6.47 6.47 0 0 1 1.904 4.601c0 3.584-2.92 6.496-6.496 6.496Z"/>
        </svg>`,
    };

    return iconos[tipo] || '';

}

/* ===== WHATSAPP FLOTANTE ===== */

function renderizarWhatsApp(config) {

    // Botón flotante desactivado - el WhatsApp se usa solo desde el carrito
    // Eliminar el botón si existe por si estaba de antes
    const floatBtn = document.querySelector('.whatsapp-float');
    if (floatBtn) {
        floatBtn.remove();
    }

}

/* ===== FONDO GENERAL DE LA PÁGINA ===== */

function aplicarFondoPagina(config) {

    // hero_fondo se aplica como fondo general de toda la página
    if (config.hero_fondo) {

        document.body.style.background = config.hero_fondo;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';

        // También actualizar la variable CSS para el hero
        const root = document.documentElement;
        root.style.setProperty('--color-hero-fondo', config.hero_fondo);

    }

}

/* ===== FAVICON DINÁMICO ===== */

function aplicarFavicon(config) {

    if (!config.logo_imagen) return;

    // Buscar o crear el elemento link para favicon
    let link = document.querySelector('link[rel="icon"]');

    if (!link) {

        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);

    }

    link.href = config.logo_imagen;

}
