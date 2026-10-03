import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoots = ['src', 'api/src'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html']);
const mojibakePattern = new RegExp(
  `${String.fromCodePoint(0x00c3)}[\\u00a0-\\u00bf]|${String.fromCodePoint(0x00c2)}[\\u0080-\\u00bf]|${String.fromCodePoint(0x00e2)}${String.fromCodePoint(0x20ac)}`,
  'u',
);

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filename);
    return sourceExtensions.has(path.extname(filename)) ? [filename] : [];
  }));
  return files.flat();
}

test('application source contains no common UTF-8 mojibake sequences', async () => {
  const files = (await Promise.all(sourceRoots.map((root) => collectSourceFiles(path.join(projectRoot, root))))).flat();
  const findings = [];
  for (const filename of files) {
    const lines = (await readFile(filename, 'utf8')).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (mojibakePattern.test(line)) findings.push(`${path.relative(projectRoot, filename)}:${index + 1}`);
    });
  }
  assert.deepEqual(findings, [], `Broken text encoding found at ${findings.join(', ')}`);
});
