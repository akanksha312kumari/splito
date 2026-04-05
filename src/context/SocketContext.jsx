import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('splito_token');
    
    // Only connect if there's a token and a user
    if (token && user) {
      const url = import.meta.env.VITE_SOCKET_URL || '/';
      const newSocket = io(url, {
        auth: { token },
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connect_error:', err);
      });

      // Global notification handler for toaster
      newSocket.on('notification', (data) => {
        toast.info(data.title + ': ' + data.body);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Re-evaluate when user logs in/out

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
