// Mini-roteador sobre node:http (sem dependências externas).
// Oferece só o que a aplicação usa: rotas com :parametros, JSON no corpo,
// middlewares globais, arquivos estáticos com fallback para o index.html (SPA)
// e tratamento central de erros.
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const LIMITE_CORPO = 100 * 1024;

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > LIMITE_CORPO) {
        reject(Object.assign(new Error('Corpo grande demais.'), { type: 'entity.too.large' }));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

function compilar(padrao) {
  const nomes = [];
  const re = padrao.replace(/:([a-zA-Z]+)/g, (_, n) => {
    nomes.push(n);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${re}$`), nomes };
}

function enriquecerResposta(res) {
  res.status = (n) => {
    res.statusCode = n;
    return res;
  };
  res.set = (k, v) => {
    res.setHeader(k, v);
    return res;
  };
  res.type = (t) => {
    res.setHeader('Content-Type', t === 'application/json' ? 'application/json; charset=utf-8' : t);
    return res;
  };
  res.send = (corpo) => {
    res.end(corpo);
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
}

/**
 * @param {{webDir?: string, trustProxy?: boolean, onError: (err: Error, req: any, res: any) => void}} opts
 */
export function criarRouter({ webDir, trustProxy = false, onError }) {
  const rotas = [];
  const globais = [];

  const executar = (handlers, req, res, final) => {
    let i = 0;
    const next = (err) => {
      if (err) return onError(err, req, res);
      const h = handlers[i++];
      if (!h) return final();
      try {
        const r = h(req, res, next);
        if (r && typeof r.catch === 'function') r.catch((e) => onError(e, req, res));
      } catch (e) {
        onError(e, req, res);
      }
    };
    next();
  };

  const servirArquivo = (req, res, arquivo, cache) => {
    res.setHeader('Content-Type', MIME[path.extname(arquivo).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', cache);
    fs.createReadStream(arquivo)
      .on('error', () => onError(new Error('Falha ao ler arquivo.'), req, res))
      .pipe(res);
  };

  const estatico = (req, res) => {
    if (!webDir || !['GET', 'HEAD'].includes(req.method)) return false;
    const base = path.resolve(webDir);
    if (!fs.existsSync(path.join(base, 'index.html'))) return false;
    const pedido = decodeURIComponent(req.path);
    const alvo = path.resolve(base, '.' + path.normalize('/' + pedido));
    if (alvo.startsWith(base + path.sep) && fs.existsSync(alvo) && fs.statSync(alvo).isFile()) {
      const imutavel = /\/assets\/.+-[\w-]{6,}\./.test(pedido);
      servirArquivo(req, res, alvo, imutavel ? 'public, max-age=31536000, immutable' : 'no-cache');
      return true;
    }
    if (path.extname(pedido)) return false; // arquivo inexistente: 404
    servirArquivo(req, res, path.join(base, 'index.html'), 'no-cache');
    return true;
  };

  const listener = async (req, res) => {
    enriquecerResposta(res);
    const url = new URL(req.url, 'http://local');
    req.path = url.pathname;
    req.query = Object.fromEntries(url.searchParams);
    req.get = (n) => req.headers[n.toLowerCase()];
    req.ip =
      (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'desconhecido';
    req.body = {};
    req.params = {};

    try {
      const cru = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await lerCorpo(req) : '';
      if (cru.trim()) {
        try {
          req.body = JSON.parse(cru);
        } catch {
          throw Object.assign(new Error('JSON inválido.'), { type: 'entity.parse.failed' });
        }
      }
    } catch (e) {
      return onError(e, req, res);
    }

    executar(globais, req, res, () => {
      for (const r of rotas) {
        if (r.metodo !== req.method) continue;
        const m = r.regex.exec(req.path);
        if (!m) continue;
        req.params = Object.fromEntries(r.nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
        return executar(r.handlers, req, res, () => {});
      }
      if (!req.path.startsWith('/api') && estatico(req, res)) return;
      const erro = Object.assign(new Error('Rota não encontrada.'), { naoEncontrado: true });
      onError(erro, req, res);
    });
  };

  listener.use = (fn) => globais.push(fn);
  for (const metodo of ['GET', 'POST', 'PUT', 'DELETE']) {
    listener[metodo.toLowerCase()] = (padrao, ...handlers) => rotas.push({ metodo, ...compilar(padrao), handlers });
  }
  return listener;
}
