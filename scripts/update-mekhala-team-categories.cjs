const path = require('node:path');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'));
const mysql = require('mysql2/promise');
const categories = 'subJunior,junior,senior,higher';
(async () => {
  const connection = await mysql.createConnection({host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, connectTimeout: 10000});
  try {
    await connection.beginTransaction();
    const [before] = await connection.query('SELECT id, jamiaNo, name, categories FROM campus ORDER BY id FOR UPDATE');
    if (!before.length || !['NIM - VILLANI', 'DUM - ANAKKALLU', 'DIM - ANITHOTTAM'].every(name => before.some(team => team.name === name))) throw new Error('Unexpected database: expected Mekhala teams missing');
    console.log(JSON.stringify({totalTeams: before.length, categories, changes: before.filter(team => team.categories !== categories)}, null, 2));
    if (!process.argv.includes('--apply')) { await connection.rollback(); return; }
    for (const team of before) {
      await connection.execute('UPDATE campus SET categories = ? WHERE id = ?', [categories, team.id]);
    }
    const [after] = await connection.query('SELECT id, jamiaNo, name, categories FROM campus ORDER BY id');
    if (after.length !== before.length || after.some((team, i) => team.categories !== categories || team.id !== before[i].id || team.jamiaNo !== before[i].jamiaNo || team.name !== before[i].name)) throw new Error('Verification failed');
    await connection.commit();
    const [verified] = await connection.query('SELECT categories, COUNT(*) AS teams FROM campus GROUP BY categories');
    console.log(JSON.stringify({committed: true, verified}));
  } catch (error) { await connection.rollback(); throw error; }
  finally { await connection.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
