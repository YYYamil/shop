(function () {
    function crearLinkMercadoPago() {
        if (typeof obtenerRutaAdmin !== 'function') return;

        const nav = document.getElementById('sidebarNav');
        if (!nav) return;

        if (nav.querySelector('[data-page="mercadopago"]')) return;

        const link = document.createElement('a');
        link.href = obtenerRutaAdmin('mercadopago.html');
        link.className = 'nav-link';
        link.dataset.page = 'mercadopago';
        link.textContent = '💳 Activar método de pago';

        const personalizacion = nav.querySelector('[data-page="personalizacion"]');
        if (personalizacion && personalizacion.parentNode) {
            personalizacion.insertAdjacentElement('afterend', link);
        } else {
            nav.appendChild(link);
        }

        if (window.location.pathname.includes('/mercadopago.html')) {
            link.classList.add('active');
        }
    }

    document.addEventListener('DOMContentLoaded', crearLinkMercadoPago);
})();
