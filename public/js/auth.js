async function logout() {

    await fetch('/auth/logout', {

        credentials: 'same-origin'

    });

    // Redirigir según la ruta actual
    const pathname = window.location.pathname;
    if (pathname.startsWith('/superadmin')) {
        window.location = '/superadmin/login.html';
    } else {
        // Detectar si estamos en /:slug/admin/... para redirigir al login de esa tienda
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && parts[1] === 'admin') {
            // Estamos en /:slug/admin/... → redirigir a /:slug/admin/login.html
            window.location = '/' + parts[0] + '/admin/login.html';
        } else {
            window.location = '/admin/login.html';
        }
    }

}



async function verificarAuth() {

    try {

        const respuesta = await fetch(

            '/auth/verificar',

            {

                credentials: 'same-origin'

            }

        );



        if (respuesta.status === 401) {

            // Detectar si estamos en superadmin o admin de tienda
            const pathname = window.location.pathname;
            if (pathname.startsWith('/superadmin')) {
                window.location = '/superadmin/login.html';
            } else {
                window.location = '/admin/login.html';
            }
            return false;
        }

        // Verificar si es superadmin y mostrar el link en la sidebar
        // SOLO si NO estamos en una ruta de admin de tienda (el superadmin tiene su propio panel)
        try {
            const data = await respuesta.clone().json();
            const pathname = window.location.pathname;
            // Solo mostrar link SuperAdmin si estamos en /superadmin/ (no en /:slug/admin/)
            if (data.user && data.user.es_superadmin && pathname.startsWith('/superadmin')) {
                const link = document.getElementById('linkSuperAdmin');
                if (link) link.style.display = 'block';
            }
        } catch(e) {
            // Ignorar error de parseo
        }

        return true;

    }

    catch(error) {

        console.log(error);
        return false;

    }

}
