document.addEventListener('DOMContentLoaded', () => {
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    const form = document.getElementById('registroForm');
    const errorBox = document.getElementById('errorBox');
    const nombreInput = document.getElementById('nombre');
    const slugInput = document.getElementById('slug');
    const emailInput = document.getElementById('email');
    const usuarioInput = document.getElementById('usuario');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const btnCrear = document.getElementById('btnCrear');
    const slugHint = document.getElementById('slugHint');

    function slugDesdeNombre(nombre) {
        return nombre
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function setUrlPreview() {
        const nombre = nombreInput.value;
        const slug = slugInput.value.trim() || slugDesdeNombre(nombre) || 'tu-tienda';
        const preview = document.getElementById('urlPreview');
        if (preview) {
            preview.textContent = window.location.host + '/' + slug + '/';
        }
    }

    function resetSlugHint() {
        slugHint.className = 'hint';
        slugHint.innerHTML = 'Tu tienda quedará en <span class="url" id="urlPreview">tu-dominio.com/tu-tienda/</span>';
    }

    function clearInvalidFields() {
        [nombreInput, emailInput, usuarioInput, passwordInput].forEach((field) => field?.removeAttribute('aria-invalid'));
    }

    function mostrarError(message, field) {
        if (field) field.setAttribute('aria-invalid', 'true');
        errorBox.textContent = message;
        errorBox.hidden = false;
        errorBox.focus();
    }

    function limpiarError() {
        errorBox.hidden = true;
        clearInvalidFields();
    }

    togglePassword?.addEventListener('click', () => {
        const mostrar = passwordInput.type === 'password';
        passwordInput.type = mostrar ? 'text' : 'password';
        togglePassword.setAttribute('aria-pressed', String(mostrar));
        togglePassword.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
        document.getElementById('iconEye').classList.toggle('visible', mostrar);
        document.getElementById('iconEyeOff').classList.toggle('visible', !mostrar);
        passwordInput.focus();
    });

    let slugTocado = false;
    nombreInput.addEventListener('input', () => {
        if (!slugTocado) {
            slugInput.value = slugDesdeNombre(nombreInput.value);
            resetSlugHint();
        }
        setUrlPreview();
    });

    slugInput.addEventListener('input', () => {
        slugTocado = true;
        resetSlugHint();
        setUrlPreview();
        validarSlug();
    });

    slugInput.addEventListener('blur', () => {
        if (!slugInput.value.trim()) slugTocado = false;
    });

    let timerSlug = null;
    function validarSlug() {
        const slug = slugInput.value.trim();
        if (!slug) {
            resetSlugHint();
            setUrlPreview();
            return;
        }

        clearTimeout(timerSlug);
        timerSlug = setTimeout(async () => {
            try {
                const response = await fetch('/api/saas/disponibilidad?slug=' + encodeURIComponent(slug));
                const data = await response.json();
                if (!data.valido || data.reservado) {
                    slugHint.className = 'hint error';
                    slugHint.textContent = 'Ese identificador no está disponible o está reservado.';
                } else if (!data.disponible) {
                    slugHint.className = 'hint error';
                    slugHint.textContent = 'Ese identificador ya está en uso.';
                } else {
                    slugHint.className = 'hint ok';
                    slugHint.textContent = '¡Disponible! Tu tienda quedará en /' + slug + '/';
                }
            } catch (error) {
                resetSlugHint();
                setUrlPreview();
            }
        }, 350);
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        limpiarError();

        const nombre = nombreInput.value.trim();
        const slug = slugInput.value.trim();
        const email = emailInput.value.trim();
        const usuario = usuarioInput.value.trim();
        const password = passwordInput.value;

        if (!nombre) { mostrarError('Ingresá el nombre de tu tienda.', nombreInput); return; }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { mostrarError('Ingresá un correo electrónico válido.', emailInput); return; }
        if (!usuario) { mostrarError('Ingresá un nombre de usuario.', usuarioInput); return; }
        if (password.length < 6) { mostrarError('La contraseña debe tener al menos 6 caracteres.', passwordInput); return; }

        btnCrear.disabled = true;
        btnCrear.textContent = 'Creando tu tienda…';

        try {
            const response = await fetch('/api/saas/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, slug, usuario, email, password })
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                mostrarError(data.error || 'No se pudo crear tu tienda. Intentá de nuevo.');
                btnCrear.disabled = false;
                btnCrear.textContent = 'Crear mi tienda gratis';
                return;
            }

            window.location.href = '/' + data.tiendaSlug + '/admin/dashboard.html';
        } catch (error) {
            mostrarError('Error de conexión. Revisá tu internet e intentá de nuevo.');
            btnCrear.disabled = false;
            btnCrear.textContent = 'Crear mi tienda gratis';
        }
    });
});
