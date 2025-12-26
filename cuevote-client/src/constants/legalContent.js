import { translations } from '../contexts/translations';

// Helper to reuse English content but override specific fields
const withEnglishContent = (overrides) => {
	return {
		...LEGAL_CONTENT.en,
		...overrides,
		// Ensure nested structure for tabs is merged or preserved if needed, 
		// but for now we might want to keep English tabs descriptions? 
		// Actually, let's just use English content for the heavy text sections.
		terms: LEGAL_CONTENT.en.terms,
		privacy: LEGAL_CONTENT.en.privacy,
		imprint: LEGAL_CONTENT.en.imprint
	};
};

export const LEGAL_CONTENT = {
	en: {
		title: "Transparency & Trust",
		subtitle: "We believe in open communication. Here's everything you need to know about how we operate, protect your data, and respect your rights.",
		back: "Back",
		center: "Legal Center",
		lastUpdated: "Last updated",
		tabs: {
			terms: { label: 'Terms of Service', desc: "Agreements & Usage" },
			privacy: { label: 'Privacy Policy', desc: "GDPR & Data" },
			imprint: { label: 'Colophon', desc: "Company Info" },
		},
		// Removed "Note on Language:" prefix to avoid duplication if we want to include it in the string, 
		// or we will just use this string as the full alert content.
		disclaimer: "Note on Language: Those terms are legally binding in their English version. Any translations provided are for convenience only. In the event of a discrepancy, the English original prevails.",
		terms: {
			intro: "Welcome to CueVote. These terms govern your use of our platform. By accessing CueVote, you agree to these terms and the YouTube Terms of Service.",
			sections: [
				{
					title: "1. Service & Usage",
					content: "CueVote is a social interface for consuming content via third-party APIs (primarily YouTube). We do not host, store, or distribute media files. Use of the service is personal, non-commercial, and subject to available API quotas."
				},
				{
					title: "2. Integration with YouTube",
					content: `Our service relies on YouTube API Services. By using CueVote, you explicitly agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>. We have no control over YouTube content and assume no liability for its availability or nature.`
				},
				{
					title: "3. User Responsibilities",
					list: [
						"You must be at least 16 years of age.",
						"You are responsible for the security of your session and account.",
						"You agree not to abuse the platform, harass users, or attempt to reverse-engineer our code."
					]
				},
				{
					title: "4. Disclaimer & Liability",
					content: `The service is provided "as is". CueVote disclaims all warranties. To the fullest extent permitted by Dutch law, we shall not be liable for any indirect damages arising from your use of the service.`
				},
				{
					title: "5. Google Privacy Policy",
					content: `Since we utilize YouTube API Services, you acknowledge that by using those services, your data may be processed in accordance with the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.`,
				},
				{
					title: "6. Governing Law",
					content: `These terms are governed by the laws of <strong>The Netherlands</strong>. Any disputes shall be subject to the exclusive jurisdiction of the courts in Amsterdam, unless mandatory consumer protection laws dictate otherwise.`
				}
			]
		},
		privacy: {
			summary: {
				title: "GDPR & Google Data Summary",
				text: "We collect minimal data to make the app work and use YouTube's API for content. We don't sell your data. We respect your privacy rights under European Law (AVG/GDPR)."
			},
			sections: [
				{
					title: "1. Who We Are",
					content: `Data Controller:<br />
                            <strong>${import.meta.env.VITE_LEGAL_NAME || "CueVote Digital"}</strong><br />
                            ${import.meta.env.VITE_LEGAL_ADDRESS_LINE1 || "[Street Address]"}<br />
                            ${import.meta.env.VITE_LEGAL_ADDRESS_LINE2 || "[City, Country]"}, The Netherlands<br />
                            Contact: <a href="mailto:${import.meta.env.VITE_LEGAL_EMAIL || "privacy@cuevote.com"}">${import.meta.env.VITE_LEGAL_EMAIL || "privacy@cuevote.com"}</a>`
				},
				{
					title: "2. Data Collection & Purpose",
					intro: "We process data for specific, legitimate purposes:",
					list: [
						{ title: "Google Account Information", text: "When you login via Google, we verify your identity and store your email, name, and avatar URL to display your profile in rooms. Legal basis: Contract (Art. 6.1.b GDPR)." },
						{ title: "Usage Statistics", text: "We log room history and voted songs to improve recommendations. This data is internal to CueVote. Legal basis: Legitimate Interest (Art. 6.1.f GDPR)." },
						{ title: "YouTube API Data", text: "When you search or play songs, we send requests to YouTube's API. YouTube may collect data on your viewing behavior via their embedded player. Legal basis: Contract/Consent (via your use of YouTube)." },
						{ title: "Server Logs & Security", text: "To ensure the stability and security of our service (e.g., defense against DDoS attacks), we process technical connection data (IP address, timestamp, user agent). These logs are deleted automatically after 14 days. Legal basis: Legitimate Interest (Art. 6.1.f GDPR)." }
					]
				},
				{
					title: "3. Third-Party Processors",
					content: `We engage trusted third parties to operate our infrastructure. We ensure they are GDPR compliant.`,
					listSimple: [
						`<strong>Google/YouTube</strong> (Auth & Content API) - USA. <br /><span class="text-sm">See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</span>`,
						`<strong>Hosting Provider</strong> (Server Infrastructure) - Germany/France (EU)`,
						`<strong>Database Provider</strong> (Data Storage) - EU/USA`
					]
				},
				{
					title: "4. Your Rights",
					content: `You have the right to access, correct, delete, or export your personal data at any time. To exercise these rights ("Right to be Forgotten" or "Revocation of Access"), contact us at the email provided above.
                    <br /><br />
                    You can also revoke our access to your Google Data via the <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Security Settings</a> page.`
				},
				{
					title: "5. Cookies",
					content: `We use only essential local storage to maintain your session (e.g. your login token). We do not use third-party tracking cookies for advertising (marketing cookies) on our own domain, though third-party embeds (YouTube) may set their own cookies.`
				}
			]
		},
		imprint: {
			addressHeading: "Legal Address",
			managedBy: "Managed by",
			country: "The Netherlands",
			contact: "Contact",
			liability: {
				title: "Liability for Content:",
				text: "While we strive for accuracy, we cannot guarantee the completeness or correctness of the information on this website. We are not liable for the content of external links."
			},
			odr: {
				title: "Online Dispute Resolution:",
				text: `The European Commission provides a platform for ODR at <a href="https://ec.europa.eu/consumers/odr" class="text-neutral-400 underline hover:text-white">ec.europa.eu/consumers/odr</a>. We are not obliged to participate in dispute settlement proceedings.`
			}
		}
	},
	nl: {
		title: "Transparantie & Vertrouwen",
		subtitle: "Wij geloven in open communicatie. Hier is alles wat u moet weten over hoe wij werken, uw gegevens beschermen en uw rechten respecteren.",
		back: "Terug",
		center: "Juridisch Centrum",
		lastUpdated: "Laatst bijgewerkt",
		tabs: {
			terms: { label: 'Algemene Voorwaarden', desc: "Overeenkomsten & Gebruik" },
			privacy: { label: 'Privacybeleid', desc: "AVG & Gegevens" },
			imprint: { label: 'Colofon', desc: "Bedrijfsinformatie" },
		},
		disclaimer: "Taalclausule: Deze voorwaarden zijn juridisch bindend in hun Engelse versie. Eventuele vertalingen zijn uitsluitend voor het gemak. In geval van een discrepantie is het Engelse origineel leidend.",
		terms: {
			intro: "Welkom bij CueVote. Deze voorwaarden regelen uw gebruik van ons platform. Door toegang te krijgen tot CueVote, gaat u akkoord met deze voorwaarden en de Servicevoorwaarden van YouTube.",
			sections: [
				{
					title: "1. Dienst & Gebruik",
					content: "CueVote is een sociale interface voor het consumeren van inhoud via API's van derden (voornamelijk YouTube). Wij hosten, bewaren of distribueren geen mediabestanden. Gebruik van de dienst is persoonlijk, niet-commercieel en onderworpen aan beschikbare API-quota."
				},
				{
					title: "2. Integratie met YouTube",
					content: `Onze dienst vertrouwt op YouTube API Services. Door CueVote te gebruiken, gaat u er uitdrukkelijk mee akkoord gebonden te zijn aan de <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Servicevoorwaarden</a>. Wij hebben geen controle over YouTube-inhoud en aanvaarden geen aansprakelijkheid voor de beschikbaarheid of aard ervan.`
				},
				{
					title: "3. Verantwoordelijkheden van de Gebruiker",
					list: [
						"U moet ten minste 16 jaar oud zijn.",
						"U bent verantwoordelijk voor de veiligheid van uw sessie en account.",
						"U gaat ermee akkoord het platform niet te misbruiken, gebruikers lastig te vallen of te proberen onze code te reverse-engineeren."
					]
				},
				{
					title: "4. Disclaimer & Aansprakelijkheid",
					content: `De dienst wordt geleverd \"zoals deze is\". CueVote wijst alle garanties af. Voor zover toegestaan door de Nederlandse wet, zijn wij niet aansprakelijk voor enige indirecte schade die voortvloeit uit uw gebruik van de dienst.`
				},
				{
					title: "5. Google Privacybeleid",
					content: `Aangezien wij gebruikmaken van YouTube API Services, erkent u dat door het gebruik van die diensten uw gegevens kunnen worden verwerkt in overeenstemming met het <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacybeleid</a>.`
				},
				{
					title: "6. Toepasselijk Recht",
					content: `Deze voorwaarden worden beheerst door de wetten van <strong>Nederland</strong>. Eventuele geschillen vallen onder de exclusieve bevoegdheid van de rechtbanken in Amsterdam, tenzij dwingende consumentenbeschermingswetten anders voorschrijven.`
				}
			]
		},
		privacy: {
			summary: {
				title: "AVG & Google Gegevens Samenvatting",
				text: "Wij verzamelen minimale gegevens om de app te laten werken en gebruiken de API van YouTube voor inhoud. Wij verkopen uw gegevens niet. Wij respecteren uw privacyrechten onder de Europese wetgeving (AVG/GDPR)."
			},
			sections: [
				{
					title: "1. Wie Wij Zijn",
					content: `Verwerkingsverantwoordelijke:<br />
                            <strong>${import.meta.env.VITE_LEGAL_NAME || "CueVote Digital"}</strong><br />
                            ${import.meta.env.VITE_LEGAL_ADDRESS_LINE1 || "[Straatadres]"}<br />
                            ${import.meta.env.VITE_LEGAL_ADDRESS_LINE2 || "[Stad, Land]"}, Nederland<br />
                            Contact: <a href="mailto:${import.meta.env.VITE_LEGAL_EMAIL || "privacy@cuevote.com"}">${import.meta.env.VITE_LEGAL_EMAIL || "privacy@cuevote.com"}</a>`
				},
				{
					title: "2. Gegevensverzameling & Doel",
					intro: "Wij verwerken gegevens voor specifieke, legitieme doeleinden:",
					list: [
						{ title: "Google Accountinformatie", text: "Wanneer u inlogt via Google, verifiëren wij uw identiteit en slaan uw e-mail, naam en avatar-URL op om uw profiel in kamers weer te geven. Rechtsgrond: Overeenkomst (Art. 6.1.b AVG)." },
						{ title: "Gebruiksstatistieken", text: "Wij loggen kamergeschiedenis en gestemde nummers om aanbevelingen te verbeteren. Deze gegevens zijn intern voor CueVote. Rechtsgrond: Gerechtvaardigd Belang (Art. 6.1.f AVG)." },
						{ title: "YouTube API Gegevens", text: "Wanneer u zoekt of nummers afspeelt, sturen wij verzoeken naar de API van YouTube. YouTube kan gegevens verzamelen over uw kijkgedrag via hun embedded speler. Rechtsgrond: Overeenkomst/Toestemming (via uw gebruik van YouTube)." },
						{ title: "Serverlogs & Beveiliging", text: "Om de stabiliteit en veiligheid van onze dienst te garanderen (bijv. verdediging tegen DDoS-aanvallen), verwerken wij technische verbindingsgegevens (IP-adres, tijdstempel, user agent). Deze logs worden automatisch verwijderd na 14 dagen. Rechtsgrond: Gerechtvaardigd Belang (Art. 6.1.f AVG)." }
					]
				},
				{
					title: "3. Derde Verwerkers",
					content: `Wij schakelen vertrouwde derden in om onze infrastructuur te beheren. Wij zorgen ervoor dat zij AVG-compliant zijn.`,
					listSimple: [
						`<strong>Google/YouTube</strong> (Auth & Content API) - VS. <br /><span class="text-sm">Zie <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacybeleid</a>.</span>`,
						`<strong>Hosting Provider</strong> (Server Infrastructuur) - Duitsland/Frankrijk (EU)`,
						`<strong>Database Provider</strong> (Gegevensopslag) - EU/VS`
					]
				},
				{
					title: "4. Uw Rechten",
					content: `U heeft te allen tijde het recht om uw persoonlijke gegevens in te zien, te corrigeren, te verwijderen of te exporteren. Om deze rechten uit te oefenen (\"Recht om vergeten te worden\"), neem contact met ons op via het bovenstaande e-mailadres.
                    <br /><br />
                    U kunt ook onze toegang tot uw Google Gegevens intrekken via de <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Beveiligingsinstellingen</a> pagina.`
				},
				{
					title: "5. Cookies",
					content: `Wij gebruiken alleen essentiële lokale opslag om uw sessie te onderhouden (bijv. uw login token). Wij gebruiken geen tracking cookies van derden voor advertenties op ons eigen domein, hoewel embeds van derden (YouTube) hun eigen cookies kunnen plaatsen.`
				}
			]
		},
		imprint: {
			addressHeading: "Juridisch Adres",
			managedBy: "Beheerd door",
			country: "Nederland",
			contact: "Contact",
			liability: {
				title: "Aansprakelijkheid voor Inhoud:",
				text: "Hoewel wij streven naar nauwkeurigheid, kunnen wij de volledigheid of juistheid van de informatie op deze website niet garanderen. Wij zijn niet aansprakelijk voor de inhoud van externe links."
			},
			odr: {
				title: "Online Geschillenbeslechting:",
				text: `De Europese Commissie biedt een platform voor ODR op <a href="https://ec.europa.eu/consumers/odr" class="text-neutral-400 underline hover:text-white">ec.europa.eu/consumers/odr</a>. Wij zijn niet verplicht deel te nemen aan geschillenbeslechtingsprocedures.`
			}
		}
	}
};

