import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketContext } from './WebSocketContext';

const WEBSOCKET_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export function WebSocketProvider({ children }) {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [clientId] = useState(() => {
    let id = localStorage.getItem("revibe_client_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random()}`;
      localStorage.setItem("revibe_client_id", id);
    }
    return id;
  });

  const ws = useRef(null);

  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  // message listener logic moved to useEffect

  const handleLoginSuccess = useCallback((tokenResponse) => {
    console.log("Sending Access Token to Backend...", tokenResponse);
    sendMessage({ type: "LOGIN", payload: { token: tokenResponse.access_token } });
  }, [sendMessage]);

  const handleLogout = useCallback(() => {
    const token = localStorage.getItem("revibe_auth_token");
    if (token) {
      sendMessage({ type: "LOGOUT", payload: { token } });
      localStorage.removeItem("revibe_auth_token");
    }
    setUser(null);
  }, [sendMessage]);

  // Handle Messages (Auth)
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === "LOGIN_SUCCESS") {
        console.log("Backend Login Success:", lastMessage.payload.user);
        setUser(lastMessage.payload.user);
        if (lastMessage.payload.sessionToken) {
          localStorage.setItem("revibe_auth_token", lastMessage.payload.sessionToken);
        }
      } else if (lastMessage.type === "SESSION_INVALID") {
        console.warn("Session Invalid/Expired");
        localStorage.removeItem("revibe_auth_token");
        setUser(null);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    let reconnectTimeout = null;

    const connect = () => {
      const wsUrl = new URL(WEBSOCKET_URL);
      wsUrl.searchParams.append("clientId", clientId);

      const socket = new WebSocket(wsUrl.toString());
      ws.current = socket;

      const handleOpen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        // Try to resume session on connect
        const token = localStorage.getItem("revibe_auth_token");
        if (token) {
          socket.send(JSON.stringify({ type: "RESUME_SESSION", payload: { token } }));
        }
      };

      const handleClose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      const handleError = (error) => {
        console.error("WebSocket error:", error);
      };

      const handleMessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message); // Broadcast all messages
          if (message.type === "state") {
            console.log(`[CLIENT TRACE] <<< INCOMING STATE. RoomId: ${message.payload.roomId}`);
            setState(message.payload);
          } else if (message.type === "error") {
            setLastError(message.message);
            console.warn("[CLIENT TRACE] <<< ERROR:", message.message);
            setTimeout(() => setLastError(null), 5000);
          } else if (message.type === "INFO") {
            console.log("[CLIENT TRACE] <<< INFO:", message.payload);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          setLastError("JSON PARSE ERROR: " + error.message);
        }
      };

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleError);
      socket.addEventListener("message", handleMessage);

      // Cleanup listeners on close is handled by standard garbage collection if checks are mostly ensuring single instance?
      // Actually, we must manually cleanup if we were re-running this function, but this function runs inside `connect`.
      // The `cleanup` logic in useEffect handles the `ws.close()`.
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws.current) {
        // We can't easily remove specific listeners here without lifting functions out, but closing the socket removes listeners automatically attached to it.
        ws.current.close();
      }
    };
  }, [clientId]);

  return (
    <WebSocketContext.Provider value={{ state, isConnected, sendMessage, lastError, lastMessage, clientId, user, handleLoginSuccess, handleLogout }}>
      {children}
    </WebSocketContext.Provider>
  );
}
