const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'keykoders-db.chcm6c8cud45.eu-north-1.rds.amazonaws.com',
  user: 'admin',
  password: 'Keykoders', // use your password
  database: 'keykoders', // your database name
});

module.exports = db;
