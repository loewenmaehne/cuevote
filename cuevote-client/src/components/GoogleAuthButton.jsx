import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useConsent } from '../contexts/ConsentContext';

// Logic-only component that uses the hook (must be inside GoogleOAuthProvider)
function RealAuthButton({ onLoginSuccess, className, render }) {
	const login = useGoogleLogin({
		onSuccess: onLoginSuccess,
		onError: (err) => console.error("Google Login Error:", err),
	});

	if (render) {
		// Native Bridge Check
		const isNativeWrapper = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeGoogleLogin;

		if (isNativeWrapper) {
			const performNativeLogin = () => {
				const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
				// Define Global Handler
				window.handleNativeGoogleLogin = (token) => {
					// Mock the response object expected by GoogleOAuthProvider/User
					onLoginSuccess({ access_token: token });
					// Cleanup
					delete window.handleNativeGoogleLogin;
				};
				// Call iOS
				window.webkit.messageHandlers.nativeGoogleLogin.postMessage({ clientId });
			};
			return render(performNativeLogin, false);
		}

		return render(login, false); // disabled = false
	}

	return (
		<button onClick={() => login()} className={className}>
			Sign in with Google
		</button>
	);
}

// Wrapper that handles "No Consent" state (can be used anywhere)
export function GoogleAuthButton({ onLoginSuccess, className, render }) {
	const { hasConsent, askForConsent } = useConsent();

	if (!hasConsent) {
		// Return a disabled button
		const noOp = () => {
			// Optional: Clicking disabled button might trigger banner shake or something? 
			// But user asked for unclickable.
			askForConsent();
		};

		if (render) {
			return render(noOp, true); // disabled = true
		}

		return (
			<button onClick={noOp} className={`${className} opacity-50 grayscale cursor-not-allowed`} title="Accept cookies to sign in">
				Sign in with Google
			</button>
		);
	}

	return (
		<RealAuthButton
			onLoginSuccess={onLoginSuccess}
			className={className}
			render={render}
		/>
	);
}
