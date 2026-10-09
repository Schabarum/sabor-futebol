// Sobe a API (porta 3000) e o front com hot reload (porta 5173) ao mesmo tempo.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const filhos = [
  ['api', 'server'],
  ['web', 'web'],
].map(([nome, workspace]) => {
  const p = spawn(npm, ['run', 'dev', '-w', workspace], { stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (code) => {
    console.log(`[${nome}] encerrado (${code})`);
    encerrar(code ?? 0);
  });
  return p;
});

function encerrar(code) {
  for (const p of filhos) if (!p.killed) p.kill();
  process.exit(code);
}
process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));
