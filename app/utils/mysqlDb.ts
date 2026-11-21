import mysql, { type Pool } from "mysql2/promise";

const databaseRuntime = globalThis as typeof globalThis & { thanafusMysqlPool?: Pool };
const configuredLimit = Number(process.env.MYSQL_CONNECTION_LIMIT || 3);
const connectionLimit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 3;

// Reuse the pool across module reloads and route bundles in the same process.
// Each server instance still has its own pool.
const pool = databaseRuntime.thanafusMysqlPool ?? mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit,
  maxIdle: connectionLimit,
  queueLimit: 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

databaseRuntime.thanafusMysqlPool = pool;

export default pool;