// --- Language Variants (UI Translated, Legal Content in English) ---

// German
// German
LEGAL_CONTENT.de = withEnglishContent({
	title: "Transparenz & Vertrauen",
	subtitle: "Wir glauben an offene Kommunikation. Hier finden Sie alles, was Sie darüber wissen müssen, wie wir arbeiten, Ihre Daten schützen und Ihre Rechte respektieren.",
	back: "Zurück",
	center: "Rechtszentrum",
	lastUpdated: "Zuletzt aktualisiert",
	disclaimer: "Hinweis: Diese Bedingungen sind nur in englischer Sprache verfügbar. Die englische Version ist allein rechtlich bindend."
});

// French
LEGAL_CONTENT.fr = withEnglishContent({
	title: "Transparence & Confiance",
	subtitle: "Nous croyons en une communication ouverte. Voici tout ce que vous devez savoir sur notre fonctionnement, la protection de vos données et le respect de vos droits.",
	back: "Retour",
	center: "Centre Juridique",
	lastUpdated: "Dernière mise à jour",
	disclaimer: "Note : Ces conditions sont uniquement disponibles en anglais. La version anglaise est la seule juridiquement contraignante."
});

// Spanish
LEGAL_CONTENT.es = withEnglishContent({
	title: "Transparencia y Confianza",
	subtitle: "Creemos en la comunicación abierta. Aquí tienes todo lo que necesitas saber sobre cómo operamos, protegemos tus datos y respetamos tus derechos.",
	back: "Atrás",
	center: "Centro Legal",
	lastUpdated: "Última actualización",
	disclaimer: "Nota: Estos términos solo están disponibles en inglés. La versión en inglés es la única legalmente vinculante."
});

