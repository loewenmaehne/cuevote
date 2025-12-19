import React, { useState, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Scale, ChevronRight, Music, Mail, Phone, Globe } from 'lucide-react';

export function LegalPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('terms');
    const [scrolled, setScrolled] = useState(false);

    useLayoutEffect(() => {
        window.scrollTo(0, 0);
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    const tabs = [
        { id: 'terms', label: 'Terms of Service', icon: Scale, desc: "Agreements & Usage" },
        { id: 'privacy', label: 'Privacy Policy', icon: Shield, desc: "GDPR & Data" },
        { id: 'imprint', label: 'Colophon', icon: FileText, desc: "Company Info" },
    ];

    const LastUpdated = "December 14, 2025";

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            {/* Navigation Bar */}
            <nav className={`fixed top-0 inset-x-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-[#050505]/90 border-b border-white/5 py-4' : 'bg-[#050505]/60 py-6'} backdrop-blur-xl`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors relative z-50 current-color"
                    >
                        <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                            <ArrowLeft size={20} />
                        </div>
                        <span className="font-medium">Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="font-bold tracking-tight text-white hidden md:block">Legal Center</span>
                    </div>
                </div>
            </nav>

            <main className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto">
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
                    {/* Sidebar */}
                    <div className="lg:w-1/4 lg:sticky lg:top-36 h-fit space-y-4">
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
                                        <div className={`p-2.5 rounded-xl transition-colors ${activeTab === tab.id
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-white/5 text-neutral-400 group-hover:text-white'
                                            }`}>
                                            <tab.icon size={20} />
                                        </div>
                                        <div>
                                            <div className={`font-bold text-sm transition-colors ${activeTab === tab.id ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                                                {tab.label}
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider mt-0.5">{tab.desc}</div>
                                        </div>
                                    </div>
                                    {activeTab === tab.id && <ChevronRight size={16} className="text-orange-500" />}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="lg:w-3/4 min-h-[600px] animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both" key={activeTab}>
                        <div className="p-8 md:p-12 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl relative overflow-hidden">

                            {/* Header */}
                            <div className="flex items-baseline justify-between border-b border-white/5 pb-6 mb-8">
                                <h2 className="text-2xl font-bold text-white">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h2>
                                <span className="text-xs text-neutral-500 font-mono">Last updated: {LastUpdated}</span>
                            </div>

                            <article className="prose prose-invert prose-neutral max-w-none prose-headings:font-bold prose-headings:text-white prose-p:text-neutral-400 prose-p:leading-relaxed prose-li:text-neutral-400 prose-strong:text-white prose-a:text-orange-500 hover:prose-a:text-orange-400">

                                {activeTab === 'terms' && (
                                    <>
                                        <p className="lead text-lg text-neutral-300">
                                            Welcome to CueVote. These terms govern your use of our platform. By accessing CueVote, you agree to these terms and the YouTube Terms of Service.
                                        </p>

                                        <h3>1. Service & Usage</h3>
                                        <p>
                                            CueVote is a social interface for consuming content via third-party APIs (primarily YouTube). We do not host, store, or distribute media files. Use of the service is personal, non-commercial, and subject to available API quotas.
                                        </p>

                                        <h3>2. Integration with YouTube</h3>
                                        <p>
                                            Our service relies on YouTube API Services. By using CueVote, you explicitly agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>. We have no control over YouTube content and assume no liability for its availability or nature.
                                        </p>

                                        <h3>3. User Responsibilities</h3>
                                        <ul>
                                            <li>You must be at least 16 years of age.</li>
                                            <li>You are responsible for the security of your session and account.</li>
                                            <li>You agree not to abuse the platform, harass users, or attempt to reverse-engineer our code.</li>
                                        </ul>

                                        <h3>4. Disclaimer & Liability</h3>
                                        <p>
                                            The service is provided "as is". CueVote disclaims all warranties. To the fullest extent permitted by Dutch law, we shall not be liable for any indirect damages arising from your use of the service.
                                        </p>

                                        <h3>5. Google Privacy Policy</h3>
                                        <p>
                                            Since we utilize YouTube API Services, you acknowledge that by using those services, your data may be processed in accordance with the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
                                        </p>

                                        <h3>6. Governing Law</h3>
                                        <p>
                                            These terms are governed by the laws of <strong>The Netherlands</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts in Amsterdam, unless mandatory consumer protection laws dictate otherwise.
                                        </p>
                                    </>
                                )}

                                {activeTab === 'privacy' && (
                                    <>
                                        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm text-neutral-300 mb-8">
                                            <strong className="text-orange-500 block mb-1">GDPR & Google Data Summary</strong>
                                            We collect minimal data to make the app work and use YouTube's API for content. We don't sell your data. We respect your privacy rights under European Law (AVG/GDPR).
                                        </div>

                                        <h3>1. Who We Are</h3>
                                        <p>
                                            Data Controller:<br />
                                            <strong>CueVote Digital</strong><br />
                                            {import.meta.env.VITE_LEGAL_ADDRESS_LINE1 || "[Street Address]"}<br />
                                            {import.meta.env.VITE_LEGAL_ADDRESS_LINE2 || "[City, Country]"}, The Netherlands<br />
                                            Contact: <a href={`mailto:${import.meta.env.VITE_LEGAL_EMAIL || "privacy@cuevote.com"}`}>{import.meta.env.VITE_LEGAL_EMAIL || "privacy@cuevote.com"}</a>
                                        </p>

                                        <h3>2. Data Collection & Purpose</h3>
                                        <p>We process data for specific, legitimate purposes:</p>
                                        <ul className="list-none pl-0 space-y-4">
                                            <li className="pl-4 border-l-2 border-white/10">
                                                <strong className="block text-white">Google Account Information</strong>
                                                <span className="text-sm">When you login via Google, we verify your identity and store your email, name, and avatar URL to display your profile in rooms. Legal basis: Contract (Art. 6.1.b GDPR).</span>
                                            </li>
                                            <li className="pl-4 border-l-2 border-white/10">
                                                <strong className="block text-white">Usage Statistics</strong>
                                                <span className="text-sm">We log room history and voted songs to improve recommendations. This data is internal to CueVote. Legal basis: Legitimate Interest (Art. 6.1.f GDPR).</span>
                                            </li>
                                            <li className="pl-4 border-l-2 border-white/10">
                                                <strong className="block text-white">YouTube API Data</strong>
                                                <span className="text-sm">When you search or play songs, we send requests to YouTube's API. YouTube may collect data on your viewing behavior via their embedded player. Legal basis: Contract/Consent (via your use of YouTube).</span>
                                            </li>
                                        </ul>

                                        <h3>3. Third-Party Processors</h3>
                                        <p>
                                            We engage trusted third parties to operate our infrastructure. We ensure they are GDPR compliant.
                                        </p>
                                        <ul>
                                            <li><strong>Google/YouTube</strong> (Auth & Content API) - USA. <br /><span className="text-sm">See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</span></li>
                                            <li><strong>Hosting Provider</strong> (Server Infrastructure) - EU/USA</li>
                                            <li><strong>Database Provider</strong> (Data Storage) - EU/USA</li>
                                        </ul>

                                        <h3>4. Your Rights</h3>
                                        <p>
                                            You have the right to access, correct, delete, or export your personal data at any time. To exercise these rights ("Right to be Forgotten" or "Revocation of Access"), contact us at the email provided above.
                                        </p>
                                        <p>
                                            You can also revoke our access to your Google Data via the <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Security Settings</a> page.
                                        </p>

                                        <h3>5. Cookies</h3>
                                        <p>
                                            We use only essential local storage to maintain your session (e.g. your login token). We do not use third-party tracking cookies for advertising (marketing cookies) on our own domain, though third-party embeds (YouTube) may set their own cookies.
                                        </p>
                                    </>
                                )}

                                {activeTab === 'imprint' && (
                                    <div className="not-prose space-y-8">
                                        <div className="grid md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h3 className="text-white font-bold text-lg border-b border-white/10 pb-2">CueVote Digital</h3>
                                                <div className="text-sm text-neutral-400 space-y-1">
                                                    <p>{import.meta.env.VITE_LEGAL_ADDRESS_LINE1 || "[Street Address]"}</p>
                                                    <p>{import.meta.env.VITE_LEGAL_ADDRESS_LINE2 || "[City, Country]"}</p>
                                                    <p>The Netherlands</p>
                                                </div>
                                                <div className="pt-4 text-sm">
                                                    <p className="text-neutral-500 mb-1">Managed by</p>
                                                    <p className="text-white font-medium">{import.meta.env.VITE_LEGAL_NAME || "[Director Name]"}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-white font-bold text-lg border-b border-white/10 pb-2">Contact</h3>
                                                <ul className="space-y-3 text-sm">
                                                    <li className="flex items-center gap-3 text-neutral-400">
                                                        <Mail size={16} />
                                                        <a href={`mailto:${import.meta.env.VITE_LEGAL_EMAIL || "hello@cuevote.com"}`} className="text-orange-500 hover:text-white transition-colors">
                                                            {import.meta.env.VITE_LEGAL_EMAIL || "hello@cuevote.com"}
                                                        </a>
                                                    </li>
                                                    {import.meta.env.VITE_LEGAL_PHONE && (
                                                        <li className="flex items-center gap-3 text-neutral-400">
                                                            <Phone size={16} />
                                                            <span>{import.meta.env.VITE_LEGAL_PHONE}</span>
                                                        </li>
                                                    )}
                                                    <li className="flex items-center gap-3 text-neutral-400">
                                                        <Globe size={16} />
                                                        <a href="https://cuevote.com" className="text-neutral-300 hover:text-white transition-colors">www.cuevote.com</a>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>

                                        {(import.meta.env.VITE_LEGAL_KVK || import.meta.env.VITE_LEGAL_VAT) && (
                                            <div className="p-6 rounded-xl bg-neutral-900 border border-white/5 space-y-4 text-sm">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {import.meta.env.VITE_LEGAL_KVK && (
                                                        <div>
                                                            <span className="block text-neutral-500 text-xs uppercase tracking-wider mb-1">KVK (Chamber of Commerce)</span>
                                                            <span className="font-mono text-neutral-300">{import.meta.env.VITE_LEGAL_KVK}</span>
                                                        </div>
                                                    )}
                                                    {import.meta.env.VITE_LEGAL_VAT && (
                                                        <div>
                                                            <span className="block text-neutral-500 text-xs uppercase tracking-wider mb-1">BTW (VAT ID)</span>
                                                            <span className="font-mono text-neutral-300">{import.meta.env.VITE_LEGAL_VAT}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="text-xs text-neutral-500 leading-relaxed border-t border-white/5 pt-6 space-y-4">
                                            <p>
                                                <strong>Liability for Content:</strong> While we strive for accuracy, we cannot guarantee the completeness or correctness of the information on this website. We are not liable for the content of external links.
                                            </p>
                                            <p>
                                                <strong>Online Dispute Resolution:</strong> The European Commission provides a platform for ODR at <a href="https://ec.europa.eu/consumers/odr" className="text-neutral-400 underline hover:text-white">ec.europa.eu/consumers/odr</a>. We are not obliged to participate in dispute settlement proceedings.
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
