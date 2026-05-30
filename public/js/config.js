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

    // 7. Marquee premium
    renderizarMarquee(config);

    // 8. Categorías dinámicas
    renderizarCategorias();

    // 9. Redes sociales en footer
    renderizarRedes(config);

    // 10. WhatsApp flotante
    renderizarWhatsApp(config);

    // 11. Splash screen: asignar logo y ocultar
    aplicarSplash(config);

}

/* ===== SPLASH SCREEN ===== */

// Tiempo mínimo que el splash se muestra para que se aprecie la animación (ms)
const SPLASH_TIEMPO_MINIMO = 2000;

// Momento en que se inició la carga de la página
const SPLASH_INICIO = Date.now();

function aplicarSplash(config) {

    const splashLogo = document.getElementById('splashLogo');

    if (splashLogo && config.logo_imagen) {
        splashLogo.src = config.logo_imagen;
    }

    ocultarSplash();

}

function ocultarSplash() {

    const splash = document.getElementById('splashScreen');

    if (!splash) return;

    const tiempoTranscurrido = Date.now() - SPLASH_INICIO;

    const tiempoRestante = Math.max(0, SPLASH_TIEMPO_MINIMO - tiempoTranscurrido);

    setTimeout(() => {

        splash.classList.add('hidden');

        // Remover del DOM después de la transición
        setTimeout(() => {
            if (splash.parentNode) {
                splash.parentNode.removeChild(splash);
            }
        }, 700);

    }, tiempoRestante);

}

/* ===== COLORES ===== */

function aplicarColores(config) {

    const root = document.documentElement;

    // Mapeo simplificado: solo 3 grupos personalizables
    // 1. Botones (categorías y tarjetas): color de fondo + color de texto
    // 2. Título del Hero: color del texto
    // 3. Fondo general de la página: sólido o gradiente
    const mapaColores = [
        // Botones
        ['color_boton', '--color-boton'],
        ['color_boton', '--color-categoria-activo'],
        ['color_boton_texto', '--color-boton-texto'],
        ['color_boton_texto', '--color-categoria-texto'],
        // Título del Hero
        ['hero_titulo_color', '--color-hero-titulo'],
        // Fondo general de la página
        ['hero_fondo', '--color-fondo'],
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

    if (logo) {
        logo.textContent = nombre;
        logo.style.opacity = '1';
    }

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
    const menuLateral = document.getElementById('menuCategorias');

    if (!contenedor) return;

    try {

        const respuesta = await fetch('/categorias/public');

        if (!respuesta.ok) {

            console.error('Error al cargar categorías:', respuesta.status);

            return;

        }

        const categorias = await respuesta.json();

        // Renderizar en contenedor horizontal (desktop)
        let html = '';
        html += `
            <button class="activo" data-cat-id="0" onclick="filtrarCategoria(0)">
                Todos
            </button>
        `;
        categorias.forEach((cat) => {
            html += `
                <button data-cat-id="${cat.id}" onclick="filtrarCategoria(${cat.id})">
                    ${cat.nombre}
                </button>
            `;
        });
        contenedor.innerHTML = html;

        // Renderizar también en menú lateral (mobile)
        if (menuLateral) {
            let htmlMenu = '';
            htmlMenu += `
                <button class="activo" data-cat-id="0" onclick="filtrarCategoria(0);toggleMenuCategorias()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Todos
                </button>
            `;
            categorias.forEach((cat) => {
                htmlMenu += `
                    <button data-cat-id="${cat.id}" onclick="filtrarCategoria(${cat.id});toggleMenuCategorias()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        ${cat.nombre}
                    </button>
                `;
            });
            menuLateral.innerHTML = htmlMenu;
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
        { clave: 'redes_whatsapp', label: 'Página', icono: 'pagina' },
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
        instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="5"/>
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
        </svg>`,
        facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
        </svg>`,
        tiktok: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
        </svg>`,
        pagina: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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

/* ===== MARQUEE PREMIUM ===== */

function renderizarMarquee(config) {

    const contenedor = document.getElementById('marqueeContainer');

    if (!contenedor) return;

    const track = contenedor.querySelector('.premium-marquee-track');

    if (!track) return;

    // Obtener textos separados por |
    const textosRaw = config.marquee_textos || '🚚 ENVÍOS A TODO EL PAÍS|💳 HASTA 6 CUOTAS SIN INTERÉS|🔒 COMPRA 100% SEGURA';

    const textos = textosRaw.split('|').map(t => t.trim()).filter(t => t);

    if (textos.length === 0) return;

    // Generar los spans: texto + • entre cada uno, duplicado para loop infinito
    let html = '';

    const generarItems = () => {
        let items = '';
        textos.forEach((texto, i) => {
            items += `<span>${texto}</span>`;
            if (i < textos.length - 1) {
                items += `<span>•</span>`;
            }
        });
        return items;
    };

    // Primera tanda
    html += generarItems();
    // Separador + segunda tanda duplicada para loop infinito
    html += `<span>•</span>`;
    html += generarItems();

    track.innerHTML = html;

}

/* ===== FONDO GENERAL DE LA PÁGINA ===== */

function aplicarFondoPagina(config) {

    // El fondo ahora se aplica vía --color-fondo en aplicarColores()
    // hero_fondo se mapea directamente a --color-fondo
    if (config.hero_fondo) {
        document.body.style.background = config.hero_fondo;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';
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
