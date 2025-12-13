const assert = require('assert');
const { parse } = require('@babel/parser');

// NOTE: This is a node-side regression test that mirrors the inline-edit regex fast-path
// in [`tryFastPathTextChange()`](utils/generateSourcePatch.ts:751).
// It specifically guards against a String.replace() callback footgun where
// a 1-capture regex causes arg2 to be the numeric offset (which previously got appended,
// corrupting string literals like: return 'Join26627;).

function tryFastPathTextChange(originalContent, oldText, newText, sourceLine) {
  const escapedOld = String(oldText).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    // JSX text content: >OldText<
    new RegExp(`(>\\s*)${escapedOld}(\\s*<)`, 'g'),
    // String literals in JSX/TS/TSX: "OldText" or 'OldText'
    // IMPORTANT: capture the closing quote explicitly to avoid offset being treated as p2.
    new RegExp(`(['"])${escapedOld}(\\1)`, 'g'),
    // Template literals: `OldText`
    new RegExp('(\\`)' + escapedOld + '(\\`)', 'g'),
  ];

  const replaceFirstMatchInScope = (scope) => {
    for (const pattern of patterns) {
      const match = pattern.exec(scope);
      pattern.lastIndex = 0;
      if (!match) continue;

      const patchedScope = scope.replace(pattern, (m, p1, p2) => `${p1}${newText}${p2 || p1}`);
      if (patchedScope !== scope) return patchedScope;
    }
    return null;
  };

  if (sourceLine && Number.isFinite(sourceLine)) {
    const lines = originalContent.split('\n');
    let targetLine = sourceLine;
    if (targetLine > lines.length) targetLine = lines.length;
    if (targetLine < 1) targetLine = 1;

    const searchRadius = 80;
    const startSearch = Math.max(0, targetLine - searchRadius - 1);
    const endSearch = Math.min(lines.length, targetLine + searchRadius);

    const scoped = lines.slice(startSearch, endSearch).join('\n');
    const patchedScoped = replaceFirstMatchInScope(scoped);
    if (patchedScoped) {
      const before = lines.slice(0, startSearch);
      const after = lines.slice(endSearch);
      return [...before, ...patchedScoped.split('\n'), ...after].join('\n');
    }
  }

  // If scoped replacement failed, only replace globally when the oldText appears once.
  const occurrenceCount = (() => {
    if (!oldText) return 0;
    let count = 0;
    let idx = 0;
    while (true) {
      const next = originalContent.indexOf(oldText, idx);
      if (next === -1) break;
      count++;
      idx = next + oldText.length;
      if (count > 1) break;
    }
    return count;
  })();

  if (occurrenceCount === 1) {
    const patched = replaceFirstMatchInScope(originalContent);
    if (patched) return patched;
  }

  return null;
}

