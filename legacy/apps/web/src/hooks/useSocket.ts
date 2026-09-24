'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    if (!socketInstance) {
      socketInstance = io(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:4000'}/messaging`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
    }

    socketRef.current = socketInstance;
  }, []);

  return socketRef.current;
}