// Italian
LEGAL_CONTENT.it = withEnglishContent({
	title: "Trasparenza e Fiducia",
	subtitle: "Crediamo nella comunicazione aperta. Ecco tutto ciò che devi sapere su come operiamo, proteggiamo i tuoi dati e rispettiamo i tuoi diritti.",
	back: "Indietro",
	center: "Centro Legale",
	lastUpdated: "Ultimo aggiornamento",
	disclaimer: "Nota: Questi termini sono disponibili solo in inglese. La versione inglese è l'unica giuridicamente vincolante."
});

// Portuguese
LEGAL_CONTENT.pt = withEnglishContent({
	title: "Transparência e Confiança",
	subtitle: "Acreditamos na comunicação aberta. Aqui está tudo o que você precisa saber sobre como operamos, protegemos seus dados e respeitamos seus direitos.",
	back: "Voltar",
	center: "Centro Legal",
	lastUpdated: "Última atualização",
	disclaimer: "Nota: Estes termos estão disponíveis apenas em inglês. A versão em inglês é a única legalmente vinculativa."
});

// Chinese (Simplified)
LEGAL_CONTENT['zh-CN'] = withEnglishContent({
	title: "透明度与信任",
	subtitle: "我们相信开放的沟通。这里有您需要了解的关于我们要如何运作、保护您的数据以及尊重您的权利的所有信息。",
	back: "返回",
	center: "法律中心",
	lastUpdated: "最后更新",
	disclaimer: "注意：这些条款仅提供英文版本。英文版本具有唯一法律约束力。"
});

