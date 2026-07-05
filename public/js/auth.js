async function logout() {

    await fetch('/auth/logout', {

        credentials: 'same-origin'

    });

    // Redirigir según la ruta actual
    if (esSuperadmin()) {
        window.location = '/superadmin/login.html';
    } else {
        window.location = obtenerRutaLogin();
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

            // Redirigir según la ruta actual
            if (esSuperadmin()) {
                window.location = '/superadmin/login.html';
            } else {
                window.location = obtenerRutaLogin();
            }
            return false;
        }

        // Verificar si es superadmin y mostrar el link en la sidebar
        // SOLO si NO estamos en una ruta de admin de tienda (el superadmin tiene su propio panel)
        try {
            const data = await respuesta.clone().json();
            // Solo mostrar link SuperAdmin si estamos en /superadmin/ (no en /:slug/admin/)
            if (data.user && data.user.es_superadmin && esSuperadmin()) {
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
