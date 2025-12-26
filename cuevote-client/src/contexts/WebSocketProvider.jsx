import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketContext } from './WebSocketContext';

const getWebSocketUrl = () => {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) return envUrl;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;

  // Development / Localhost: Default to port 8080
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2') {
    return `${protocol}//${hostname}:8080`;
  }

  // Production (cuevote.com): Use same host, standard ports (handled by Nginx/Proxy)
  return `${protocol}//${hostname}/ws`;
};

const WEBSOCKET_URL = getWebSocketUrl();

export function WebSocketProvider({ children }) {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastErrorCode, setLastErrorCode] = useState(null);
  const [lastErrorTimestamp, setLastErrorTimestamp] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [clientId] = useState(() => {
    let id = localStorage.getItem("cuevote_client_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random()}`;
      localStorage.setItem("cuevote_client_id", id);
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
    const token = localStorage.getItem("cuevote_auth_token");
    if (token) {
      sendMessage({ type: "LOGOUT", payload: { token } });
      localStorage.removeItem("cuevote_auth_token");
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
          localStorage.setItem("cuevote_auth_token", lastMessage.payload.sessionToken);
        }
      } else if (lastMessage.type === "SESSION_INVALID") {
        console.warn("Session Invalid/Expired");
        localStorage.removeItem("cuevote_auth_token");
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
        const token = localStorage.getItem("cuevote_auth_token");
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

          if (message.type === "PONG") {
            // console.log("[WS] PONG received");
            // Heartbeat valid, handled in the interval check logic implicitly by liveness timestamp?
            // Actually, we need to let the loop know.
            // Let's us a ref on the outer scope of connect or just a property on the socket?
            socket.lastPong = Date.now();
            return;
          }

          if (message.type === "state") {
            // console.log(`[CLIENT TRACE] <<< INCOMING STATE. RoomId: ${message.payload.roomId}`);
            setState(message.payload);
          } else {
            setLastMessage(message); // Broadcast non-state messages (events)
            if (message.type === "error") {
              setLastError(message.message);
              setLastErrorCode(message.code || null);
              setLastErrorTimestamp(Date.now());
              console.warn("[CLIENT TRACE] <<< ERROR:", message.message);
              setTimeout(() => {
                setLastError(null);
                setLastErrorCode(null);
              }, 5000);
            } else if (message.type === "INFO") {
              // console.log("[CLIENT TRACE] <<< INFO:", message.payload);
            }
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          setLastError("JSON PARSE ERROR: " + error.message);
          setLastErrorTimestamp(Date.now());
        }
      };

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleError);
      socket.addEventListener("message", handleMessage);

      // Heartbeat Loop (Aggressive)
      // Send PING every 5s. If lastPong > 5s + threshold, kill it.
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "PING" }));

          // Check for timeout (only if we have sent at least one ping before?)
          // If lastPong was ages ago, we might be dead.
          // Give 2s grace period for network latency on the Pong.
          const now = Date.now();
          if (socket.lastPong && (now - socket.lastPong > 7000)) {
            console.warn("[WS] Heartbeat timeout! No PONG in 7s. Force closing.");
            socket.close();
          }
        }
      }, 5000); // 5s Interval

      // Initialize lastPong to avoid immediate kill
      socket.lastPong = Date.now();

      // Cleanup listeners on close is handled by standard garbage collection if checks are mostly ensuring single instance?
      // Actually, we must manually cleanup if we were re-running this function, but this function runs inside `connect`.
      // The `cleanup` logic in useEffect handles the `ws.close()`.

      // Monkey-patch close to clear interval logic inside this scope
      const originalClose = socket.close.bind(socket);
      socket.close = () => {
        clearInterval(pingInterval);
        originalClose();
      };
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
    <WebSocketContext.Provider value={{ state, isConnected, sendMessage, lastError, lastErrorCode, lastErrorTimestamp, lastMessage, clientId, user, handleLoginSuccess, handleLogout, clearMessage: () => setLastMessage(null) }}>
      {children}
    </WebSocketContext.Provider>
  );
}
