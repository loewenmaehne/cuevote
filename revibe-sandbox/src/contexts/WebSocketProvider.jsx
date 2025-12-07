import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const WebSocketContext = createContext(null);

const WEBSOCKET_URL = "ws://localhost:8080";

export function WebSocketProvider({ children }) {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [clientId, setClientId] = useState(() => {
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
      
      ws.current = new WebSocket(wsUrl.toString());

      ws.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        // Try to resume session on connect
        const token = localStorage.getItem("revibe_auth_token");
        if (token) {
            ws.current.send(JSON.stringify({ type: "RESUME_SESSION", payload: { token } }));
        }
      };

      ws.current.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message); // Broadcast all messages

          if (message.type === "state") {
            console.log("WebSocket State Update:", message.payload.roomId);
            setState(message.payload);
          } else if (message.type === "error") {
            setLastError(message.message);
            setTimeout(() => setLastError(null), 5000);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error, event.data);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws.current) ws.current.close();
    };
  }, [clientId]);

  return (
    <WebSocketContext.Provider value={{ state, isConnected, sendMessage, lastError, lastMessage, clientId, user, handleLoginSuccess, handleLogout }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}
