import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/compliance`, {
      auth: { token: getAccessToken() },
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
