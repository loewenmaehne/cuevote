#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
// SPDX header guardrail: fails CI when a first-party source file is missing
// the SPDX-License-Identifier marker. Mirrors scripts/add-spdx-headers.mjs in
// roots/extensions/exclusions, and scripts/check-licenses.mjs in spirit
// (strict, non-zero exit on any failure).
//
// Run locally: node scripts/check-spdx-headers.mjs

import { readdirSync, readFileSync } from 'node:fs';
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

const HEADER_MARKER = 'SPDX-License-Identifier';

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

const missing = [];
let checked = 0;
for (const rel of ROOTS) {
	const base = join(ROOT, rel);
	for (const file of walk(base)) {
		checked += 1;
		const head = readFileSync(file, 'utf8').slice(0, 400);
		if (!head.includes(HEADER_MARKER)) {
			missing.push(relative(ROOT, file));
		}
	}
}

if (missing.length > 0) {
	console.error(`Missing SPDX header in ${missing.length} file(s):`);
	for (const file of missing) {
		console.error(`  - ${file}`);
	}
	console.error('');
	console.error('Run `node scripts/add-spdx-headers.mjs` to add the standard header,');
	console.error('then commit the result.');
	process.exit(1);
}

console.log(`SPDX headers OK — ${checked} files checked.`);
