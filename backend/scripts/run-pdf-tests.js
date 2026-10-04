const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const backendDir = resolve(__dirname, '..');
const configuredVenv =
  process.env.PDF_VENV_DIR || resolve(backendDir, 'pdf-venv');
const venvPython =
  process.platform === 'win32'
    ? join(configuredVenv, 'Scripts', 'python.exe')
    : join(configuredVenv, 'bin', 'python');

const candidates = [];
if (process.env.PYTHON_BIN) candidates.push([process.env.PYTHON_BIN, []]);
if (existsSync(venvPython)) candidates.push([venvPython, []]);
if (process.platform === 'win32') candidates.push(['py', ['-3']]);
candidates.push(['python3', []], ['python', []]);

let selected;
for (const candidate of candidates) {
  const [command, prefix] = candidate;
  const probe = spawnSync(command, [...prefix, '-c', 'import sys'], {
    stdio: 'ignore',
  });
  if (probe.status === 0) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  console.error(
    '[test:pdf] Python을 찾지 못했습니다. PYTHON_BIN 또는 PDF_VENV_DIR을 설정하십시오.',
  );
  process.exit(1);
}

const [command, prefix] = selected;
const testDir = resolve(backendDir, '..', 'tools', 'pdf-extract');
const result = spawnSync(
  command,
  [...prefix, '-m', 'unittest', 'discover', '-s', testDir, '-p', 'test_*.py'],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
