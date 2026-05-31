const { Server } = require('socket.io');
const { query } = require('./config/database');

let _io = null;

function init(httpServer) {
  _io = new Server(httpServer, {
    cors: { origin: '*', credentials: true }
  });

  _io.on('connection', async (socket) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const sessionResult = await query('SELECT check_session($1) AS result', [token]);
      const sessionResponse = sessionResult.rows[0]?.result;

      if (!sessionResponse || sessionResponse.code !== 1 || !sessionResponse.user_id) {
        socket.disconnect(true);
        return;
      }

      const userId = sessionResponse.user_id;
      socket.join(`user_${userId}`);

      const roleResult = await query('SELECT role FROM users WHERE user_id = $1', [userId]);
      const role = roleResult.rows[0]?.role;
      if (role === 'supplier') {
        socket.join('suppliers');
      }

      // When a driver connects, notify all their linked suppliers
      if (role === 'driver') {
        try {
          const suppliersResult = await query(
            'SELECT DISTINCT supplier_user_id FROM supplier_drivers WHERE driver_user_id = $1',
            [userId]
          );
          const suppliers = suppliersResult.rows || [];
          suppliers.forEach((sup) => {
            const supplierUserId = sup.supplier_user_id;
            if (supplierUserId) {
              _io.to(`user_${supplierUserId}`).emit('available_drivers_updated', {
                driver_id: userId,
                event_type: 'driver_came_online'
              });
            }
          });
        } catch (err) {
          console.error('[Socket] Error notifying suppliers of driver connection:', err.message);
        }
      }

      console.log(`[Socket] User ${userId} (${role || 'unknown'}) connected (socket ${socket.id})`);

      socket.on('disconnect', () => {
        console.log(`[Socket] User ${userId} disconnected`);
      });
    } catch (err) {
      console.error('[Socket] Auth error:', err.message);
      socket.disconnect(true);
    }
  });

  return _io;
}

function emitToUser(userId, event, payload) {
  if (_io && userId) {
    _io.to(`user_${userId}`).emit(event, payload);
  }
}

function emitToSuppliers(event, payload) {
  if (_io) {
    _io.to('suppliers').emit(event, payload);
  }
}

module.exports = { init, emitToUser, emitToSuppliers };
