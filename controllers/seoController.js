// controllers/seoController.js
// ============================================
// SEO TÉCNICO SERVER-SIDE POR TIENDA (multi-tenant)
// ============================================
// Genera e inyecta en la home de cada tienda:
//   - <title> dinámico
//   - meta description
//   - canonical absoluto (https://shop.yamy.fun/{slug}/)
//   - Open Graph y Twitter Card
// Además expone la generación de /robots.txt y /sitemap.xml dinámicos.
//
// NO usa motor de plantillas: lee public/index.html (archivo estático) e
// inyecta el bloque SEO dentro del <head> reemplazando el marcador <!--SEO_HEAD-->.
// Todos los textos inyectados se escapan para evitar XSS/inyección HTML.

const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const INDEX_HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');
const MARCA_SEO_HEAD = '<!--SEO_HEAD-->';

// Claves sensibles que jamás deben salir hacia el HTML
const SECRET_CONFIG_KEYS = new Set([
    'mp_access_token',
    'mp_public_key',
    'mp_refresh_token',
    'mp_user_id',
    'mp_seller_id',
    'mp_token_expires_at',
]);

let cacheIndexHTML = null;
let cacheIndexMtime = null;

/* ============================================
   HELPERS
   ============================================ */

// Escapa texto para insertarlo dentro de atributos/contenido HTML.
// Las entidades se construyen en runtime (String.fromCharCode(38) === '&')
// para que el texto fuente del archivo no contenga entidades literales
// que puedan perderse al serializar/guardar el código.
function escapeHtml(valor) {
    const entidades = {
        '&': String.fromCharCode(38) + 'amp;',
        '<': String.fromCharCode(38) + 'lt;',
        '>': String.fromCharCode(38) + 'gt;',
        '"': String.fromCharCode(38) + 'quot;',
        "'": String.fromCharCode(38) + '#39;'
    };
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (caracter) {
        return entidades[caracter];
    });
}

