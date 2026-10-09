import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../src/store.js';
import { createApp } from '../src/app.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const SENHA = 'senha-de-teste';

let server, base, dir;

async function req(metodo, rota, { token, corpo } = {}) {
  const r = await fetch(base + rota, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
}

async function subir(arquivo) {
  const store = new Store(arquivo).load();
  const app = createApp({ store, adminPassword: SENHA, secret: 'segredo-de-teste-123456' });
  server = http.createServer(app);
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}/api`;
  return store;
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saborr-'));
});
after(() => {
  server?.closeAllConnections?.(); server?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fluxo completo: atletas, jogo, divisão, pagamento, reabertura e permissões', async () => {
  await subir(path.join(dir, 'fluxo.json'));

  // login
  assert.equal((await req('POST', '/login/admin', { corpo: { senha: 'errada' } })).status, 401);
  const admin = (await req('POST', '/login/admin', { corpo: { senha: SENHA } })).corpo.token;

  // lista e detalhe de atletas são públicos (somente leitura)
  assert.equal((await req('GET', '/atletas')).status, 200);

  // cria 4 atletas
  const ids = [];
  for (const nome of ['Ana', 'Bia', 'Caio', 'Davi']) {
    const r = await req('POST', '/atletas', { token: admin, corpo: { nome } });
    assert.equal(r.status, 201);
    ids.push(r.corpo.atleta.id);
    assert.ok(!r.corpo.atleta.codigo, 'código não é exposto na API');
  }
  assert.equal((await req('POST', '/atletas', { token: admin, corpo: { nome: 'ana' } })).status, 409, 'nome duplicado');

  // jogo de R$ 100 com 3 presentes => 33,33 cada
  const ev1 = (await req('POST', '/eventos', { token: admin, corpo: { data: '2026-10-01', valorTotal: 100, participantes: ids.slice(0, 3) } })).corpo;
  assert.equal(ev1.valorPorPessoa, 33.33);
  // segundo jogo de R$ 80 com 4 presentes => 20 cada
  const ev2 = (await req('POST', '/eventos', { token: admin, corpo: { data: '2026-10-08', valorTotal: 80, participantes: ids } })).corpo;
  assert.equal(ev2.valorPorPessoa, 20);

  // saldo soma os jogos pendentes
  let ana = (await req('GET', `/atletas/${ids[0]}`, { token: admin })).corpo;
  assert.equal(ana.saldo, 53.33);
  assert.equal(ana.qtdPendentes, 2);
  let davi = (await req('GET', `/atletas/${ids[3]}`, { token: admin })).corpo;
  assert.equal(davi.saldo, 20);
  assert.equal(davi.jogos.find((j) => j.eventoId === ev1.id).jogou, false);

  // pagar um jogo e reabrir
  let r = await req('PUT', `/eventos/${ev1.id}/pagamentos/${ids[0]}`, { token: admin, corpo: { pago: true } });
  assert.equal(r.corpo.qtdPagos, 1);
  ana = (await req('GET', `/atletas/${ids[0]}`, { token: admin })).corpo;
  assert.equal(ana.saldo, 20);
  assert.equal(ana.totalPago, 33.33);
  await req('PUT', `/eventos/${ev1.id}/pagamentos/${ids[0]}`, { token: admin, corpo: { pago: false } });
  ana = (await req('GET', `/atletas/${ids[0]}`, { token: admin })).corpo;
  assert.equal(ana.saldo, 53.33);

  // quem não jogou não pode constar como pago
  assert.equal((await req('PUT', `/eventos/${ev1.id}/pagamentos/${ids[3]}`, { token: admin, corpo: { pago: true } })).status, 400);

  // sem login não altera nada
  assert.equal((await req('POST', '/atletas', { corpo: { nome: 'Espião' } })).status, 401);
  assert.equal((await req('PUT', `/eventos/${ev1.id}/pagamentos/${ids[0]}`, { corpo: { pago: true } })).status, 401);

  // editar jogo: tirar a Caio => recalcula e remove o pagamento dele
  await req('PUT', `/eventos/${ev1.id}/pagamentos/${ids[2]}`, { token: admin, corpo: { pago: true } });
  r = await req('PUT', `/eventos/${ev1.id}`, { token: admin, corpo: { data: '2026-10-01', valorTotal: 100, participantes: ids.slice(0, 2) } });
  assert.equal(r.corpo.valorPorPessoa, 50);
  assert.equal(r.corpo.qtdPagos, 0);

  // quitar tudo
  ana = (await req('POST', `/atletas/${ids[0]}/quitar-tudo`, { token: admin })).corpo;
  assert.equal(ana.saldo, 0);

  // excluir atleta com jogos exige confirmação; ao confirmar, o valor é redistribuído
  r = await req('DELETE', `/atletas/${ids[1]}`, { token: admin });
  assert.equal(r.status, 409);
  assert.equal(r.corpo.codigo, 'TEM_JOGOS');
  assert.equal((await req('DELETE', `/atletas/${ids[1]}?forcar=true`, { token: admin })).status, 204);
  const e1 = (await req('GET', `/eventos/${ev1.id}`, { token: admin })).corpo;
  assert.equal(e1.qtdParticipantes, 1);
  assert.equal(e1.valorPorPessoa, 100);

  // excluir jogo
  assert.equal((await req('DELETE', `/eventos/${ev2.id}`, { token: admin })).status, 204);
  assert.equal((await req('GET', `/eventos/${ev2.id}`, { token: admin })).status, 404);

  // validações
  assert.equal((await req('POST', '/eventos', { token: admin, corpo: { data: '2026-02-30', valorTotal: 10, participantes: [ids[0]] } })).status, 400);
  assert.equal((await req('POST', '/eventos', { token: admin, corpo: { data: '2026-10-01', valorTotal: 0, participantes: [ids[0]] } })).status, 400);
  assert.equal((await req('POST', '/eventos', { token: admin, corpo: { data: '2026-10-01', valorTotal: 10, participantes: [] } })).status, 400);
});

test('persistência: os dados sobrevivem a reiniciar o servidor', async () => {
  server.closeAllConnections?.(); server.close();
  const arquivo = path.join(dir, 'persist.json');
  await subir(arquivo);
  const admin = (await req('POST', '/login/admin', { corpo: { senha: SENHA } })).corpo.token;
  const a = (await req('POST', '/atletas', { token: admin, corpo: { nome: 'Eva' } })).corpo.atleta;
  server.closeAllConnections?.(); server.close();
  await subir(arquivo);
  const admin2 = (await req('POST', '/login/admin', { corpo: { senha: SENHA } })).corpo.token;
  const lista = (await req('GET', '/atletas', { token: admin2 })).corpo.atletas;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, a.id);
  assert.ok(fs.existsSync(path.join(dir, 'backups')), 'backup diário criado');
});

test('base importada da planilha: saldos conferem com o cálculo independente', async () => {
  server.closeAllConnections?.(); server.close();
  const origem = path.join(aqui, '..', 'data', 'db.json');
  if (!fs.existsSync(origem)) return;
  const copia = path.join(dir, 'real.json');
  fs.copyFileSync(origem, copia);
  await subir(copia);
  const admin = (await req('POST', '/login/admin', { corpo: { senha: SENHA } })).corpo.token;
  const { atletas, resumo } = (await req('GET', '/atletas', { token: admin })).corpo;
  assert.equal(atletas.length, 41);
  assert.equal(resumo.qtdJogos, 19);
  // soma dos 19 jogos = 1887,50 (a planilha original soma só 18: 1787,50)
  assert.equal(r2(resumo.totalRecebido + resumo.totalEmAberto), 1887.5);
  assert.equal(resumo.totalEmAberto, 225.72);
  const simon = atletas.find((a) => a.nome === 'Simon');
  assert.equal(simon.saldo, 16.67);
});

const r2 = (n) => Math.round(n * 100) / 100;
