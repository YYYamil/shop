(function () {
    function obtenerSlugActual() {
        return typeof obtenerSlug === 'function' ? obtenerSlug() : null;
    }

    function setEstado(estadoTexto) {
        const texto = document.getElementById('mpEstadoTexto');
        const conectar = document.getElementById('mpBloqueConectar');
        const bloqueConectado = document.getElementById('mpBloqueConectado');

        if (!texto) return;

        // Limpiar clases de estado previas
        texto.className = '';

        switch (estadoTexto) {
            case 'conectado':
                texto.textContent = 'Conectado';
                texto.style.color = '#065f46';
                if (conectar) conectar.style.display = 'none';
                if (bloqueConectado) bloqueConectado.style.display = 'flex';
                break;

            case 'expirado':
                texto.textContent = 'Token expirado — reconectar';
                texto.style.color = '#dc2626';
                if (conectar) conectar.style.display = 'block';
                if (bloqueConectado) bloqueConectado.style.display = 'none';
                break;

            case 'proximo_a_vencer':
                texto.textContent = 'Conectado (próximo a vencer)';
                texto.style.color = '#d97706';
                if (conectar) conectar.style.display = 'none';
                if (bloqueConectado) bloqueConectado.style.display = 'flex';
                break;

            case 'no_conectado':
            default:
                texto.textContent = 'No conectado';
                texto.style.color = '#dc2626';
                if (conectar) conectar.style.display = 'block';
                if (bloqueConectado) bloqueConectado.style.display = 'none';
                break;
        }
    }

    async function cargarEstado() {
        const slug = obtenerSlugActual();
        const url = slug ? '/api/mercadopago/status?slug=' + slug : '/api/mercadopago/status';

        try {
            const respuesta = await fetch(url, { credentials: 'same-origin' });
            const data = await respuesta.json().catch(() => ({}));

            if (!respuesta.ok) {
                setEstado('no_conectado');
                return;
            }

            setEstado(data.estadoTexto || (data.conectado ? 'conectado' : 'no_conectado'));
        } catch (err) {
            console.error('Error al cargar estado de Mercado Pago:', err);
            setEstado('no_conectado');
        }
    }

    async function desconectar() {
        const slug = obtenerSlugActual();
        const url = slug ? '/api/mercadopago/disconnect?slug=' + slug : '/api/mercadopago/disconnect';

        try {
            const respuesta = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
            });

            if (!respuesta.ok) {
                const data = await respuesta.json().catch(() => ({}));
                alert(data.error || 'No se pudo desconectar Mercado Pago');
                return;
            }

            await cargarEstado();
        } catch (err) {
            console.error('Error al desconectar Mercado Pago:', err);
            alert('Error de conexión al desconectar Mercado Pago');
        }
    }

    function conectar() {
        const slug = obtenerSlugActual();
        const url = slug ? '/api/mercadopago/connect?slug=' + slug : '/api/mercadopago/connect';
        window.location = url;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btnConectar = document.getElementById('btnConectarMp');
        const btnDesconectar = document.getElementById('btnDesconectarMp');

        btnConectar?.addEventListener('click', conectar);
        btnDesconectar?.addEventListener('click', desconectar);

        cargarEstado();
    });
})();