// Chinese (Traditional)
LEGAL_CONTENT['zh-TW'] = withEnglishContent({
	title: "透明度與信任",
	subtitle: "我們相信開放的溝通。這裡有您需要了解的關於我們要如何運作、保護您的數據以及尊重您的權利的所有信息。",
	back: "返回",
	center: "法律中心",
	lastUpdated: "最後更新",
	disclaimer: "注意：這些條款僅提供英文版本。英文版本具有唯一法律約束力。"
});

// Japanese
LEGAL_CONTENT.ja = withEnglishContent({
	title: "透明性と信頼",
	subtitle: "私たちはオープンなコミュニケーションを信じています。私たちがどのように運営し、データを保護し、権利を尊重しているかについて知っておくべきすべての情報がここにあります。",
	back: "戻る",
	center: "法務センター",
	lastUpdated: "最終更新",
	disclaimer: "注：これらの条件は英語でのみ利用可能です。英語版のみが法的拘束力を持ちます。"
});

// Korean
LEGAL_CONTENT.ko = withEnglishContent({
	title: "투명성 및 신뢰",
	subtitle: "우리는 열린 소통을 믿습니다. 우리가 운영하는 방식, 데이터를 보호하는 방식, 그리고 귀하의 권리를 존중하는 방식에 대해 알아야 할 모든 것이 여기에 있습니다.",
	back: "뒤로",
	center: "법률 센터",
	lastUpdated: "마지막 업데이트",
	disclaimer: "참고: 이 약관은 영어로만 제공됩니다. 영어 버전만이 법적 구속력이 있습니다."
});
