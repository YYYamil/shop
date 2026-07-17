(function () {
    function obtenerSlugActual() {
        return typeof obtenerSlug === 'function' ? obtenerSlug() : null;
    }

    function setEstado(estadoConectado) {
        const texto = document.getElementById('mpEstadoTexto');
        const conectar = document.getElementById('mpBloqueConectar');
        const bloqueConectado = document.getElementById('mpBloqueConectado');

        if (texto) {
            texto.textContent = estadoConectado ? 'Conectado' : 'No conectado';
        }
        if (conectar) {
            conectar.style.display = estadoConectado ? 'none' : 'block';
        }
        if (bloqueConectado) {
            bloqueConectado.style.display = estadoConectado ? 'flex' : 'none';
        }
    }

    async function cargarEstado() {
        const slug = obtenerSlugActual();
        const url = slug ? '/api/mercadopago/status?slug=' + slug : '/api/mercadopago/status';

        try {
            const respuesta = await fetch(url, { credentials: 'same-origin' });
            const data = await respuesta.json().catch(() => ({}));

            if (!respuesta.ok) {
                setEstado(false);
                return;
            }

            setEstado(Boolean(data.conectado));
        } catch (err) {
            console.error('Error al cargar estado de Mercado Pago:', err);
            setEstado(false);
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
