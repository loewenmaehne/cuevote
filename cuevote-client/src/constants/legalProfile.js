// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert

/**
 * Single source of truth for the site operator's legal identity.
 *
 * One switch — VITE_LEGAL_MODE = "noncommercial" (default) | "commercial" —
 * selects a complete, self-consistent profile that feeds both the Colophon
 * (LegalPage.jsx) and the GDPR "Data Controller" block (legalContent.js).
 *
 * Design rules:
 *   1. Fail-safe: an unset or unknown VITE_LEGAL_MODE resolves to the
 *      non-commercial identity. No field ever falls back to a placeholder
 *      like "[Street Address]" or a phantom name — a missing env var can
 *      never leak a wrong address onto the live imprint.
 *   2. Mode toggles the whole identity at once. Non-commercial shows the
 *      operator's name + city only (all the GDPR controller identification
 *      and the — non-applicable — Dutch imprint duty require of a private,
 *      non-commercial project). Commercial adds the registered street
 *      address, KvK and VAT number.
 *   3. Business-specific values (real street address, KvK, VAT) live in env,
 *      not in the repo, and surface only in commercial mode.
 *
 * When CueVote goes commercial: set VITE_LEGAL_MODE=commercial and fill the
 * VITE_LEGAL_* business vars (name, address, KvK, VAT). Nothing else changes.
 */

const MODE = (import.meta.env.VITE_LEGAL_MODE || 'noncommercial').toLowerCase();

// Colophon contact + abuse addresses are operator-level and shared by both
// modes; they read their own clean vars, never the VITE_LEGAL_* business set.
const contactEmail = import.meta.env.VITE_IMPRINT_EMAIL || 'hello@cuevote.com';
const abuseEmail = import.meta.env.VITE_ABUSE_EMAIL || 'abuse@cuevote.com';

// Non-commercial: a privately operated, non-commercial project.
// No trade registration, no business address — name + city is the whole identity.
const nonCommercialProfile = {
	mode: 'noncommercial',
	isCommercial: false,
	// Fixed in code — deliberately NOT read from the VITE_LEGAL_* business vars.
	// A stale deployment env (e.g. an old street address, or a "c/o Reception"
	// name left in .env) can therefore never leak back onto the imprint.
	// City only; the country is appended, localized, by the renderer.
	entityName: 'Julian Zienert',
	addressLines: ['Amsterdam'],
	kvk: null,
	vat: null,
	phone: null,
	// Fixed too — the VITE_LEGAL_EMAIL var holds a stale Codam student address.
	controllerEmail: 'privacy@cuevote.com',
	contactEmail,
	abuseEmail,
};

// Commercial: a registered business. Real street address, KvK and VAT come
// from env — set them when flipping the switch, or the block renders empty
// (a visible "unfinished" state, never a phantom placeholder).
const commercialProfile = {
	mode: 'commercial',
	isCommercial: true,
	entityName: import.meta.env.VITE_LEGAL_NAME || 'CueVote B.V.',
	addressLines: [
		import.meta.env.VITE_LEGAL_ADDRESS_LINE1,
		import.meta.env.VITE_LEGAL_ADDRESS_LINE2,
	].filter(Boolean),
	kvk: import.meta.env.VITE_LEGAL_KVK || null,
	vat: import.meta.env.VITE_LEGAL_VAT || null,
	phone: import.meta.env.VITE_LEGAL_PHONE || null,
	controllerEmail: import.meta.env.VITE_LEGAL_EMAIL || 'privacy@cuevote.com',
	contactEmail,
	abuseEmail,
};

export const legalProfile = MODE === 'commercial' ? commercialProfile : nonCommercialProfile;
