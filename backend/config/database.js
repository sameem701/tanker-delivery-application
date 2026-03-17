const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required in environment variables');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const query = (text, params = []) => pool.query(text, params);

const closePool = async () => {
  await pool.end();
};

module.exports = {
  query,
  closePool
};
