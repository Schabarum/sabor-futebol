import crypto from 'node:crypto';
import { criarRouter } from './http.js';
import { assinar, verificar, iguais, criarLimitador, gerarCodigo, VALIDADE } from './auth.js';
import { extratoDoAtleta, resumoDoEvento, valorPorPessoa, eventosRecentesPrimeiro, r2 } from './calc.js';

class ErroHttp extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

const dataValida = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

function onError(err, req, res) {
  if (err instanceof ErroHttp) return res.status(err.status).json({ erro: err.message, ...err.extra });
  if (err.naoEncontrado) return res.status(404).json({ erro: 'Não encontrado.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
  console.error(err);
  if (!res.headersSent) res.status(500).json({ erro: 'Erro interno do servidor.' });
  else res.end();
}

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Monta o app (roteador próprio sobre node:http, ver http.js).
 * @param {{store: import('./store.js').Store, adminPassword: string, secret: string, webDir?: string, trustProxy?: boolean}} opts
 */
export function createApp({ store, adminPassword, secret, webDir, trustProxy = false }) {
  const app = criarRouter({ webDir, trustProxy, onError });
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    next();
  });

  const db = () => store.data;
  const limitador = criarLimitador();
  const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  // ---------- Autenticação ----------
  const exigir = (papel) => (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    const p = m && verificar(secret, m[1]);
    if (!p) return next(new ErroHttp(401, 'Sessão expirada. Entre novamente.'));
    if (p.papel !== papel) return next(new ErroHttp(403, 'Sem permissão para esta ação.'));
    next();
  };
  const soAdmin = exigir('admin');

  app.post('/api/login/admin', (req, res, next) => {
    if (limitador.bloqueado(req.ip)) return next(new ErroHttp(429, 'Muitas tentativas. Aguarde alguns minutos.'));
    if (!iguais(req.body?.senha ?? '', adminPassword)) {
      limitador.falhou(req.ip);
      return next(new ErroHttp(401, 'Senha incorreta.'));
    }
    limitador.ok(req.ip);
    const token = assinar(secret, { papel: 'admin' }, VALIDADE.admin);
    res.json({ token, papel: 'admin', nome: 'Administrador' });
  });

  // ---------- Grupo / ajustes (admin) ----------
  app.get('/api/grupo', soAdmin, (req, res) => res.json(db().grupo));

  app.put('/api/grupo', soAdmin, rota(async (req, res) => {
    const nome = texto(req.body?.nome, 80);
    if (!nome) throw new ErroHttp(400, 'Informe o nome do grupo.');
    db().grupo = { nome, chavePix: texto(req.body?.chavePix, 200) };
    await store.save();
    res.json(db().grupo);
  }));

  app.get('/api/backup', soAdmin, (req, res) => {
    res.set('Content-Disposition', `attachment; filename="saborr-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.type('application/json').send(JSON.stringify(db(), null, 2));
  });

  // ---------- Atletas (admin) ----------
  const nomeEmUso = (nome, ignorarId) =>
    db().atletas.some((a) => a.id !== ignorarId && a.nome.toLowerCase() === nome.toLowerCase());

  const resumoAtleta = (a) => {
    const e = extratoDoAtleta(db(), a.id);
    return {
      id: a.id,
      nome: a.nome,
      observacoes: a.observacoes || '',
      qtdJogos: e.qtdJogos,
      qtdPendentes: e.qtdPendentes,
      totalDevido: e.totalDevido,
      totalPago: e.totalPago,
      saldo: e.saldo,
    };
  };

  const detalheAtleta = (a) => ({
    atleta: { id: a.id, nome: a.nome, observacoes: a.observacoes || '' },
    ...extratoDoAtleta(db(), a.id),
  });

  const buscarAtleta = (id) => {
    const a = db().atletas.find((x) => x.id === id);
    if (!a) throw new ErroHttp(404, 'Atleta não encontrado.');
    return a;
  };

  app.get('/api/atletas', (req, res) => {
    const lista = db().atletas.map(resumoAtleta).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Totais calculados a partir dos jogos (valores exatos), e não somando saldos
    // já arredondados dos atletas, para não acumular diferenças de centavos.
    let recebido = 0;
    let emAberto = 0;
    for (const ev of db().eventos) {
      const vpp = valorPorPessoa(ev);
      recebido += ev.pagamentos.length * vpp;
      emAberto += (ev.participantes.length - ev.pagamentos.length) * vpp;
    }
    res.json({
      atletas: lista,
      resumo: {
        qtdAtletas: lista.length,
        qtdDevedores: lista.filter((a) => a.saldo > 0).length,
        totalEmAberto: emAberto < 0.005 ? 0 : r2(emAberto),
        totalRecebido: r2(recebido),
        qtdJogos: db().eventos.length,
      },
    });
  });

  app.post('/api/atletas', soAdmin, rota(async (req, res) => {
    const nome = texto(req.body?.nome, 80);
    if (!nome) throw new ErroHttp(400, 'Informe o nome do atleta.');
    if (nomeEmUso(nome)) throw new ErroHttp(409, 'Já existe um atleta com esse nome.');
    const a = {
      id: crypto.randomUUID(),
      nome,
      codigo: gerarCodigo(new Set(db().atletas.map((x) => x.codigo))),
      observacoes: texto(req.body?.observacoes, 500),
    };
    db().atletas.push(a);
    await store.save();
    res.status(201).json(detalheAtleta(a));
  }));

  app.get('/api/atletas/:id', (req, res) => res.json(detalheAtleta(buscarAtleta(req.params.id))));

  app.put('/api/atletas/:id', soAdmin, rota(async (req, res) => {
    const a = buscarAtleta(req.params.id);
    const nome = texto(req.body?.nome, 80);
    if (!nome) throw new ErroHttp(400, 'Informe o nome do atleta.');
    if (nomeEmUso(nome, a.id)) throw new ErroHttp(409, 'Já existe um atleta com esse nome.');
    a.nome = nome;
    a.observacoes = texto(req.body?.observacoes, 500);
    await store.save();
    res.json(detalheAtleta(a));
  }));

  // Marca como pago tudo o que o atleta ainda deve
  app.post('/api/atletas/:id/quitar-tudo', soAdmin, rota(async (req, res) => {
    const a = buscarAtleta(req.params.id);
    for (const ev of db().eventos) {
      if (ev.participantes.includes(a.id) && !ev.pagamentos.includes(a.id)) ev.pagamentos.push(a.id);
    }
    await store.save();
    res.json(detalheAtleta(a));
  }));

  app.delete('/api/atletas/:id', soAdmin, rota(async (req, res) => {
    const a = buscarAtleta(req.params.id);
    const jogos = db().eventos.filter((ev) => ev.participantes.includes(a.id));
    if (jogos.length && req.query.forcar !== 'true') {
      throw new ErroHttp(409, `${a.nome} participou de ${jogos.length} jogo(s).`, { codigo: 'TEM_JOGOS', qtdJogos: jogos.length });
    }
    const ficariaVazio = jogos.find((ev) => ev.participantes.length === 1);
    if (ficariaVazio) {
      throw new ErroHttp(409, 'Há um jogo em que esse atleta é o único participante. Exclua esse jogo antes.');
    }
    for (const ev of jogos) {
      ev.participantes = ev.participantes.filter((id) => id !== a.id);
      ev.pagamentos = ev.pagamentos.filter((id) => id !== a.id);
    }
    db().atletas = db().atletas.filter((x) => x.id !== a.id);
    await store.save();
    res.status(204).end();
  }));

  // ---------- Jogos / eventos (admin) ----------
  const buscarEvento = (id) => {
    const ev = db().eventos.find((x) => x.id === id);
    if (!ev) throw new ErroHttp(404, 'Jogo não encontrado.');
    return ev;
  };

  const detalheEvento = (ev) => {
    const vpp = valorPorPessoa(ev);
    const participantes = ev.participantes
      .map((id) => db().atletas.find((a) => a.id === id))
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((a) => ({ id: a.id, nome: a.nome, pago: ev.pagamentos.includes(a.id), valor: r2(vpp) }));
    return { ...resumoDoEvento(ev), participantes };
  };

  const lerEvento = (body) => {
    if (!dataValida(body?.data)) throw new ErroHttp(400, 'Informe uma data válida.');
    const valorTotal = Number(body?.valorTotal);
    if (!Number.isFinite(valorTotal) || valorTotal <= 0 || valorTotal > 100000) {
      throw new ErroHttp(400, 'Informe um valor maior que zero.');
    }
    const ids = Array.isArray(body?.participantes) ? [...new Set(body.participantes)] : [];
    if (!ids.length) throw new ErroHttp(400, 'Selecione ao menos um atleta.');
    const existentes = new Set(db().atletas.map((a) => a.id));
    if (ids.some((id) => !existentes.has(id))) throw new ErroHttp(400, 'Há atletas inválidos na lista.');
    return { data: body.data, valorTotal: r2(valorTotal), participantes: ids };
  };

  app.get('/api/eventos', soAdmin, (req, res) => {
    res.json({ eventos: eventosRecentesPrimeiro(db().eventos).map(resumoDoEvento) });
  });

  app.post('/api/eventos', soAdmin, rota(async (req, res) => {
    const dados = lerEvento(req.body);
    const ev = { id: crypto.randomUUID(), ...dados, pagamentos: [] };
    db().eventos.push(ev);
    await store.save();
    res.status(201).json(detalheEvento(ev));
  }));

  app.get('/api/eventos/:id', soAdmin, (req, res) => res.json(detalheEvento(buscarEvento(req.params.id))));

  app.put('/api/eventos/:id', soAdmin, rota(async (req, res) => {
    const ev = buscarEvento(req.params.id);
    const dados = lerEvento(req.body);
    ev.data = dados.data;
    ev.valorTotal = dados.valorTotal;
    ev.participantes = dados.participantes;
    // quem saiu da lista deixa de constar como pago
    ev.pagamentos = ev.pagamentos.filter((id) => ev.participantes.includes(id));
    await store.save();
    res.json(detalheEvento(ev));
  }));

  app.delete('/api/eventos/:id', soAdmin, rota(async (req, res) => {
    const ev = buscarEvento(req.params.id);
    db().eventos = db().eventos.filter((x) => x.id !== ev.id);
    await store.save();
    res.status(204).end();
  }));

  // Marcar / reabrir o pagamento de um atleta num jogo
  app.put('/api/eventos/:id/pagamentos/:atletaId', soAdmin, rota(async (req, res) => {
    const ev = buscarEvento(req.params.id);
    const atletaId = req.params.atletaId;
    if (!ev.participantes.includes(atletaId)) throw new ErroHttp(400, 'Esse atleta não participou do jogo.');
    if (typeof req.body?.pago !== 'boolean') throw new ErroHttp(400, 'Informe "pago": true ou false.');
    const jaPago = ev.pagamentos.includes(atletaId);
    if (req.body.pago && !jaPago) ev.pagamentos.push(atletaId);
    if (!req.body.pago && jaPago) ev.pagamentos = ev.pagamentos.filter((id) => id !== atletaId);
    await store.save();
    res.json(detalheEvento(ev));
  }));

  return app;
}
