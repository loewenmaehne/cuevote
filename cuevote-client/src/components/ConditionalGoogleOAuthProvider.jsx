import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useConsent } from '../contexts/ConsentContext';
import { CookieConsent } from './CookieConsent';

export function ConditionalGoogleOAuthProvider({ children }) {
	const { hasConsent, showBanner, giveConsent } = useConsent();

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
			{showBanner && <CookieConsent onAccept={giveConsent} />}
		</>
	);
}
