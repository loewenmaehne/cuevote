import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useConsent } from '../contexts/ConsentContext';

// Logic-only component that uses the hook (must be inside GoogleOAuthProvider)
function RealAuthButton({ onLoginSuccess, className, render }) {
	const login = useGoogleLogin({
		onSuccess: onLoginSuccess,
		onError: () => console.log('Login Failed'),
	});

	if (render) {
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
