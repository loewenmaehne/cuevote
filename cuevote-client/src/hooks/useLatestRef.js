// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import { useRef, useEffect } from 'react';

/**
 * A ref that always holds the most recent value.
 *
 * The YouTube player binds its event handlers once at construction, so they
 * close over whatever the state was at that moment. Reading through a ref is
 * how those handlers see current values instead of stale ones — which is why
 * this component keeps a mirror of half a dozen pieces of state.
 *
 * Each mirror used to be its own `useRef` plus its own `useEffect`. They are
 * identical, they can only be got wrong (a mismatched dependency silently
 * freezes the ref), and they crowd out the effects that actually do something.
 */
export function useLatestRef(value) {
	const ref = useRef(value);
	useEffect(() => {
		ref.current = value;
	}, [value]);
	return ref;
}
