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
const SESSION_KEY = "cuevote_session_token";
const ACKABLE_TYPES = ["VOTE", "SUGGEST_SONG", "JOIN_ROOM"];
const QUEUEABLE_TYPES = ["VOTE", "SUGGEST_SONG", "JOIN_ROOM", "PLAY_PAUSE", "NEXT_TRACK"];

export function WebSocketProvider({ children }) {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastErrorCode, setLastErrorCode] = useState(null);
  const [lastErrorTimestamp, setLastErrorTimestamp] = useState(0);
  const errorClearTimer = useRef(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [user, setUser] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const sessionTokenRef = useRef(localStorage.getItem(SESSION_KEY));
  const [clientId] = useState(() => {
    let id = localStorage.getItem("cuevote_client_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random()}`;
      localStorage.setItem("cuevote_client_id", id);
    }
    const tabId = sessionStorage.getItem("cuevote_tab_id") ||
      (crypto.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random()}`);
    sessionStorage.setItem("cuevote_tab_id", tabId);
    return `${id}_${tabId}`;
  });

  const ws = useRef(null);
  const messageQueue = useRef([]);
  const pendingAcks = useRef(new Map());
  const ackCounter = useRef(0);
  const progressRef = useRef(0);

  const sendMessage = useCallback((message) => {
    const isAckable = ACKABLE_TYPES.includes(message.type);
    if (isAckable) {
      const msgId = `${++ackCounter.current}`;
      message = { ...message, msgId };
      pendingAcks.current.set(msgId, { message, timestamp: Date.now() });
      setTimeout(() => { pendingAcks.current.delete(msgId); }, 10000);
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else if (QUEUEABLE_TYPES.includes(message.type)) {
      if (messageQueue.current.length < 50) {
        messageQueue.current.push(message);
      }
    }
  }, []);

  const handleLoginSuccess = useCallback((tokenResponse) => {
    console.log("Sending Access Token to Backend...", tokenResponse);
    sendMessage({ type: "LOGIN", payload: { token: tokenResponse.access_token } });
  }, [sendMessage]);

  const handleLogout = useCallback(() => {
    const token = sessionTokenRef.current;
    if (token) {
      sendMessage({ type: "LOGOUT", payload: { token } });
      sessionTokenRef.current = null;
      localStorage.removeItem(SESSION_KEY);
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
          sessionTokenRef.current = lastMessage.payload.sessionToken;
          localStorage.setItem(SESSION_KEY, lastMessage.payload.sessionToken);
        }
      } else if (lastMessage.type === "SESSION_INVALID") {
        console.warn("Session Invalid/Expired");
        sessionTokenRef.current = null;
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    let reconnectTimeout = null;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 10000;
    let lastResumeTime = 0;

    let activePingInterval = null;
    let activeVisibilityHandler = null;
    let activeOnlineHandler = null;

    const cleanupConnectionListeners = () => {
      if (activePingInterval) { clearInterval(activePingInterval); activePingInterval = null; }
      if (activeVisibilityHandler) { document.removeEventListener('visibilitychange', activeVisibilityHandler); activeVisibilityHandler = null; }
      if (activeOnlineHandler) { window.removeEventListener('online', activeOnlineHandler); activeOnlineHandler = null; }
    };

    const connect = () => {
      cleanupConnectionListeners();

      const wsUrl = new URL(WEBSOCKET_URL);
      wsUrl.searchParams.append("clientId", clientId);

      const socket = new WebSocket(wsUrl.toString());
      ws.current = socket;

      const handleOpen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setReconnectAttempt(0);
        reconnectDelay = 1000;
        const token = sessionTokenRef.current;
        if (token) {
          socket.send(JSON.stringify({ type: "RESUME_SESSION", payload: { token } }));
        }
        while (messageQueue.current.length > 0) {
          const queued = messageQueue.current.shift();
          socket.send(JSON.stringify(queued));
        }
      };

      const handleClose = () => {
        console.log("WebSocket disconnected");
        cleanupConnectionListeners();
        setIsConnected(false);
        setReconnectAttempt(prev => prev + 1);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, reconnectDelay);
        const jitter = Math.random() * 0.3 * reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2 + jitter, MAX_RECONNECT_DELAY);
      };

      const handleError = (error) => {
        console.error("WebSocket error:", error);
      };

      const handleMessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "PONG") {
            const latency = Date.now() - (socket.lastPingSent || Date.now());
            socket.lastPong = Date.now();
            if (latency < 300) setConnectionQuality('good');
            else if (latency < 1000) setConnectionQuality('fair');
            else setConnectionQuality('poor');
            return;
          }

          if (message.type === "ACK") {
            pendingAcks.current.delete(message.msgId);
            return;
          }

          if (message.type === "state") {
            setState(message.payload);
            progressRef.current = message.payload.progress || 0;
          } else if (message.type === "state_delta") {
            setState(prev => prev ? { ...prev, ...message.payload } : message.payload);
            if ('progress' in message.payload) {
              progressRef.current = message.payload.progress || 0;
            }
          } else if (message.type === "progress") {
            progressRef.current = message.payload;
          } else {
            setLastMessage(message);
            if (message.type === "error") {
              if (errorClearTimer.current) clearTimeout(errorClearTimer.current);
              setLastError(message.message);
              setLastErrorCode(message.code || null);
              setLastErrorTimestamp(Date.now());
              console.warn("[CLIENT TRACE] <<< ERROR:", message.message);
              errorClearTimer.current = setTimeout(() => {
                setLastError(null);
                setLastErrorCode(null);
                errorClearTimer.current = null;
              }, 5000);
            }
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          if (errorClearTimer.current) clearTimeout(errorClearTimer.current);
          setLastError("JSON PARSE ERROR: " + error.message);
          setLastErrorTimestamp(Date.now());
          errorClearTimer.current = setTimeout(() => {
            setLastError(null);
            setLastErrorCode(null);
            errorClearTimer.current = null;
          }, 5000);
        }
      };

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleError);
      socket.addEventListener("message", handleMessage);

      socket.lastPong = Date.now();
      let wasHidden = false;

      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          if (wasHidden) return;

          socket.lastPingSent = Date.now();
          socket.send(JSON.stringify({ type: "PING" }));

          const now = Date.now();
          const inGracePeriod = lastResumeTime > 0 && (now - lastResumeTime < 15000);
          if (!inGracePeriod && socket.lastPong && (now - socket.lastPong > 12000)) {
            console.warn("[WS] Heartbeat timeout! No PONG in 12s. Force closing.");
            socket.close();
          }
        }
      }, 5000);
      activePingInterval = pingInterval;

      const handleResume = () => {
        lastResumeTime = Date.now();

        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "PING" }));
          } catch (e) { /* socket may be closing */ }

          setTimeout(() => {
            if (socket.readyState !== WebSocket.OPEN) return;
            if (Date.now() - (socket.lastPong || 0) > 8000) {
              console.warn("[WS] Connection stale after resume. Reconnecting.");
              socket.close();
            }
          }, 4000);
        } else if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectDelay = 1000;
          reconnectTimeout = setTimeout(connect, 500);
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          wasHidden = false;
          handleResume();
        } else {
          wasHidden = true;
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      activeVisibilityHandler = handleVisibilityChange;

      const handleOnline = () => {
        console.log("[WS] Browser came back online. Reconnecting immediately.");
        if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectDelay = 1000;
          reconnectTimeout = setTimeout(connect, 300);
        } else if (socket.readyState === WebSocket.OPEN) {
          handleResume();
        }
      };
      window.addEventListener('online', handleOnline);
      activeOnlineHandler = handleOnline;

      window.cuevoteReconnect = handleResume;
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      cleanupConnectionListeners();
      delete window.cuevoteReconnect;
      if (ws.current) {
        try { ws.current.close(); } catch (e) { /* already closed */ }
      }
    };
  }, [clientId]);

  return (
    <WebSocketContext.Provider value={{ state, isConnected, sendMessage, lastError, lastErrorCode, lastErrorTimestamp, lastMessage, clientId, user, handleLoginSuccess, handleLogout, clearMessage: () => setLastMessage(null), reconnectAttempt, forceReconnect: () => { if (window.cuevoteReconnect) window.cuevoteReconnect(); }, connectionQuality, progressRef }}>
      {children}
    </WebSocketContext.Provider>
  );
}
