async function logout() {

    await fetch('/auth/logout', {

        credentials: 'same-origin'

    });



    window.location = '/admin/login.html';

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

            window.location = '/admin/login.html';

        }

    }

    catch(error) {

        console.log(error);

    }

}