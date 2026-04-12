import { io } from 'socket.io-client';
import { API_BASE_URL } from '../constants/config';

// Connect to backend root url, removing /api path from base if there is one
const SOCKET_URL = API_BASE_URL.replace(/\/api\/app$|\/api$/, '') || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Wait until we have a logged-in user
});
