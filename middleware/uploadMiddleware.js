const multer = require('multer');

const path = require('path');



const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, 'uploads/');

    },



    filename: (req, file, cb) => {

        const nombre =

            Date.now() + '-' + Math.round(Math.random() * 1E9) +

            path.extname(file.originalname);



        cb(null, nombre);

    }

});



const fileFilter = (req, file, cb) => {

    const tipos =

        /jpeg|jpg|png|webp/;



    const extension =

        tipos.test(

            path.extname(file.originalname)

            .toLowerCase()

        );



    const mime =

        tipos.test(file.mimetype);



    if (extension && mime) {

        return cb(null, true);

    }



    cb(

        new Error(

            'Solo imagenes jpg png webp'

        )

    );

};



const upload = multer({

    storage,



    limits: {

        fileSize: 5 * 1024 * 1024

    },



    fileFilter

});



module.exports = upload;