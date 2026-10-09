import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { createApp } from './app.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Carrega variáveis do arquivo .env (se existir), sem sobrescrever as do ambiente.
function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linha);
    if (!m || linha.trim().startsWith('#')) continue;
    process.env[m[1]] ??= m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
carregarEnv(path.join(raiz, '.env'));

const { ADMIN_PASSWORD, JWT_SECRET } = process.env;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 6 || !JWT_SECRET || JWT_SECRET.length < 16) {
  console.error(
    [
      'Configuração incompleta.',
      'Copie .env.example para .env e defina:',
      '  ADMIN_PASSWORD  (sua senha de administrador, mínimo 6 caracteres)',
      '  JWT_SECRET      (texto aleatório longo, mínimo 16 caracteres)',
    ].join('\n'),
  );
  process.exit(1);
}

const arquivoDados = path.resolve(raiz, process.env.DATA_FILE || 'server/data/db.json');
const store = new Store(arquivoDados).load();
const app = createApp({
  store,
  adminPassword: ADMIN_PASSWORD,
  secret: JWT_SECRET,
  webDir: path.join(raiz, 'web', 'dist'),
  trustProxy: process.env.TRUST_PROXY === 'true',
});

const porta = Number(process.env.PORT) || 3000;
http.createServer(app).listen(porta, () => {
  console.log(`saBORR futebol rodando em http://localhost:${porta}`);
  console.log(`Dados: ${arquivoDados} (${store.data.atletas.length} atletas, ${store.data.eventos.length} jogos)`);
});
