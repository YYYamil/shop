/* Backup SQLite previo a cambios del BLOQUE 5 */
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const outDir = path.join(__dirname, 'backups');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(outDir, 'database_pre_bloque5_' + ts + '.db');

fs.copyFileSync(dbPath, dest);
console.log('BACKUP_OK ' + dest);
console.log('SIZE ' + fs.statSync(dest).size);
