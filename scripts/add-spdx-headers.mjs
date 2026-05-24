#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
// Idempotently prepend SPDX + copyright headers to every first-party source
// file. Skips files that already carry a header, files under node_modules,
// build output, and the dist/ folders.
//
// Run with: node scripts/add-spdx-headers.mjs

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ROOTS = [
	'cuevote-client/src',
	'cuevote-client/scripts',
	'cuevote-server',
	'scripts',
];

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.next', 'coverage']);

const HEADER = `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
`;

const HEADER_MARKER = 'SPDX-License-Identifier';
const LEGACY_MARKER = 'Copyright (c) 2026 Julian Zienert';

function hasHeader(content) {
	const head = content.slice(0, 400);
	return head.includes(HEADER_MARKER) || head.includes(LEGACY_MARKER);
}

function walk(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const e of entries) {
		if (EXCLUDE_DIRS.has(e.name)) continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			walk(p, out);
		} else if (/\.(jsx?|mjs)$/.test(e.name)) {
			out.push(p);
		}
	}
	return out;
}

function processFile(file) {
	const original = readFileSync(file, 'utf8');
	if (hasHeader(original)) return { file, skipped: true };

	// Preserve shebang lines: header goes AFTER the shebang.
	let prefix = '';
	let body = original;
	if (body.startsWith('#!')) {
		const nl = body.indexOf('\n');
		if (nl !== -1) {
			prefix = body.slice(0, nl + 1);
			body = body.slice(nl + 1);
		}
	}

	writeFileSync(file, prefix + HEADER + body);
	return { file, skipped: false };
}

let added = 0;
let skipped = 0;
for (const rel of ROOTS) {
	const base = join(ROOT, rel);
	for (const file of walk(base)) {
		const result = processFile(file);
		if (result.skipped) {
			skipped += 1;
		} else {
			added += 1;
			console.log(`+ ${relative(ROOT, result.file)}`);
		}
	}
}

console.log(`\nAdded ${added} headers, skipped ${skipped} files that already had one.`);
