import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Scale, ChevronRight, Music, AlertCircle } from 'lucide-react';

export function LegalPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('terms');
    const [scrolled, setScrolled] = useState(false);

    // Use useLayoutEffect for immediate scroll reset to prevent visual jumping
    useLayoutEffect(() => {
        window.scrollTo(0, 0);

        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Scroll to top when tab changes
    useLayoutEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    const tabs = [
        { id: 'terms', label: 'Terms of Service', icon: Scale, desc: "Rules & Agreements" },
        { id: 'privacy', label: 'Privacy Policy', icon: Shield, desc: "Data & Security" },
        { id: 'imprint', label: 'Legal Notice', icon: FileText, desc: "Imprint & Contact" },
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
                        onClick={() => navigate('/')}
                        className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors relative z-50"
                    >
                        <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                            <ArrowLeft size={20} />
                        </div>
                        <span className="font-medium">Back to Revibe</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
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
                    {/* Sidebar / Tabs */}
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
                    <div className="lg:w-3/4 min-h-[600px] animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both" key={activeTab}>
                        <div className="p-8 md:p-12 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl relative overflow-hidden">
                            {/* Content Header */}
                            <div className="mb-10 border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-600 mb-2">
                                        {tabs.find(t => t.id === activeTab)?.label}
                                    </h2>
                                    <p className="text-neutral-400">Effective Date: <span className="text-neutral-300">{LastUpdated}</span></p>
                                </div>
                                <div className="text-sm text-neutral-500 italic">
                                    Version 1.2
                                </div>
                            </div>

                            <article className="prose prose-invert prose-lg max-w-none prose-headings:text-neutral-200 prose-p:text-neutral-400 prose-li:text-neutral-400 prose-strong:text-white prose-a:text-orange-500 hover:prose-a:text-orange-400">
                                {activeTab === 'terms' && (
                                    <div className="space-y-12">
                                        <div className="p-6 rounded-xl bg-orange-500/5 border border-orange-500/10 text-sm text-neutral-300">
                                            <strong>Key Takeaway:</strong> By using ReVibe Music, you agree to these terms, including the fact that we use YouTube for content and do not host copyrighted music ourselves. Play nice, respect others, and enjoy the vibes.
                                        </div>

                                        <section>
                                            <h3>1. Introduction</h3>
                                            <p>
                                                Welcome to ReVibe Music ("we," "our," or "us"). By accessing or using our website, mobile application, or services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>2. Service Description</h3>
                                            <p>
                                                ReVibe Music is a social listening platform that allows users to create virtual rooms ("Lobbies"), curate playlists using content via the YouTube Data API, and vote on music in real-time. We act as a technical intermediary and interface; we do not host, store, or distribute copyrighted music or video files on our servers.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>3. Accounts & Registration</h3>
                                            <ul className="list-disc pl-5 space-y-2">
                                                <li>You may need to authenticate using a third-party provider (e.g., Google) to access certain features.</li>
                                                <li>You are responsible for maintaining the confidentiality of your account login information.</li>
                                                <li>You are responsible for all activities that occur under your account.</li>
                                                <li>You must be at least 16 years old to use this Service, or the age of digital consent in your country of residence.</li>
                                            </ul>
                                        </section>

                                        <section>
                                            <h3>4. YouTube API Services</h3>
                                            <p>
                                                Our Service uses YouTube API Services to display content. By using ReVibe Music, you also agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a> and acknowledge the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
                                            </p>
                                            <p>
                                                You acknowledge that we do not have control over the availability of YouTube content/videos and that videos may be blocked or removed by YouTube or rights holders at any time.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>5. User Conduct</h3>
                                            <p>You agree not to:</p>
                                            <ul className="list-disc pl-5 space-y-2">
                                                <li>Use the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
                                                <li>Harass, threaten, demean, embarrass, or otherwise harm any other user of the Service.</li>
                                                <li>Impersonate any person or entity.</li>
                                                <li>Interfere with security-related features of the Service.</li>
                                                <li>Use any robot, spider, scraper, or other automated means to access the Service for any purpose without our express written permission.</li>
                                            </ul>
                                        </section>

                                        <section>
                                            <h3>6. Intellectual Property</h3>
                                            <p>
                                                The ReVibe Music interface, branding, logo, and custom code are proprietary intellectual property of the operators. However, all audiovisual content streamed through the Service is the property of its respective third-party owners (e.g., YouTube creators, record labels) and is accessed via public APIs. We claim no ownership over such external content.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>7. Disclaimer of Warranties</h3>
                                            <p className="uppercase text-xs font-bold tracking-widest text-neutral-500 mb-2">Disclaimer</p>
                                            <p>
                                                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>8. Limitation of Liability</h3>
                                            <p>
                                                IN NO EVENT SHALL REVIBE MUSIC BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>9. Governing Law</h3>
                                            <p>
                                                These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Germany, without regard to its conflict of law provisions.
                                            </p>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'privacy' && (
                                    <div className="space-y-12">
                                        <div className="p-6 rounded-xl bg-orange-500/5 border border-orange-500/10 flex gap-4">
                                            <Shield className="text-orange-500 shrink-0" size={24} />
                                            <div>
                                                <h4 className="font-bold text-white mb-1">GDPR Compliance</h4>
                                                <p className="text-sm text-neutral-400">This policy is designed to comply with the European Union's General Data Protection Regulation (GDPR). You have full control over your data.</p>
                                            </div>
                                        </div>

                                        <section>
                                            <h3>1. Controller Information</h3>
                                            <p>
                                                The data controller responsible for your personal information for the purposes of GDPR is:<br />
                                                <strong className="text-white">ReVibe Digital</strong><br />
                                                [Insert Street Address]<br />
                                                [Insert City, Zip Code, Country]<br />
                                                Email: privacy@revibe.music
                                            </p>
                                        </section>

                                        <section>
                                            <h3>2. Data We Collect</h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-white font-bold mb-2">A. Information You Provide</h4>
                                                    <ul className="list-disc pl-5 space-y-1">
                                                        <li><strong>Account Data:</strong> If you log in via Google, we collect your name, email address, and profile picture URL.</li>
                                                        <li><strong>User Content:</strong> Room names, chat messages (if applicable), and playlist selections you create or submit.</li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-bold mb-2">B. Information Collected Automatically</h4>
                                                    <ul className="list-disc pl-5 space-y-1">
                                                        <li><strong>Usage Data:</strong> Pages visited, time spent, songs voted on, and interaction with features.</li>
                                                        <li><strong>Technical Data:</strong> IP address, browser type, device information, and operating system (via standard server logs).</li>
                                                        <li><strong>Cookies & Local Storage:</strong> We use local storage to remember your session, room preferences, and volume settings.</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <h3>3. Purpose and Legal Basis</h3>
                                            <p>We process your data for the following purposes based on these legal grounds:</p>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-white/10">
                                                            <th className="py-3 font-bold text-white">Purpose</th>
                                                            <th className="py-3 font-bold text-white">Legal Basis (GDPR Art. 6)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        <tr><td className="py-3 pr-4">Providing the Service (Rooms, Playlists)</td><td className="py-3">Performance of Contract (Art. 6(1)(b))</td></tr>
                                                        <tr><td className="py-3 pr-4">User Authentication</td><td className="py-3">Consent / Contract (Art. 6(1)(a/b))</td></tr>
                                                        <tr><td className="py-3 pr-4">Improving Security & Features</td><td className="py-3">Legitimate Interest (Art. 6(1)(f))</td></tr>
                                                        <tr><td className="py-3 pr-4">Compliance with Law</td><td className="py-3">Legal Obligation (Art. 6(1)(c))</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>

                                        <section>
                                            <h3>4. Data Sharing & Third Parties</h3>
                                            <p>
                                                We do not sell your personal data. However, we share data with the following categories of recipients to operate the Service:
                                            </p>
                                            <ul className="list-disc pl-5 space-y-2">
                                                <li><strong>YouTube API:</strong> To play music and display video metadata. YouTube may collect data associated with your playback activity in accordance with their privacy policy.</li>
                                                <li><strong>Hosting Providers:</strong> We use cloud service providers (e.g., AWS, Vercel, Heroku) to host our application and database. These providers act as data processors bound by data processing agreements (DPAs).</li>
                                            </ul>
                                        </section>

                                        <section>
                                            <h3>5. International Transfers</h3>
                                            <p>
                                                Some of our service providers (e.g., Google) are based outside the European Economic Area (EEA), specifically in the USA. We ensure that data transfers are protected by appropriate safeguards, such as the EU-US Data Privacy Framework or Standard Contractual Clauses (SCCs).
                                            </p>
                                        </section>

                                        <section>
                                            <h3>6. Your Rights</h3>
                                            <p>Under the GDPR, you have the following rights regarding your personal data:</p>
                                            <ul className="grid md:grid-cols-2 gap-4 mt-4">
                                                {[
                                                    ['Access', 'Request a copy of your data.'],
                                                    ['Rectification', 'Correct inaccurate data.'],
                                                    ['Erasure', 'Request "Right to be Forgotten".'],
                                                    ['Restriction', 'Limit how we use your data.'],
                                                    ['Portability', 'Get your data in a machine-readable format.'],
                                                    ['Objection', 'Object to processing based on legitimate interests.']
                                                ].map(([right, desc]) => (
                                                    <li key={right} className="bg-white/5 p-4 rounded-lg border border-white/5">
                                                        <strong className="text-white block mb-1">Right to {right}</strong>
                                                        <span className="text-sm opacity-80">{desc}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="mt-4">
                                                To exercise these rights, please contact us at <a href="mailto:privacy@revibe.music">privacy@revibe.music</a>.
                                            </p>
                                        </section>

                                        <section>
                                            <h3>7. Data Retention</h3>
                                            <p>
                                                We retain your personal data only as long as necessary to provide the Service or to comply with legal obligations. Session logs are typically deleted after 30 days. Account data is retained until you request deletion.
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
                                                <h4 className="font-bold text-orange-500 text-sm uppercase tracking-wide mb-1">Legal Notice (Impressum)</h4>
                                                <p className="text-sm text-neutral-400">
                                                    Information according to § 5 TMG (German Telemedia Act).
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-12">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-6">Service Provider</h3>
                                                <div className="space-y-4 text-neutral-300">
                                                    <p>
                                                        <strong className="text-white block">ReVibe Digital</strong>
                                                        Sample Street 123<br />
                                                        10115 Berlin<br />
                                                        Germany
                                                    </p>
                                                    <p>
                                                        <strong className="text-white block">Represented by:</strong>
                                                        [Managing Director Name]
                                                    </p>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-6">Contact</h3>
                                                <div className="space-y-4">
                                                    <p className="flex items-center justify-between border-b border-white/5 pb-2">
                                                        <span className="text-neutral-500">Phone</span>
                                                        <span className="text-white font-mono">+49 (0) 123 456789</span>
                                                    </p>
                                                    <p className="flex items-center justify-between border-b border-white/5 pb-2">
                                                        <span className="text-neutral-500">Email</span>
                                                        <a href="mailto:info@revibe.music" className="text-orange-500 hover:text-orange-400 font-mono">info@revibe.music</a>
                                                    </p>
                                                    <p className="flex items-center justify-between border-b border-white/5 pb-2">
                                                        <span className="text-neutral-500">Website</span>
                                                        <a href="https://revibe.music" className="text-orange-500 hover:text-orange-400 font-mono">www.revibe.music</a>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6 pt-8 border-t border-white/5">
                                            <section>
                                                <h4 className="font-bold text-white mb-2">VAT ID</h4>
                                                <p className="text-neutral-400">
                                                    Sales tax identification number according to § 27a of the Sales Tax Law:<br />
                                                    <span className="font-mono text-neutral-300">DE 123 456 789</span>
                                                </p>
                                            </section>

                                            <section>
                                                <h4 className="font-bold text-white mb-2">Online Dispute Resolution (ODR)</h4>
                                                <p className="text-neutral-400">
                                                    The European Commission provides a platform for online dispute resolution (OS): <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>.<br />
                                                    We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
                                                </p>
                                            </section>

                                            <section>
                                                <h4 className="font-bold text-white mb-2">Liability for Content</h4>
                                                <p className="text-neutral-400 text-sm leading-relaxed">
                                                    As a service provider, we are responsible for our own content on these pages in accordance with § 7 Section 1 TMG under general laws. According to §§ 8 to 10 TMG, however, we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity. Obligations to remove or block the use of information under general laws remain unaffected. However, liability in this regard is only possible from the point in time at which we become aware of a specific legal violation. Upon becoming aware of such legal violations, we will remove this content immediately.
                                                </p>
                                            </section>

                                            <section>
                                                <h4 className="font-bold text-white mb-2">Liability for Links</h4>
                                                <p className="text-neutral-400 text-sm leading-relaxed">
                                                    Our offer contains links to external third-party websites over whose content we have no influence. Therefore, we cannot assume any liability for this external content. The respective provider or operator of the pages is always responsible for the content of the linked pages.
                                                </p>
                                            </section>
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
