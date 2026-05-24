// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import { useContext } from 'react';
import { WebSocketContext } from '../contexts/WebSocketContext';

export function useWebSocketContext() {
	return useContext(WebSocketContext);
}
