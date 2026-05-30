// Script para arreglar la configuración de Adidas (tienda_id=5)
// y poner SuperAdmin con tienda_id=NULL
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new Database(dbPath);

console.log('=== DIAGNÓSTICO INICIAL ===');

// 1. Ver SuperAdmin
const sa = db.prepare('SELECT id, usuario, tienda_id, es_superadmin FROM usuarios WHERE id=1').get();
console.log('SuperAdmin:', JSON.stringify(sa));

// 2. Ver config actual de Adidas
const adidasConfig = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id=5').all();
console.log('\nAdidas config actual:');
adidasConfig.forEach(r => console.log('  ' + r.clave + '=' + r.valor));

// 3. Ver qué claves tiene deportes-rodriguez (referencia)
const refConfig = db.prepare('SELECT clave, tipo, grupo FROM configuracion WHERE tienda_id=3 ORDER BY clave').all();
console.log('\nClaves de referencia (deportes-rodriguez):');
refConfig.forEach(r => console.log('  ' + r.clave + ' tipo=' + r.tipo + ' grupo=' + r.grupo));

console.log('\n=== ELIMINANDO CONFIG INCORRECTA DE ADIDAS ===');
db.prepare('DELETE FROM configuracion WHERE tienda_id=5').run();
console.log('Config de Adidas eliminada.');

console.log('\n=== INSERTANDO CONFIG CORRECTA PARA ADIDAS ===');

// Obtener los valores de Adidas desde las claves incorrectas (ya eliminadas, usar valores hardcodeados)
const valoresAdidas = {
    tienda_nombre: 'Adidas444',
    tienda_descripcion: 'Todo en indumentaria y calzado deportivo',
    color_primario: '#000000',
    color_secundario: '#ffffff',
    color_fondo: '#ffffff',
    color_texto: '#1f2937',
    hero_titulo: 'Adidas',
    hero_descripcion: 'Impossible Is Nothing',
    hero_imagen: '',
    logo_imagen: '',
    whatsapp_numero: '',
    whatsapp_mensaje: 'Hola, quiero información sobre sus productos',
    whatsapp_activo: 'true',
    contacto_email: '',
    contacto_telefono: '',
    contacto_direccion: '',
    redes_instagram: '',
    redes_facebook: '',
    redes_tiktok: '',
    redes_whatsapp: '',
    marquee_textos: '⚡ ENVÍOS A TODO EL PAÍS | 3 CUOTAS SIN INTERÉS | CAMBIOS Y DEVOLUCIONES',
    hero_titulo_color: '#ffffff',
    hero_fondo: '#ffffff',
    color_boton: '#000000',
    color_boton_texto: '#ffffff',
};

// Insertar con los mismos tipos que las otras tiendas
const insertStmt = db.prepare('INSERT INTO configuracion (tienda_id, clave, valor, tipo, grupo) VALUES (?, ?, ?, ?, ?)');

// Obtener tipos y grupos de la tienda de referencia (id=3)
const refRows = db.prepare('SELECT clave, tipo, grupo FROM configuracion WHERE tienda_id=3').all();

let insertadas = 0;
for (const ref of refRows) {
    const valor = valoresAdidas[ref.clave] || '';
    insertStmt.run(5, ref.clave, valor, ref.tipo, ref.grupo);
    insertadas++;
    console.log('  Insertado: ' + ref.clave + '=' + (valor || '(vacío)'));
}

console.log('\nTotal insertadas: ' + insertadas);

console.log('\n=== PONIENDO SUPERADMIN CON tienda_id=NULL ===');
db.prepare('UPDATE usuarios SET tienda_id = NULL WHERE id = 1').run();
const sa2 = db.prepare('SELECT id, usuario, tienda_id, es_superadmin FROM usuarios WHERE id=1').get();
console.log('SuperAdmin actualizado:', JSON.stringify(sa2));

console.log('\n=== VERIFICACIÓN FINAL ===');
const adidasFinal = db.prepare('SELECT clave, valor FROM configuracion WHERE tienda_id=5 ORDER BY clave').all();
console.log('Adidas config final:');
adidasFinal.forEach(r => console.log('  ' + r.clave + '=' + r.valor));

console.log('\n=== COMPLETADO ===');
db.close();