// -------------------------------
// Regression: TSX string literals
// -------------------------------
{
  const original = [
    "import React from 'react';",
    'export function Demo() {',
    '  const foo: string = \'x\';',
    '  switch (foo) {',
    "    default: return 'Joined';",
    '  }',
    '}',
    '',
  ].join('\n');

  const patched = tryFastPathTextChange(original, 'Joined', 'Join', 5);
  assert.ok(patched, 'expected fast-path to produce a patch');

  // Must not append numeric offsets into string literals.
  assert.ok(!/Join\d+;/.test(patched), `unexpected offset append in output: ${patched}`);
  assert.ok(patched.includes("return 'Join';"), 'expected output to contain the updated string literal');

  // Must parse as valid TSX.
  assert.doesNotThrow(() => {
    parse(patched, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  });
}

console.log('OK: generateSourcePatch fast-path text replacement regressions');

// ---------------------------------------------------------------------
// Regression: line=0 (unreliable source line) + multiple oldText hits
// Ensures we can derive an effective target line first, then fast-path.
// Mirrors the ordering fix in [`generateSourcePatch()`](utils/generateSourcePatch.ts:1709).
// ---------------------------------------------------------------------
{
  // Build a fake TSX file with "Download" present twice:
  // - once early (outside the scoped radius)
  // - once later in JSX at the target location
  const filler = (n) => Array.from({ length: n }, (_, i) => `// filler ${i + 1}`).join('\n');
  const original = [
    "import React from 'react';",
    "// Download (this is an earlier occurrence that should NOT be changed)",
    filler(40),
    'export function LandingPage() {',
    '  return (',
    '    <main>',
    filler(140),
    '      <button className="cta">Download</button>',
    '    </main>',
    '  );',
    '}',
    '',
  ].join('\n');

  // Simulate Web Inspector sourceLocation line=0
  const sourceLine = 0;
  const oldText = 'Download';
  const newText = 'Join Our Discord';

  // With line=0, scoped replacement is skipped and global replacement is unsafe
  // because oldText appears more than once.
  const patchedWithoutEffectiveLine = tryFastPathTextChange(original, oldText, newText, sourceLine);
  assert.strictEqual(patchedWithoutEffectiveLine, null, 'expected fast-path to fail without an effective target line');

  // Derive an effective target line by searching for the oldText in JSX-ish context.
  const lines = original.split('\n');
  const deriveEffectiveTargetLine = () => {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(oldText)) continue;
      const nearby = `${lines[i - 1] || ''}\n${lines[i]}\n${lines[i + 1] || ''}`;
      if (/<\w/.test(nearby) || /<\//.test(nearby) || />/.test(nearby)) return i + 1;
    }
    return 1;
  };

  const effectiveTargetLine = deriveEffectiveTargetLine();
  assert.ok(effectiveTargetLine > 0, 'expected an effective target line > 0');

  const patched = tryFastPathTextChange(original, oldText, newText, effectiveTargetLine);
  assert.ok(patched, 'expected fast-path to succeed after deriving an effective target line');
  assert.ok(patched.includes(`<button className="cta">${newText}</button>`), 'expected button text to be updated');
  assert.ok(
    patched.includes('// Download (this is an earlier occurrence that should NOT be changed)'),
    'expected earlier occurrence to remain unchanged'
  );

  // Must parse as valid TSX.
  assert.doesNotThrow(() => {
    parse(patched, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  });
}

console.log('OK: line=0 effective target line → scoped fast-path text replacement regression');

// ---------------------------------------------------------------------
// Regression: CSS style edit with line=0 + SVG <path> with no class/id.
// Ensures we can derive a stable target line from attributes (e.g. d="...")
// and apply a CSS fast-path change WITHOUT falling back to AI.
// Mirrors the attribute-based extension in [`tryFastPathCssChange()`](utils/generateSourcePatch.ts:848)
// and line derivation via [`deriveEffectiveTargetLine()`](utils/generateSourcePatch.ts:1715).
// ---------------------------------------------------------------------
{
  const filler = (n) => Array.from({ length: n }, (_, i) => `// filler ${i + 1}`).join('\n');

  const d1 = 'M0 0h24v24H0z';
  const d2 = 'M10 10 L20 10 L20 20 Z';

  const original = [
    "import React from 'react';",
    filler(60),
    'export function IconDemo() {',
    '  return (',
    '    <div>',
    filler(80),
    '      <svg width="24" height="24" viewBox="0 0 24 24">',
    `        <path d="${d1}" />`,
    `        <path d="${d2}" />`,
    '      </svg>',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');

  const element = {
    tagName: 'path',
    className: '',
    id: '',
    attributes: { d: d2 },
    text: '',
  };

  const cssChanges = { fill: 'red' };

  const pickStableAttributes = (attrs) => {
    if (!attrs) return [];
    const banned = new Set(['class', 'className', 'id', 'style', 'data-cluso-id', 'data-cluso-name', 'data-cluso-ui']);
    const entries = Object.entries(attrs)
      .map(([name, value]) => ({ name: String(name || '').trim(), value: String(value || '').trim() }))
      .filter(({ name, value }) => !!name && !!value && !banned.has(name));
    const weightFor = (name, value) => {
      if (name === 'd') return 100;
      if (name === 'href' || name === 'xlink:href') return 80;
      if (name === 'src') return 80;
      if (name === 'aria-label') return 70;
      if (name === 'viewBox') return 60;
      return Math.min(40, Math.max(10, value.length));
    };
    return entries
      .map(({ name, value }) => ({ name, value, weight: weightFor(name, value) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
  };

  const matchesAttrInTagText = (tagText, name, value) => {
    if (!tagText || !name || !value) return false;
    if (!tagText.includes(`${name}=`)) return false;
    if (tagText.includes(value)) return true;
    const prefixLen = Math.min(64, Math.max(12, Math.floor(value.length / 3)));
    const prefix = value.slice(0, prefixLen);
    if (prefix && tagText.includes(prefix)) return true;
    const normalized = value.replace(/\s+/g, ' ').trim();
    const normalizedPrefix = normalized.slice(0, prefixLen);
    return !!normalizedPrefix && tagText.replace(/\s+/g, ' ').includes(normalizedPrefix);
  };

  const deriveEffectiveTargetLineForStyle = (lines, sourceLine, element) => {
    let effective = sourceLine;
    const tagLower = String(element.tagName || '').toLowerCase();
    if (!Number.isFinite(effective) || effective < 5) {
      const stableAttrs = pickStableAttributes(element.attributes);
      if (tagLower && stableAttrs.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          if (!String(lines[i] || '').toLowerCase().includes(`<${tagLower}`)) continue;
          // Build a small opening-tag block (multi-line attrs)
          let tagText = lines[i] || '';
          for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
            if (/(\/?>)/.test(tagText)) break;
            tagText += '\n' + (lines[j] || '');
            if (/(\/?>)/.test(lines[j] || '')) break;
          }
          if (stableAttrs.every(a => matchesAttrInTagText(tagText, a.name, a.value))) {
            effective = i + 1;
            break;
          }
        }
      }
    }
    if (!Number.isFinite(effective) || effective < 1) return 1;
    if (effective > lines.length) return lines.length;
    return effective;
  };

  const tryFastPathCssChange = (originalContent, sourceLine, element, cssChanges) => {
    const escapeRegExp = (input) => String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = originalContent.split('\n');
    let targetLine = sourceLine;
    if (!Number.isFinite(targetLine) || targetLine < 1) targetLine = 1;
    if (targetLine > lines.length) targetLine = lines.length;

    const tagName = String(element.tagName || '').toLowerCase();
    if (!tagName) return null;

    const styleEntries = Object.entries(cssChanges)
      .map(([prop, val]) => `${prop}: '${val}'`)
      .join(', ');
    const styleObjStr = `{ ${styleEntries} }`;

    const searchRadius = 40;
    const startSearch = Math.max(0, targetLine - searchRadius - 1);
    const endSearch = Math.min(lines.length, targetLine + searchRadius);

    const stableAttrs = pickStableAttributes(element.attributes);
    if (stableAttrs.length === 0) return null;

    const candidates = [];
    for (let i = startSearch; i < endSearch; i++) {
      const line = lines[i] || '';
      if (!line.includes('<')) continue;
      const tagStartPattern = new RegExp(`<${escapeRegExp(tagName)}(?:\\s|>|\\/)`, 'i');
      if (!tagStartPattern.test(line)) continue;

      let j = i;
      let tagText = lines[j] || '';
      while (j + 1 < lines.length && j - i < 12) {
        if (/(\/?>)/.test(tagText)) break;
        j++;
        tagText += '\n' + (lines[j] || '');
        if (/(\/?>)/.test(lines[j] || '')) break;
      }

      const matched = stableAttrs.filter(a => matchesAttrInTagText(tagText, a.name, a.value));
      if (matched.length === 0) continue;
      const score = matched.reduce((sum, a) => sum + a.weight, 0);
      candidates.push({ i, j, tagText, score });
    }

    const MIN_SCORE = 50;
    const strong = candidates.filter(c => c.score >= MIN_SCORE);
    if (strong.length !== 1) return null;

    const chosen = strong[0];
    const insertMatch = chosen.tagText.match(new RegExp(`(<${tagName})([\\s>/])`, 'i'));
    if (!insertMatch) return null;
    const nextTagText = chosen.tagText.replace(insertMatch[0], `${insertMatch[1]} style={${styleObjStr}}${insertMatch[2]}`);
    const nextLines = nextTagText.split('\n');
    lines.splice(chosen.i, chosen.j - chosen.i + 1, ...nextLines);
    return lines.join('\n');
  };

  const lines = original.split('\n');
  const sourceLine = 0;
  const effectiveTargetLine = deriveEffectiveTargetLineForStyle(lines, sourceLine, element);
  assert.ok(effectiveTargetLine > 50, `expected derived target line to be later in file, got ${effectiveTargetLine}`);

  const patched = tryFastPathCssChange(original, effectiveTargetLine, element, cssChanges);
  assert.ok(patched, 'expected CSS fast-path to succeed for SVG path with stable d attribute');
  assert.ok(
    patched.includes(`<path style={{ fill: 'red' }} d="${d2}" />`) ||
      patched.includes(`<path style={{ fill: 'red' }} d="${d2}"/>`),
    'expected style prop to be inserted on the target <path>'
  );
  assert.ok(
    patched.includes(`<path d="${d1}" />`),
    'expected the other <path> to remain unchanged'
  );

  // Must parse as valid TSX.
  assert.doesNotThrow(() => {
    parse(patched, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  });
}

console.log('OK: line=0 + SVG <path d> → derived target line → CSS fast-path regression');
