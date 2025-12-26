import React, { useState, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Scale, ChevronRight, Music, Mail, Phone, Globe, Flag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LEGAL_CONTENT } from '../constants/legalContent';

export function LegalPage() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [activeTab, setActiveTab] = useState('terms');
    const [scrolled, setScrolled] = useState(false);

    // Fallback to English if language is not supported
    const currentLang = LEGAL_CONTENT[language] ? language : 'en';
    const content = LEGAL_CONTENT[currentLang];

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
        { id: 'terms', label: content.tabs.terms.label, icon: Scale, desc: content.tabs.terms.desc },
        { id: 'privacy', label: content.tabs.privacy.label, icon: Shield, desc: content.tabs.privacy.desc },
        { id: 'imprint', label: content.tabs.imprint.label, icon: FileText, desc: content.tabs.imprint.desc },
    ];

    const dates = {
        terms: "December 14, 2025",
        privacy: "December 26, 2025",
        imprint: "December 26, 2025"
    };
    const LastUpdated = dates[activeTab];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            {/* Navigation Bar */}
            <nav className={`fixed top-0 inset-x-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-[#050505]/90 border-b border-white/5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]' : 'bg-[#050505]/60 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))]'} backdrop-blur-xl`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors relative z-50 current-color"
                    >
                        <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                            <ArrowLeft size={20} />
                        </div>
                        <span className="font-medium">{content.back}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="font-bold tracking-tight text-white hidden md:block">{content.center}</span>
                    </div>
                </div>
            </nav>

            <main className="relative pt-[calc(8rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] px-6 max-w-7xl mx-auto">
                {/* Hero Section */}
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-neutral-500 bg-clip-text text-transparent">
                        {content.title}
                    </h1>
                    <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                        {content.subtitle}
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
                    <div className="lg:w-3/4 min-h-[600px] animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-both" key={activeTab + currentLang}>
                        <div className="p-8 md:p-12 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl relative overflow-hidden">

                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-white/5 pb-6 mb-8">
                                <h2 className="text-2xl font-bold text-white">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h2>
                                <span className="text-xs text-neutral-500 font-mono">{content.lastUpdated}: {LastUpdated}</span>
                            </div>

                            <article className="prose prose-invert prose-neutral max-w-none prose-headings:font-bold prose-headings:text-white prose-p:text-neutral-400 prose-p:leading-relaxed prose-li:text-neutral-400 prose-strong:text-white prose-a:text-orange-500 hover:prose-a:text-orange-400">

                                {activeTab === 'terms' && (
                                    <>
                                        <p className="lead text-lg text-neutral-300">
                                            {content.terms.intro}
                                        </p>

                                        <div className="p-4 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-neutral-400 mb-8 italic">
                                            {content.disclaimer}
                                        </div>

                                        {content.terms.sections.map((section, idx) => (
                                            <div key={idx} className="mb-6">
                                                <h3>{section.title}</h3>
                                                {section.content && <p dangerouslySetInnerHTML={{ __html: section.content }} />}
                                                {section.list && (
                                                    <ul>
                                                        {section.list.map((item, i) => (
                                                            <li key={i}>{item}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}

                                {activeTab === 'privacy' && (
                                    <>
                                        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm text-neutral-300 mb-8">
                                            <strong className="text-orange-500 block mb-1">{content.privacy.summary.title}</strong>
                                            {content.privacy.summary.text}
                                        </div>

                                        {content.privacy.sections.map((section, idx) => (
                                            <div key={idx} className="mb-6">
                                                <h3>{section.title}</h3>
                                                {section.content && <p dangerouslySetInnerHTML={{ __html: section.content }} />}
                                                {section.intro && <p>{section.intro}</p>}
                                                {section.list && (
                                                    <ul className="list-none pl-0 space-y-4">
                                                        {section.list.map((item, i) => (
                                                            <li key={i} className="pl-4 border-l-2 border-white/10">
                                                                <strong className="block text-white">{item.title}</strong>
                                                                <span className="text-sm">{item.text}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {section.listSimple && (
                                                    <ul>
                                                        {section.listSimple.map((item, i) => (
                                                            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}

                                {activeTab === 'imprint' && (
                                    <div className="not-prose space-y-8">
                                        <div className="grid md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h3 className="text-white font-bold text-lg border-b border-white/10 pb-2">{content.imprint.addressHeading}</h3>
                                                <div className="text-sm text-neutral-400 space-y-1">
                                                    <p className="font-medium text-white">{import.meta.env.VITE_LEGAL_NAME || "CueVote Digital"}</p>
                                                    <p>{import.meta.env.VITE_LEGAL_ADDRESS_LINE1 || "[Street Address]"}</p>
                                                    <p>{import.meta.env.VITE_LEGAL_ADDRESS_LINE2 || "[City, Country]"}</p>
                                                    <p>{currentLang === 'nl' ? 'Nederland' : 'The Netherlands'}</p>
                                                </div>

                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-white font-bold text-lg border-b border-white/10 pb-2">{currentLang === 'nl' ? 'Contact' : 'Contact'}</h3>
                                                <ul className="space-y-3 text-sm">
                                                    <li className="flex items-center gap-3 text-neutral-400">
                                                        <Mail size={16} />
                                                        <a href={`mailto:${import.meta.env.VITE_LEGAL_EMAIL || "hello@cuevote.com"}`} className="text-orange-500 hover:text-white transition-colors">
                                                            {import.meta.env.VITE_LEGAL_EMAIL || "hello@cuevote.com"}
                                                        </a>
                                                    </li>
                                                    <li className="flex items-center gap-3 text-neutral-400">
                                                        <Flag size={16} className="shrink-0" />
                                                        <a href={`mailto:${import.meta.env.VITE_LEGAL_EMAIL || "hello@cuevote.com"}?subject=Abuse%20Report`} className="text-neutral-300 hover:text-white transition-colors">
                                                            {content.imprint.abuse}
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
                                                <strong>{content.imprint.liability.title}</strong> {content.imprint.liability.text}
                                            </p>
                                            <p>
                                                <strong>{content.imprint.odr.title}</strong> <span dangerouslySetInnerHTML={{ __html: content.imprint.odr.text }} />
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

