import { useState, useEffect, useRef } from "react";

export function useWebSocket(url) {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  
  // Persistent Client ID
  const [clientId] = useState(() => {
    let id = localStorage.getItem("revibe_client_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random()}`;
      localStorage.setItem("revibe_client_id", id);
    }
    return id;
  });

  const ws = useRef(null);

  useEffect(() => {
    if (!url) return;

    let reconnectTimeout = null;

    const connect = () => {
      // Append Client ID to URL
      const wsUrl = new URL(url);
      wsUrl.searchParams.append("clientId", clientId);
      
      ws.current = new WebSocket(wsUrl.toString());

      ws.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      ws.current.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        reconnectTimeout = setTimeout(() => {
          console.log("Reconnecting WebSocket...");
          connect();
        }, 5000); // Reconnect after 5 seconds
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message); // Expose all messages for event handling

          if (message.type === "state") {
            setState(message.payload);
          } else if (message.type === "error") {
            setLastError(message.message);
            setTimeout(() => setLastError(null), 5000);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.current) {
        ws.current.onclose = () => {}; // prevent reconnecting
        ws.current.close();
      }
    };
  }, [url, clientId]);

  const sendMessage = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { state, isConnected, sendMessage, lastError, clientId, lastMessage };
}
