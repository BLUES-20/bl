// db.js
const mysql = require('mysql2');

// Create a connection to MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',           // <-- put your username here
  password: 'Hammad@1007', // <-- put your MySQL password here
  database: 'school_management'
});


// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ MySQL Connected');
  }
});

module.exports = db;
