import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const testDirectory = resolve(projectRoot, 'src/lib');
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => resolve(testDirectory, file));

if (testFiles.length === 0) {
  console.error('Nenhum teste frontend encontrado em src/lib.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
