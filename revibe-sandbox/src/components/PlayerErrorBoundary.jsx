import React from "react";
import { AlertTriangle } from "lucide-react";

class PlayerErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		console.error("Player Error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex h-full w-full flex-col items-center justify-center bg-neutral-900 text-neutral-400 gap-2 p-4 text-center">
					<AlertTriangle size={32} className="text-orange-500" />
					<p className="font-medium">Player failed to load</p>
					<button
						onClick={() => this.setState({ hasError: false })}
						className="text-xs text-orange-500 hover:text-orange-400 underline"
					>
						Retry
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

export default PlayerErrorBoundary;
