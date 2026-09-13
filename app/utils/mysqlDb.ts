import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  queueLimit: 100,
  enableKeepAlive: true,
});

// const pool = mysql.createPool({
//   host: 'localhost',
//   user: "root",
//   password: "",
//   database: "eventpro",
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
//   });

export default pool;
