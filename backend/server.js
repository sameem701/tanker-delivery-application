const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { closePool } = require('./config/database');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

app.use('/api/app', require('./routes/startupRoutes'));
app.use('/api/customer', require('./routes/customerRoutes'));
app.use('/api/driver', require('./routes/driverRoutes'));
app.use('/api/supplier', require('./routes/supplierRoutes'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(port, () => {
  console.log('Server listening on port ' + port);
});

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

