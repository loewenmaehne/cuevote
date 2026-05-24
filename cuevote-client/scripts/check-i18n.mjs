#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
// i18n guardrail: fails CI when translations.js drifts out of sync with the
// strings actually used in the React source.
//
// Checks (all strict — non-zero exit on any failure):
//   1. Undefined keys       — every t('section.key') in *.jsx/*.js resolves in en.
//   2. Missing keys         — every other language has every key that en defines.
//   3. Placeholder parity   — {placeholder} tokens in en match every translation
//                             of the same key (no typos like {counts} vs {count}).
//   4. Plural-bag shape     — keys that are plural bags in en must also be plural
//                             bags in every other language (no string/object mix).
//   5. Plural completeness  — for every plural-bag key, each language must define
//                             every CLDR category required by Intl.PluralRules.
//
// A "plural bag" is an object whose keys are all CLDR plural categories
// (zero, one, two, few, many, other). Plural bags are treated as LEAF values,
// not nested sections, so flatKeys('library.videos') yields 'library.videos'
// rather than 'library.videos.one', 'library.videos.other', ...
//
// HTML tag parity is intentionally NOT enforced: existing entries vary slightly
// (e.g. <strong> wrapping different words) and a strict check would create
// false positives. Re-add later if it proves valuable.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const SRC_DIR = join(ROOT, 'src');
const TRANSLATIONS_PATH = join(ROOT, 'src/contexts/translations.js');

const { translations } = await import(pathToFileURL(TRANSLATIONS_PATH).href);

const errors = [];
function fail(msg) { errors.push(msg); }

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function isPluralBag(v) {
	if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
	const keys = Object.keys(v);
	if (keys.length === 0) return false;
	return keys.every((k) => PLURAL_CATEGORIES.has(k));
}

function flatKeys(obj, prefix = '') {
	const out = new Set();
	for (const k of Object.keys(obj)) {
		const v = obj[k];
		const path = prefix ? `${prefix}.${k}` : k;
		if (v !== null && typeof v === 'object' && !Array.isArray(v) && !isPluralBag(v)) {
			for (const k2 of flatKeys(v, path)) out.add(k2);
		} else {
			out.add(path);
		}
	}
	return out;
}

function getByPath(obj, path) {
	return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function walkJsFiles(dir, files = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) walkJsFiles(p, files);
		else if (/\.(js|jsx)$/.test(entry.name)) files.push(p);
	}
	return files;
}

