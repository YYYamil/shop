/* ===== SIDEBAR SLUG PREFIX ===== */
// Prefija los links de la sidebar con el slug de la tienda actual
// Ej: /admin/dashboard.html → /tienda1/admin/dashboard.html

document.addEventListener('DOMContentLoaded', function() {
    // Obtener slug desde la URL actual
    const match = window.location.pathname.match(/^\/([a-z0-9-]+)\/admin\//);
    const slug = match ? match[1] : null;
    
    if (slug) {
        // Prefijar todos los links de navegación del sidebar
        document.querySelectorAll('.nav-link').forEach(function(link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/admin/')) {
                link.href = '/' + slug + href;
            }
        });
    }
});
