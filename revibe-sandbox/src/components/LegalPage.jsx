import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Scale, ChevronRight, Music, AlertCircle } from 'lucide-react';

export function LegalPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('terms');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const tabs = [
        { id: 'terms', label: 'Terms of Service', icon: Scale, desc: "Rules & Agreements" },
        { id: 'privacy', label: 'Privacy Policy', icon: Shield, desc: "Data & Security" },
        { id: 'imprint', label: 'Legal Notice', icon: FileText, desc: "Imprint & Contact" },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            {/* Navigation Bar */}
            <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#050505]/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/')}
                        className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                            <ArrowLeft size={20} />
                        </div>
                        <span className="font-medium">Back to Revibe</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="font-bold tracking-tight text-white">Legal Center</span>
                    </div>
                </div>
            </nav>

            <main className="relative pt-32 pb-20 px-6 max-w-6xl mx-auto">
                {/* Hero Section */}
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-neutral-500 bg-clip-text text-transparent">
                        Transparency &amp; Trust
                    </h1>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                        We believe in open communication. Here's everything you need to know about how we operate, protect your data, and respect your rights.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Sidebar / Tabs */}
                    <div className="lg:w-1/3 lg:sticky lg:top-32 h-fit space-y-4">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`group w-full text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${activeTab === tab.id
                                    ? 'bg-neutral-900 border-orange-500/50 shadow-lg shadow-orange-500/10'
                                    : 'bg-neutral-900/50 border-white/5 hover:bg-neutral-900 hover:border-white/10'
                                    }`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 transition-opacity duration-300 ${activeTab === tab.id ? 'opacity-100' : 'group-hover:opacity-100'}`} />

                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl transition-colors ${activeTab === tab.id
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-white/5 text-neutral-400 group-hover:text-white'
                                            }`}>
                                            <tab.icon size={24} />
                                        </div>
                                        <div>
                                            <div className={`font-bold transition-colors ${activeTab === tab.id ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                                                {tab.label}
                                            </div>
                                            <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-0.5">{tab.desc}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className={`text-neutral-500 transition-transform duration-300 ${activeTab === tab.id ? 'translate-x-0 text-orange-500' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
                                </div>
                            </button>
                        ))}

                        {/* Contact Card */}
                        <div className="mt-8 p-6 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-white/5">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                                <Music className="text-orange-500" size={18} />
                                Need help?
                            </h3>
                            <p className="text-sm text-neutral-400 mb-4">
                                Can't find what you're looking for? Reach out to our support team.
                            </p>
                            <a href="mailto:support@revibe.music" className="text-sm font-bold text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-1 group">
                                support@revibe.music
                                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="lg:w-2/3 min-h-[600px] animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both" key={activeTab}>
                        <div className="p-8 md:p-12 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl relative overflow-hidden">
                            {/* Content Header */}
                            <div className="mb-10 border-b border-white/5 pb-8">
                                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-600 mb-2">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h2>
                                <p className="text-neutral-400">Effective Date: December 14, 2025</p>
                            </div>

                            <article className="prose prose-invert prose-lg max-w-none">
                                {activeTab === 'terms' && (
                                    <div className="space-y-12">
                                        <section>
                                            <h3 className="flex items-center gap-3 text-xl font-bold text-white mb-4">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-orange-500 text-sm">01</span>
                                                Acceptance of Terms
                                            </h3>
                                            <p className="text-neutral-400 leading-relaxed text-base">
                                                By accessing and using ReVibe Music ("the Service"), you currently accept and agree to be bound by the terms and provision of this agreement.
                                                Using our service serves as a binding contract between your device and our servers.
                                            </p>
                                        </section>

                                        <section>
                                            <h3 className="flex items-center gap-3 text-xl font-bold text-white mb-4">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-orange-500 text-sm">02</span>
                                                Usage License
                                            </h3>
                                            <p className="text-neutral-400 leading-relaxed text-base mb-4">
                                                Permission is granted to temporarily view the materials (information or software) on ReVibe Music for personal, non-commercial transitory viewing only.
                                            </p>
                                            <ul className="grid gap-3">
                                                {['Modify or copy the materials', 'Use materials for commercial purpose', 'Attempt to reverse engineer'].map((item, i) => (
                                                    <li key={i} className="flex items-center gap-3 text-neutral-400 text-base bg-white/5 p-3 rounded-lg border border-white/5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>

                                        <section>
                                            <h3 className="flex items-center gap-3 text-xl font-bold text-white mb-4">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-orange-500 text-sm">03</span>
                                                Platform Content
                                            </h3>
                                            <p className="text-neutral-400 leading-relaxed text-base">
                                                Users act as "DJs" and curate content from YouTube. We do not host any music or video files. All content is embedded via the YouTube API and is subject to YouTube's Terms of Service.
                                            </p>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'privacy' && (
                                    <div className="space-y-12">
                                        <section>
                                            <h3 className="flex items-center gap-3 text-xl font-bold text-white mb-4">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-orange-500 text-sm">01</span>
                                                What We Collect
                                            </h3>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                                    <h4 className="font-bold text-white mb-2">Essential Data</h4>
                                                    <p className="text-sm text-neutral-400">Basic profile info from Google Login (Name, Avatar) to personalize your experience.</p>
                                                </div>
                                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                                    <h4 className="font-bold text-white mb-2">Usage Data</h4>
                                                    <p className="text-sm text-neutral-400">Room history, favorite tracks, and settings preferences.</p>
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <h3 className="flex items-center gap-3 text-xl font-bold text-white mb-4">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-orange-500 text-sm">02</span>
                                                Data Usage
                                            </h3>
                                            <p className="text-neutral-400 leading-relaxed text-base">
                                                We process this data solely to provide functionality. For example, remembering your last visited room or re-queuing your favorite songs. We explicitly <strong className="text-white">do not sell</strong> your data to advertisers or third parties.
                                            </p>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'imprint' && (
                                    <div className="space-y-8">
                                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-orange-500/20 text-orange-500">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-orange-500 text-sm uppercase tracking-wide mb-1">Demo Content Only</h4>
                                                <p className="text-sm text-neutral-400">
                                                    This application is for demonstration purposes. The legal entities and contact details listed below are placeholders and do not represent a real company.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-8 rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-neutral-800 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10" />

                                            <h3 className="text-2xl font-bold text-white mb-1">ReVibe Music</h3>
                                            <p className="text-neutral-500 mb-8">Concept &amp; Implementation</p>

                                            <div className="grid md:grid-cols-2 gap-8">
                                                <div>
                                                    <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Operator</h4>
                                                    <p className="text-neutral-300 font-medium text-lg">ReVibe Digital</p>
                                                    <p className="text-neutral-400">123 Creator Blvd</p>
                                                    <p className="text-neutral-400">Berlin, Germany 10115</p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Contact</h4>
                                                    <div className="space-y-2">
                                                        <p className="text-neutral-400 flex items-center justify-between border-b border-white/5 pb-2">
                                                            <span>Email</span>
                                                            <span className="text-white">hello@revibe.music</span>
                                                        </p>
                                                        <p className="text-neutral-400 flex items-center justify-between border-b border-white/5 pb-2">
                                                            <span>Phone</span>
                                                            <span className="text-white">+49 (0) 30 1234567</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 rounded-xl bg-orange-500/5 border border-orange-500/10">
                                            <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                                <Scale size={16} className="text-orange-500" />
                                                Legal Disclaimer
                                            </h4>
                                            <p className="text-sm text-neutral-400 leading-relaxed">
                                                Despite careful control of the contents, we do not assume any liability for the contents of external links. The operators of the linked pages are solely responsible for their content.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </article>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
