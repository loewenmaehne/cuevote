// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
import DOMPurify from 'dompurify';

// Defence-in-depth wrapper for every dangerouslySetInnerHTML in the app.
// The only HTML sources today are developer-authored translation strings
// and legalContent.js (also developer-authored), but a future community
// translator should not be able to ship XSS by submitting a tainted
// <script>-bearing translation PR. The allow-list matches what those
// strings actually use — a/strong/em/b/br/span — nothing else.
const ALLOWED_TAGS = ['a', 'strong', 'em', 'b', 'br', 'span'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

export function sanitizeHtml(html) {
	if (typeof html !== 'string') return '';
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		// Force every <a target="_blank"> through noopener+noreferrer even
		// if the source forgot it. Belt-and-suspenders with the audited
		// rel="noopener noreferrer" in legalContent.js.
		ADD_ATTR: ['target'],
	});
}

// Use this with dangerouslySetInnerHTML:
//   <p dangerouslySetInnerHTML={dangerousHtml(t('lobby.deleteAccountWarning'))} />
export function dangerousHtml(html) {
	return { __html: sanitizeHtml(html) };
}
