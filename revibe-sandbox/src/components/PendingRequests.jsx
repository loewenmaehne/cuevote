import React from 'react';
import { Check, X, Clock, ArrowLeft } from 'lucide-react';

export function PendingRequests({ requests, onApprove, onReject }) {
	if (!requests || requests.length === 0) return null;

	return (
		<div className="fixed bottom-24 right-6 z-50 w-80 bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
			<div className="bg-neutral-800/50 p-3 border-b border-neutral-700 flex justify-between items-center">
				<h3 className="font-bold text-white flex items-center gap-2">
					<Clock size={16} className="text-orange-500" />
					Pending Review ({requests.length})
				</h3>
			</div>

			<div className="max-h-60 overflow-y-auto custom-scrollbar">
				{requests.map((track) => (
					<div key={track.id} className="p-3 border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors flex gap-3">
						<img
							src={track.thumbnail}
							alt={track.title}
							className="w-12 h-12 rounded object-cover flex-shrink-0"
						/>

						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium text-white line-clamp-1" title={track.title}>{track.title}</p>
							<p className="text-xs text-neutral-400 line-clamp-1">{track.artist}</p>
							<p className="text-xs text-neutral-500 mt-1">
								Suggested by <span className="text-neutral-300">{track.suggestedByUsername || 'Unknown'}</span>
							</p>
						</div>

						<div className="flex flex-col gap-2 justify-center">
							<button
								onClick={() => onApprove(track.id)}
								className="p-1.5 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
								title="Approve"
							>
								<Check size={16} />
							</button>
							<button
								onClick={() => onReject(track.id)}
								className="p-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
								title="Reject"
							>
								<X size={16} />
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export function PendingRequestsPage({ requests, onApprove, onReject, onClose }) {
	return (
		<div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in">
			<div className="p-6 border-b border-neutral-800 flex items-center gap-4 bg-black">
				<button
					onClick={onClose}
					className="p-2 rounded-full hover:bg-neutral-800 text-white transition-colors"
				>
					<ArrowLeft size={24} />
				</button>
				<h1 className="text-2xl font-bold text-white flex items-center gap-3">
					<Clock className="text-orange-500" />
					Pending Requests
					<span className="text-lg font-normal text-neutral-500">
						({requests.length} pending)
					</span>
				</h1>
			</div>

			<div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
				{(!requests || requests.length === 0) ? (
					<div className="text-center text-neutral-500 mt-20">
						<p className="text-xl">No pending requests</p>
						<p className="text-sm mt-2">New suggestions requiring approval will appear here.</p>
					</div>
				) : (
					<div className="grid gap-4">
						{requests.map((track) => (
							<div key={track.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 hover:border-neutral-700 transition-colors">
								<img
									src={track.thumbnail}
									alt={track.title}
									className="w-24 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm"
								/>

								<div className="flex-1 min-w-0">
									<h3 className="text-lg font-bold text-white truncate" title={track.title}>{track.title}</h3>
									<p className="text-neutral-400">{track.artist}</p>
									<p className="text-sm text-neutral-500 mt-1 flex items-center gap-1">
										Suggested by <span className="text-neutral-300 font-medium">{track.suggestedByUsername || 'Unknown'}</span>
									</p>
								</div>

								<div className="flex items-center gap-3">
									<button
										onClick={() => onReject(track.id)}
										className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-medium flex items-center gap-2"
									>
										<X size={18} /> Decline
									</button>
									<button
										onClick={() => onApprove(track.id)}
										className="px-4 py-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors font-medium flex items-center gap-2"
									>
										<Check size={18} /> Accept
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
