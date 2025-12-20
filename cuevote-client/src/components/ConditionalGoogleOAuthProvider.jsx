import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useLocation } from 'react-router-dom';
import { useConsent } from '../contexts/ConsentContext';
import { CookieConsent } from './CookieConsent';

export function ConditionalGoogleOAuthProvider({ children }) {
	const { hasConsent, showBanner, giveConsent } = useConsent();
	const location = useLocation();

	// Check if we are inside a room (URLs starting with /room/)
	const isInRoom = location.pathname.startsWith('/room/');

	return (
		<>
			{hasConsent ? (
				<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
					{children}
				</GoogleOAuthProvider>
			) : (
				<>
					{children}
				</>
			)}
			{/* Only show global banner if NOT in a room */}
			{showBanner && !isInRoom && <CookieConsent onAccept={giveConsent} />}
		</>
	);
}
