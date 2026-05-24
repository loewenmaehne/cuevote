#!/usr/bin/env node
// Generate NOTICES.md in the repo root from `license-checker` output for both
// cuevote-client and cuevote-server. Runs license-checker via npx so no
// pre-installation is required.
//
// Re-run with: node scripts/build-notices.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PROJECTS = [
	{
		heading: 'Frontend (`cuevote-client`)',
		dir: join(ROOT, 'cuevote-client'),
		selfPackages: ['cuevote-client'],
	},
	{
		heading: 'Backend (`cuevote-server`)',
		dir: join(ROOT, 'cuevote-server'),
		selfPackages: ['cuevote-server'],
	},
];

const LICENSE_TEXTS = {
	MIT: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
	ISC: `Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
	'BSD-2-Clause': `Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
	'BSD-3-Clause': `Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
	'Apache-2.0': `Licensed under the Apache License, Version 2.0 (the "License"); you may not use these files except in compliance with the License. You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.`,
};

const DUAL_LICENSE_CHOICES = {
	'(BSD-2-Clause OR MIT OR Apache-2.0)': 'MIT',
	'(MIT OR WTFPL)': 'MIT',
};

function runLicenseChecker(dir) {
	const out = execFileSync(
		'npx',
		['--yes', 'license-checker', '--production', '--excludePrivatePackages', '--json'],
		{ cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);
	return JSON.parse(out);
}

function getDirectDeps(dir) {
	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	return new Set(Object.keys(pkg.dependencies || {}));
}

function parsePackageKey(key) {
	const at = key.lastIndexOf('@');
	return { name: key.slice(0, at), version: key.slice(at + 1) };
}

function effectiveLicense(raw) {
	if (raw in DUAL_LICENSE_CHOICES) return DUAL_LICENSE_CHOICES[raw];
	if (Array.isArray(raw)) return raw[0];
	return raw;
}

function escapeCell(s) {
	return String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function row(pkg) {
	const repo = pkg.repository ? `[source](${pkg.repository})` : '—';
	return `| ${escapeCell(pkg.name)} | ${escapeCell(pkg.version)} | ${escapeCell(pkg.license)} | ${escapeCell(pkg.publisher)} | ${repo} |`;
}

function buildProjectSection(project) {
	const direct = getDirectDeps(project.dir);
	const raw = runLicenseChecker(project.dir);
	const entries = [];
	for (const [key, info] of Object.entries(raw)) {
		const { name, version } = parsePackageKey(key);
		if (project.selfPackages.includes(name)) continue;
		entries.push({
			name,
			version,
			license: effectiveLicense(info.licenses),
			rawLicense: info.licenses,
			publisher: info.publisher,
			repository: info.repository,
			isDirect: direct.has(name),
		});
	}
	entries.sort((a, b) => a.name.localeCompare(b.name));

	const directEntries = entries.filter((e) => e.isDirect);
	const transitiveEntries = entries.filter((e) => !e.isDirect);

	const header = `| Package | Version | License | Copyright | Source |
| --- | --- | --- | --- | --- |`;

	const sections = [`## ${project.heading}`, ''];

	sections.push(`### Direct dependencies (${directEntries.length})`, '');
	sections.push(header);
	for (const e of directEntries) sections.push(row(e));
	sections.push('');

	if (transitiveEntries.length > 0) {
		sections.push(
			`### Transitive dependencies (${transitiveEntries.length})`,
			'',
			'<details><summary>Show transitive packages</summary>',
			'',
			header,
		);
		for (const e of transitiveEntries) sections.push(row(e));
		sections.push('', '</details>', '');
	}

	return { markdown: sections.join('\n'), entries };
}

function licenseSet(allEntries) {
	const set = new Set();
	for (const e of allEntries) set.add(e.license);
	return set;
}

function buildLicenseTextsSection(licensesUsed) {
	const ordered = [...licensesUsed].sort();
	const out = ['## License Texts', ''];
	out.push(
		'The following license texts apply to the components listed above. Each component remains under its own copyright; see the per-package source link for the original `LICENSE` file.',
		'',
	);
	for (const lic of ordered) {
		if (!(lic in LICENSE_TEXTS)) {
			out.push(`### ${lic}`, '', `_(license text not bundled — see the source link of the affected packages above)_`, '');
			continue;
		}
		out.push(`### ${lic}`, '', LICENSE_TEXTS[lic], '');
	}
	return out.join('\n');
}

function buildDualLicenseNote(allEntries) {
	const duals = allEntries.filter((e) => e.rawLicense in DUAL_LICENSE_CHOICES);
	if (duals.length === 0) return '';
	const lines = ['## Notes on Dual-Licensed Packages', ''];
	lines.push(
		'The following packages offer a choice of licenses. CueVote elects the indicated license:',
		'',
	);
	for (const e of duals) {
		lines.push(`- \`${e.name}@${e.version}\` — offered as \`${e.rawLicense}\`, used under **${e.license}**`);
	}
	lines.push('');
	return lines.join('\n');
}

function main() {
	const today = new Date().toISOString().slice(0, 10);
	const all = [];
	const sections = [];
	for (const project of PROJECTS) {
		const { markdown, entries } = buildProjectSection(project);
		sections.push(markdown);
		all.push(...entries);
	}

	const head = `# Third-Party Notices

CueVote (the "Software") is licensed under the PolyForm Noncommercial License 1.0.0 — see [LICENSE](LICENSE).

The Software bundles or links to the open-source components listed below, each governed by its own license. Where a license requires preservation of its copyright notice and permission text (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0), this file satisfies that requirement. The per-package "source" link points to the upstream repository where the original \`LICENSE\` file with the individual copyright line can be found.

This file is generated from \`npx license-checker --production\` by [\`scripts/build-notices.mjs\`](scripts/build-notices.mjs). Do not edit by hand — re-run the script after dependency changes.

_Last generated: ${today}_

---
`;

	const dualNote = buildDualLicenseNote(all);
	const licensesUsed = licenseSet(all);
	const licenseTexts = buildLicenseTextsSection(licensesUsed);

	const md = [head, sections.join('\n---\n\n'), dualNote, '---', '', licenseTexts].filter(Boolean).join('\n');
	const outPath = join(ROOT, 'NOTICES.md');
	writeFileSync(outPath, md);
	console.log(`Wrote ${outPath} (${all.length} packages across ${PROJECTS.length} projects).`);
}

main();
