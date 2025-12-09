import { useContext } from 'react';
import { WebSocketContext } from '../contexts/WebSocketContext';

export function useWebSocketContext() {
	return useContext(WebSocketContext);
}