// Serializa a JSON seguro para incrustar en <script type="application/ld+json">
// (evita que un </script> dentro de los datos rompa o inyecte HTML)
function jsonLdSeguro(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// Lee public/index.html una sola vez y lo cachea (se invalida si el archivo cambia)
function obtenerIndexHTML() {
    const stat = fs.statSync(INDEX_HTML_PATH);
    if (!cacheIndexHTML || cacheIndexMtime !== stat.mtimeMs) {
        cacheIndexHTML = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
        cacheIndexMtime = stat.mtimeMs;
    }
    return cacheIndexHTML;
}

// Inserta un bloque dentro del <head>, reemplazando el marcador si existe
function inyectarEnHead(html, bloque) {
    if (html.includes(MARCA_SEO_HEAD)) {
        return html.replace(MARCA_SEO_HEAD, bloque);
    }
    // Fallback: insertar justo antes de </head>
    const idx = html.toLowerCase().indexOf('</head>');
    if (idx === -1) return bloque + '\n' + html;
    return html.slice(0, idx) + bloque + '\n' + html.slice(idx);
}

// Inyecta <meta name="robots" content="noindex, nofollow"> justo antes de </head>
// (para páginas privadas o sin valor SEO: carrito, admin, login)
function inyectarNoindex(html) {
    const meta = '    <meta name="robots" content="noindex, nofollow">\n';
    if (html.includes('name="robots"')) return html;
    const idx = html.toLowerCase().indexOf('</head>');
    if (idx === -1) return meta + html;
    return html.slice(0, idx) + meta + html.slice(idx);
}

// Construye una URL absoluta usando Host + protocolo (requiere trust proxy)
function construirUrlAbsoluta(req, ruta) {
    if (/^https?:\/\//i.test(ruta || '')) return ruta;
    const base = req.protocol + '://' + req.get('host');
    return base + (ruta || '');
}

// Convierte una imagen relativa (/uploads/slug/x.png) en absoluta
function urlAbsolutaDeImagen(req, valor) {
    if (!valor) return '';
    if (/^https?:\/\//i.test(valor)) return valor;
    return construirUrlAbsoluta(req, valor);
}

/* ============================================
   CONSULTAS A BASE DE DATOS
   ============================================ */

function buscarTiendaActiva(slug) {
    return db.prepare('SELECT id, slug, nombre, activo FROM tiendas WHERE slug = ? AND activo = 1').get(slug);
}

function existeTiendaActiva(slug) {
    return !!db.prepare('SELECT id FROM tiendas WHERE slug = ? AND activo = 1').get(slug);
}

// Tienda por defecto: prioriza el slug 'tienda1' (legacy), luego la primera activa
function obtenerTiendaPorDefecto() {
    return db.prepare("SELECT slug FROM tiendas WHERE activo = 1 ORDER BY (slug = 'tienda1') DESC, id ASC LIMIT 1").get();
}

// Devuelve el mapa clave → valor de la configuración de una tienda (sin secretos)
function obtenerConfig(tiendaId) {
    const rows = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id = ?').all(tiendaId);
    const config = {};
    rows.forEach((row) => {
        if (SECRET_CONFIG_KEYS.has(row.clave)) return;
        config[row.clave] = row.valor;
    });
    return config;
}

/* ============================================
   GENERADORES DE CONTENIDO SEO
   ============================================ */

// Título SEO: usa seo_title si existe, sino autogenera con nombre + rubro + ciudad
function generarTituloSEO(tienda, config) {
    if (config.seo_title && String(config.seo_title).trim()) {
        return String(config.seo_title).trim();
    }
    const partes = [];
    if (tienda.nombre) partes.push(String(tienda.nombre).trim());
    if (config.rubro_actividad && String(config.rubro_actividad).trim()) {
        partes.push(String(config.rubro_actividad).trim());
    }
    let titulo = partes.filter(Boolean).join(' | ');
    if (config.ciudad && String(config.ciudad).trim()) {
        titulo += ' - ' + String(config.ciudad).trim();
    }
    if (!titulo) titulo = 'Mi Shop';
    // Google muestra ~50-60 caracteres; recortamos sin cortar palabras
    if (titulo.length > 70) {
        titulo = titulo.slice(0, 67).replace(/\s+\S*$/, '') + '…';
    }
    return titulo;
}

// Descripción SEO: usa seo_description si existe, sino la descripción del negocio
function generarDescripcionSEO(tienda, config) {
    if (config.seo_description && String(config.seo_description).trim()) {
        return String(config.seo_description).trim();
    }
    let desc = '';
    if (config.tienda_descripcion && String(config.tienda_descripcion).trim()) {
        desc = String(config.tienda_descripcion).trim();
    } else if (config.hero_descripcion && String(config.hero_descripcion).trim()) {
        desc = String(config.hero_descripcion).trim();
    }
    if (!desc && config.rubro_actividad && String(config.rubro_actividad).trim()) {
        desc = 'Tienda online de ' + String(config.rubro_actividad).trim() + '.';
    }
    if (!desc) desc = 'Tienda online de ' + (tienda.nombre || 'Mi Shop');
    if (desc.length > 160) {
        desc = desc.slice(0, 157).replace(/\s+\S*$/, '') + '…';
    }
    return desc;
}

// Construye el bloque <head> SEO completo (title, meta, canonical, OG, Twitter)
function generarHeadSEO(req, tienda, config) {
    const urlCanonica = construirUrlAbsoluta(req, '/' + tienda.slug + '/');
    const titulo = generarTituloSEO(tienda, config);
    const descripcion = generarDescripcionSEO(tienda, config);
    const nombreNegocio = String(tienda.nombre || config.tienda_nombre || titulo).trim();
    const imagen = urlAbsolutaDeImagen(req, config.logo_imagen || config.hero_imagen || '');

    let html = '';
    html += '<title>' + escapeHtml(titulo) + '</title>\n';
    html += '    <meta name="description" content="' + escapeHtml(descripcion) + '">\n';
    html += '    <link rel="canonical" href="' + escapeHtml(urlCanonica) + '">\n';
    html += '\n';
    html += '    <!-- Open Graph -->\n';
    html += '    <meta property="og:type" content="website">\n';
    html += '    <meta property="og:site_name" content="' + escapeHtml(nombreNegocio) + '">\n';
    html += '    <meta property="og:title" content="' + escapeHtml(titulo) + '">\n';
    html += '    <meta property="og:description" content="' + escapeHtml(descripcion) + '">\n';
    html += '    <meta property="og:url" content="' + escapeHtml(urlCanonica) + '">\n';
    html += '    <meta property="og:locale" content="es_AR">\n';
    if (imagen) {
        html += '    <meta property="og:image" content="' + escapeHtml(imagen) + '">\n';
    }
    html += '\n';
    html += '    <!-- Twitter / X Card -->\n';
    html += '    <meta name="twitter:card" content="' + (imagen ? 'summary_large_image' : 'summary') + '">\n';
    html += '    <meta name="twitter:title" content="' + escapeHtml(titulo) + '">\n';
    html += '    <meta name="twitter:description" content="' + escapeHtml(descripcion) + '">\n';
    if (imagen) {
        html += '    <meta name="twitter:image" content="' + escapeHtml(imagen) + '">\n';
    }

    // Datos estructurados JSON-LD (Schema.org OnlineStore)
    html += generarJsonLd(tienda, config, urlCanonica, imagen);

    return html;
}

// Devuelve true solo si la URL parece un perfil real (no un placeholder como
// "https://facebook.com/" o "https://www.pagina.com/" donde el path es "/")
function esUrlSocialReal(url) {
    if (!url || !/^https?:\/\//i.test(String(url).trim())) return false;
    try {
        const u = new URL(String(url).trim());
        return !!u.pathname && u.pathname !== '/';
    } catch (e) {
        return false;
    }
}

// Genera el bloque <script type="application/ld+json"> (Schema.org OnlineStore)
// con los datos reales de la tienda. Solo incluye campos que tienen valor.
function generarJsonLd(tienda, config, urlCanonica, imagen) {
    const nombre = String(tienda.nombre || config.tienda_nombre || 'Mi Shop').trim();
    const descripcion = generarDescripcionSEO(tienda, config);

    const datos = {
        '@context': 'https://schema.org',
        '@type': 'OnlineStore',
        name: nombre,
        url: urlCanonica,
        description: descripcion,
        inLanguage: 'es-AR',
    };

    if (imagen) datos.image = imagen;

    // Redes sociales reales (se filtran placeholders con path "/")
    const redes = [...new Set(
        [config.redes_instagram, config.redes_facebook, config.redes_tiktok, config.redes_whatsapp]
            .filter(esUrlSocialReal)
    )];
    if (redes.length > 0) datos.sameAs = redes;

    // Contacto (teléfono, email) y dirección
    const telefono = String(config.whatsapp_numero || config.contacto_telefono || '').trim();
    const email = String(config.contacto_email || '').trim();
    const direccion = String(config.contacto_direccion || config.direccion_retiro || '').trim();
    const ciudad = String(config.ciudad || '').trim();

    if (telefono || email) {
        const contactPoint = { '@type': 'ContactPoint', contactType: 'customer service' };
        if (telefono) contactPoint.telephone = telefono;
        if (email) contactPoint.email = email;
        datos.contactPoint = [contactPoint];
    }

    if (direccion || ciudad) {
        const address = { '@type': 'PostalAddress', addressCountry: 'AR' };
        if (direccion) address.streetAddress = direccion;
        if (ciudad) address.addressLocality = ciudad;
        datos.address = address;
    }

    return '\n    <!-- Datos estructurados: JSON-LD (Schema.org) -->\n' +
        '    <script type="application/ld+json">' +
        jsonLdSeguro(datos) +
        '</script>\n';
}

/* ============================================
   CONTENIDO VISIBLE SERVER-SIDE (Etapa 5)
   ============================================
   La home es una SPA: hero, navbar y footer se rellenan con fetch() desde
   /api/config. Los crawlers (sin ejecutar JS) solo ven el HTML estático con
   textos genéricos de plantilla ("Mi Shop", "Descubrí tu próximo estilo"...).

   Acá esos textos se reemplazan por el contenido REAL de cada tienda usando
   la misma cadena de fallback que el cliente pero resuelta en el servidor:
     - h1 = hero_titulo  |  tienda_nombre
     - p  = hero_descripcion | tienda_descripcion | rubro_actividad
   El cliente (config.js) se ajustó para NUNCA vaciar este contenido servido
   cuando la tienda no definió sus propios textos.
   ============================================ */

// Resuelve el contenido visible de la tienda con la cadena de fallback:
//   h1: hero_titulo → tienda_nombre
//   descripción: hero_descripcion → tienda_descripcion → rubro_actividad
//   footer: tienda_nombre + tienda_descripcion (o mejor descripción disponible)
function obtenerContenidoVisible(tienda, config) {
    // El nombre editable es tienda_nombre (config); se cae a la tabla si falta.
    // 'Mi Shop' solo queda como último recurso (nunca con tienda activa real).
    const nombre = String(config.tienda_nombre || tienda.nombre || '').trim() || 'Mi Shop';
    const heroTitulo = String(config.hero_titulo || '').trim();
    const heroDescripcion = String(config.hero_descripcion || '').trim();
    const tiendaDescripcion = String(config.tienda_descripcion || '').trim();
    const rubro = String(config.rubro_actividad || '').trim();

    const h1 = heroTitulo || nombre;

    let descripcion = heroDescripcion || tiendaDescripcion;
    if (!descripcion && rubro) descripcion = rubro;

    const footerDescripcion = tiendaDescripcion || heroDescripcion || rubro;

    return {
        nombre,
        h1,
        descripcion,
        footerDescripcion,
        copyright: '\u00A9 ' + new Date().getFullYear() + ' ' + nombre + ' - Todos los derechos reservados'
    };
}

// Reemplaza un bloque por <texto> conservando los prefijo/sufijo capturados.
// Usa una función replacer: el texto se inserta de forma LITERAL (los caracteres
// "$" del contenido de la tienda no se interpretan como patrones de reemplazo).
function reemplazarBloque(html, patron, texto) {
    return html.replace(patron, function (match, prefijo, sufijo) {
        return prefijo + texto + (sufijo || '');
    });
}

// Reemplaza los textos genéricos de public/index.html por los de la tienda.
// Usa regex acotadas por estructura para no depender de marcadores en el HTML.
function inyectarContenidoVisible(html, tienda, config) {
    const c = obtenerContenidoVisible(tienda, config);
    const escape = escapeHtml;
    const nl = '\n';

    // Logo de la navbar
    html = reemplazarBloque(html,
        /(<div class="logo">)[\s\S]*?(<\/div>)/,
        escape(c.nombre)
    );

    // Alt del logo del splash
    html = reemplazarBloque(html,
        /(<img id="splashLogo"[^>]*?alt=")[^"]*(")/,
        escape('Logo de ' + c.nombre)
    );

    // Hero: <h1> visible
    html = reemplazarBloque(html,
        /(<section class="hero">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/,
        escape(c.h1)
    );

    // Hero: <p> visible (descripción)
    html = reemplazarBloque(html,
        /(<section class="hero">[\s\S]*?<\/h1>[\s\S]*?<p>)[\s\S]*?(<\/p>)/,
        escape(c.descripcion)
    );

    // Footer: nombre de la marca
    html = reemplazarBloque(html,
        /(<div class="footer-brand">[\s\S]*?<h2>)[\s\S]*?(<\/h2>)/,
        escape(c.nombre)
    );

    // Footer: descripción de la marca
    html = reemplazarBloque(html,
        /(<div class="footer-brand">[\s\S]*?<\/h2>[\s\S]*?<p>)[\s\S]*?(<\/p>)/,
        escape(c.footerDescripcion)
    );

    // Footer bottom (copyright)
    html = reemplazarBloque(html,
        /(<div class="footer-bottom">)[\s\S]*?(<\/div>)/,
        escape(c.copyright)
    );

    return html;
}

/* ============================================
   RENDERIZADO DE LA HOME DE TIENDA
   ============================================ */

// Renderiza la home pública de una tienda con su SEO inyectado en el <head>.
// Si el slug no corresponde a una tienda activa, llama a next() → 404 real.
function renderizarTienda(req, res, next, slug) {
    try {
        const tienda = buscarTiendaActiva(slug);
        if (!tienda) return next();

        const config = obtenerConfig(tienda.id);
        const htmlBase = obtenerIndexHTML();

        // Quitar el <title> estático genérico (lo reemplaza el bloque SEO)
        let html = htmlBase.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '');

        const headSEO = generarHeadSEO(req, tienda, config);
        html = inyectarEnHead(html, headSEO);

        // Etapa 5: reemplazar los textos genéricos (navbar, hero, footer) por el
        // contenido REAL de la tienda. Así el HTML inicial es indexable y específico.
        html = inyectarContenidoVisible(html, tienda, config);

        // Mismos headers que hoy (la Etapa 6 optimizará Cache-Control)
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        console.error('[SEO] Error al renderizar tienda /' + slug + '/:', err.message);
        next(err);
    }
}

/* ============================================
   robots.txt Y sitemap.xml (dinámicos)
   ============================================ */

function generarRobotsTxt(req) {
    const sitemapUrl = construirUrlAbsoluta(req, '/sitemap.xml');
    const lineas = [
        '# robots.txt generado automáticamente por el sistema',
        'User-agent: *',
        '',
        '# Zonas privadas / administración',
        'Disallow: /admin/',
        'Disallow: /*/admin/',
        'Disallow: /superadmin',
        'Disallow: /api/',
        'Disallow: /auth/',
        '',
        '# Endpoints internos (JSON / gestión)',
        'Disallow: /productos',
        'Disallow: /categorias',
        'Disallow: /pedidos',
        '',
        '# Carrito y variantes duplicadas de la home',
        'Disallow: /carrito.html',
        'Disallow: /*/carrito.html',
        'Disallow: /*/index.html',
        '',
        '# Recursos necesarios para el renderizado (permitidos)',
        'Allow: /uploads/',
        'Allow: /css/',
        'Allow: /js/',
        'Allow: /images/',
        'Allow: /favicon.ico',
        '',
        'Sitemap: ' + sitemapUrl,
        '',
    ];
    return lineas.join('\n');
}

// /sitemap.xml lista SOLO la home canónica de cada tienda activa.
// Categorías y productos se excluyen: hoy no tienen URLs propias indexables.
function generarSitemapXml(req) {
    const tiendas = db.prepare('SELECT slug FROM tiendas WHERE activo = 1 ORDER BY id ASC').all();
    const base = construirUrlAbsoluta(req, '');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    tiendas.forEach((tienda) => {
        const url = base + '/' + tienda.slug + '/';
        xml += '  <url>\n';
        xml += '    <loc>' + escapeHtml(url) + '</loc>\n';
        xml += '  </url>\n';
    });
    xml += '</urlset>';
    return xml;
}

module.exports = {
    renderizarTienda,
    existeTiendaActiva,
    obtenerTiendaPorDefecto,
    generarRobotsTxt,
    generarSitemapXml,
    inyectarNoindex,
    escapeHtml,
    jsonLdSeguro,
    construirUrlAbsoluta,
};