// --- 1. Collect keys used in source ---
const usage = new Map(); // key -> [{ file, line }]
for (const file of walkJsFiles(SRC_DIR)) {
	const src = readFileSync(file, 'utf8');
	const lines = src.split('\n');
	for (let i = 0; i < lines.length; i++) {
		// Matches t('key'), t("key"), t(`key`) — also tolerates leading word chars
		// so we don't catch things like `setT('foo')`.
		const re = /(?:^|[^a-zA-Z0-9_$])t\(\s*['"`]([\w.]+)['"`]/g;
		for (const m of lines[i].matchAll(re)) {
			const key = m[1];
			if (!usage.has(key)) usage.set(key, []);
			usage.get(key).push({ file: relative(ROOT, file), line: i + 1 });
		}
	}
}

// --- 2. Reference key set from en ---
const enKeys = flatKeys(translations.en);

// --- Check 1: undefined keys ---
for (const [key, locations] of usage) {
	if (!enKeys.has(key)) {
		const loc = locations.map((l) => `${l.file}:${l.line}`).join(', ');
		fail(`undefined key: t('${key}') referenced but missing in translations.en  (${loc})`);
	}
}

// --- Check 2: missing keys per language ---
for (const lang of Object.keys(translations)) {
	if (lang === 'en') continue;
	const langKeys = flatKeys(translations[lang]);
	for (const key of enKeys) {
		if (!langKeys.has(key)) {
			fail(`missing key: translations.${lang} is missing '${key}' (defined in en)`);
		}
	}
}

// --- Check 3: placeholder parity ---
const PLACEHOLDER_RE = /\{(\w+)\}/g;
function placeholdersOf(str) {
	if (typeof str !== 'string') return null;
	const set = new Set();
	for (const m of str.matchAll(PLACEHOLDER_RE)) set.add(m[1]);
	return [...set].sort();
}

function pluralBagPlaceholders(bag) {
	const set = new Set();
	for (const v of Object.values(bag)) {
		if (typeof v !== 'string') continue;
		for (const m of v.matchAll(PLACEHOLDER_RE)) set.add(m[1]);
	}
	return [...set].sort();
}

for (const key of enKeys) {
	const enVal = getByPath(translations.en, key);
	const enIsBag = isPluralBag(enVal);
	const enPh = enIsBag ? pluralBagPlaceholders(enVal) : placeholdersOf(enVal);
	if (!enPh || enPh.length === 0) continue;
	for (const lang of Object.keys(translations)) {
		if (lang === 'en') continue;
		const val = getByPath(translations[lang], key);
		if (val == null) continue; // missing-key error already raised
		const langIsBag = isPluralBag(val);
		if (enIsBag !== langIsBag) continue; // shape-mismatch error raised in check 4
		const ph = langIsBag ? pluralBagPlaceholders(val) : placeholdersOf(val);
		if (ph == null) continue;
		const sameSet =
			ph.length === enPh.length && ph.every((p) => enPh.includes(p));
		if (!sameSet) {
			fail(
				`placeholder mismatch: translations.${lang}.${key} has [${ph.join(', ')}], en has [${enPh.join(', ')}]`,
			);
		}
	}
}

// --- Check 4: plural-bag shape consistency ---
// If en marks a key as a plural bag, every language must also use a plural bag
// (and vice versa — no language may sneak in a plural bag without en doing so).
const enPluralKeys = new Set();
for (const key of enKeys) {
	if (isPluralBag(getByPath(translations.en, key))) enPluralKeys.add(key);
}
for (const lang of Object.keys(translations)) {
	if (lang === 'en') continue;
	for (const key of enPluralKeys) {
		const val = getByPath(translations[lang], key);
		if (val == null) continue; // missing-key error already raised
		if (!isPluralBag(val)) {
			fail(
				`plural shape mismatch: translations.${lang}.${key} is a ${typeof val}, but en defines it as a plural object`,
			);
		}
	}
	const langKeys = flatKeys(translations[lang]);
	for (const key of langKeys) {
		const val = getByPath(translations[lang], key);
		if (isPluralBag(val) && !enPluralKeys.has(key)) {
			fail(
				`plural shape mismatch: translations.${lang}.${key} is a plural object, but en defines it as ${typeof getByPath(translations.en, key)}`,
			);
		}
	}
}

// --- Check 5: plural category completeness ---
// For every plural-bag key, each language must provide a string for every
// CLDR category that Intl.PluralRules requires for that locale.
const pluralRulesCache = new Map();
function getRequiredCategories(lang) {
	let cats = pluralRulesCache.get(lang);
	if (!cats) {
		cats = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
		pluralRulesCache.set(lang, cats);
	}
	return cats;
}
for (const key of enPluralKeys) {
	for (const lang of Object.keys(translations)) {
		const val = getByPath(translations[lang], key);
		if (!isPluralBag(val)) continue; // shape-mismatch error raised separately
		const required = getRequiredCategories(lang);
		for (const cat of required) {
			if (typeof val[cat] !== 'string') {
				fail(
					`plural form missing: translations.${lang}.${key}.${cat} is required for ${lang} (${required.join(', ')})`,
				);
			}
		}
	}
}

// --- Report ---
const langCount = Object.keys(translations).length;
if (errors.length === 0) {
	console.log(
		`i18n OK — ${enKeys.size} keys × ${langCount} languages, ${usage.size} keys referenced from source, ${enPluralKeys.size} plural-bag keys.`,
	);
	process.exit(0);
}

console.error(`i18n FAILED with ${errors.length} issue(s):`);
for (const e of errors) console.error('  • ' + e);
process.exit(1);
