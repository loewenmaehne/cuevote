import React from 'react';
import { Check, X, Clock, ArrowLeft, Ban, Headphones } from 'lucide-react';

export function PendingRequests({ requests, onApprove, onReject, onBan, onPreview, onClose }) {
	if (!requests || requests.length === 0) return null;

	return (
		<div className="fixed bottom-20 sm:bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-[450px] z-30 bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
			<div className="bg-neutral-800/50 p-3 border-b border-neutral-700 flex justify-between items-center">
				<h3 className="font-bold text-white flex items-center gap-2">
					<Clock size={16} className="text-orange-500" />
					Pending Review ({requests.length})
				</h3>
				<button
					onClick={onClose}
					className="text-neutral-400 hover:text-white transition-colors p-1 rounded-md hover:bg-neutral-700"
				>
					<X size={16} />
				</button>
			</div>

			<div className="max-h-60 overflow-y-auto custom-scrollbar">
				{requests.map((track) => (
					<div key={track.id} className="p-3 pr-4 border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors flex gap-3 items-start">
						<img
							src={track.thumbnail}
							alt={track.title}
							className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0"
						/>

						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium text-white line-clamp-2 leading-tight" title={track.title}>{track.title}</p>
							<p className="text-xs text-neutral-400 line-clamp-1">{track.artist}</p>
							<p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
								By <span className="text-neutral-300">{track.suggestedByUsername || 'Unknown'}</span>
							</p>
						</div>

						<div className="flex gap-2 justify-center flex-shrink-0 pl-2 pt-1">
							<button
								onClick={() => onPreview && onPreview(track)}
								className="p-1.5 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
								title="Preview"
							>
								<Headphones size={16} />
							</button>
							<button
								onClick={() => onBan(track.id)}
								className="p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:bg-red-900 hover:text-red-400 transition-colors"
								title="Ban Song"
							>
								<Ban size={16} />
							</button>
							<button
								onClick={() => onReject(track.id)}
								className="p-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
								title="Reject"
							>
								<X size={16} />
							</button>
							<button
								onClick={() => onApprove(track.id)}
								className="p-1.5 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
								title="Approve"
							>
								<Check size={16} />
							</button>
						</div>
					</div>
				))}
			</div >
		</div >
	);
}

export function PendingRequestsPage({ requests, onApprove, onReject, onBan, onManageBanned, onPreview, onClose }) {
	return (
		<div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in">
			<div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black">
				<div className="flex items-center gap-4">
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
				<button
					onClick={onManageBanned}
					className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors border border-neutral-700 font-medium"
				>
					<Ban size={18} className="text-red-500" />
					<span>Banned Songs</span>
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
				{(!requests || requests.length === 0) ? (
					<div className="text-center text-neutral-500 mt-20">
						<p className="text-xl">No pending requests</p>
						<p className="text-sm mt-2">New suggestions requiring approval will appear here.</p>
					</div>
				) : (
					<div className="grid gap-4">
						{requests.map((track) => (
							<div key={track.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 sm:p-4 flex items-start justify-between gap-3 sm:gap-4 hover:border-neutral-700 transition-colors">
								<div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
									<img
										src={track.thumbnail}
										alt={track.title}
										className="w-16 h-12 sm:w-24 sm:h-16 rounded-lg object-cover flex-shrink-0 shadow-sm"
									/>

									<div className="flex-1 min-w-0">
										<h3 className="text-sm sm:text-lg font-bold text-white line-clamp-2 leading-tight" title={track.title}>{track.title}</h3>
										<p className="text-xs sm:text-base text-neutral-400 truncate">{track.artist}</p>
										<p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1 flex items-center gap-1">
											<span className="hidden sm:inline">Suggested by</span> <span className="text-neutral-300 font-medium truncate">{track.suggestedByUsername || 'Unknown'}</span>
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2 flex-shrink-0 sm:pl-4 pt-1 sm:pt-0">
									<button
										onClick={() => onPreview && onPreview(track)}
										className="p-2 sm:px-4 sm:py-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors font-medium flex items-center gap-2"
										title="Preview Song"
									>
										<Headphones size={18} /> <span className="hidden sm:inline">Preview</span>
									</button>
									<button
										onClick={() => onBan(track.id)}
										className="p-2 sm:px-4 sm:py-2 rounded-lg bg-neutral-800 text-neutral-400 hover:bg-red-900/30 hover:text-red-400 transition-colors font-medium flex items-center gap-2"
										title="Ban Song"
									>
										<Ban size={18} /> <span className="hidden sm:inline">Ban</span>
									</button>
									<button
										onClick={() => onReject(track.id)}
										className="p-2 sm:px-4 sm:py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-medium flex items-center gap-2"
										title="Decline"
									>
										<X size={18} /> <span className="hidden sm:inline">Decline</span>
									</button>
									<button
										onClick={() => onApprove(track.id)}
										className="p-2 sm:px-4 sm:py-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors font-medium flex items-center gap-2"
										title="Accept"
									>
										<Check size={18} /> <span className="hidden sm:inline">Accept</span>
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
