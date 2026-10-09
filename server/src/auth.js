import crypto from 'node:crypto';

const b64 = (buf) => Buffer.from(buf).toString('base64url');

const HORAS = 60 * 60 * 1000;
export const VALIDADE = { admin: 12 * HORAS, atleta: 30 * 24 * HORAS };

/** Compara dois textos em tempo constante. */
export function iguais(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Marca derivada do código do atleta: ao gerar um novo código, os acessos antigos deixam de valer. */
export const marcaDoCodigo = (codigo) => crypto.createHash('sha256').update(`marca:${codigo}`).digest('hex').slice(0, 12);

export function assinar(secret, payload, validadeMs) {
  const corpo = b64(JSON.stringify({ ...payload, exp: Date.now() + validadeMs }));
  const sig = b64(crypto.createHmac('sha256', secret).update(corpo).digest());
  return `${corpo}.${sig}`;
}

export function verificar(secret, token) {
  if (typeof token !== 'string') return null;
  const [corpo, sig] = token.split('.');
  if (!corpo || !sig) return null;
  const esperado = b64(crypto.createHmac('sha256', secret).update(corpo).digest());
  if (esperado.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Limita tentativas de login erradas por IP (em memória). */
export function criarLimitador({ max = 10, janelaMs = 15 * 60 * 1000 } = {}) {
  const mapa = new Map();
  return {
    bloqueado(ip) {
      const r = mapa.get(ip);
      if (!r) return false;
      if (r.ate < Date.now()) {
        mapa.delete(ip);
        return false;
      }
      return r.n >= max;
    },
    falhou(ip) {
      const r = mapa.get(ip);
      if (!r || r.ate < Date.now()) mapa.set(ip, { n: 1, ate: Date.now() + janelaMs });
      else r.n += 1;
    },
    ok(ip) {
      mapa.delete(ip);
    },
  };
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I

export function gerarCodigo(existentes = new Set()) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += ALFABETO[crypto.randomInt(ALFABETO.length)];
    if (!existentes.has(c)) return c;
  }
}
