import { reactive } from 'vue';

const CHAVE = 'saborr_sessao';

function lerSessao() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch {
    return {};
  }
}

// papel: 'admin'. A autorização de verdade é sempre feita no servidor;
// isto só decide qual tela mostrar.
export const sessao = reactive({ token: null, papel: null, nome: null, ...lerSessao() });

export function entrar({ token, papel, nome }) {
  Object.assign(sessao, { token, papel, nome });
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ token, papel, nome }));
  } catch {
    /* armazenamento indisponível: a sessão vale só até recarregar */
  }
}

export function sair() {
  Object.assign(sessao, { token: null, papel: null, nome: null });
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}

let expirou = () => {};
export const aoSessaoExpirar = (fn) => {
  expirou = fn;
};

export async function api(metodo, rota, corpo) {
  let resp;
  try {
    resp = await fetch(`/api${rota}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(sessao.token ? { Authorization: `Bearer ${sessao.token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  if (resp.status === 204) return null;
  let dados = null;
  try {
    dados = await resp.json();
  } catch {
    /* resposta sem corpo JSON */
  }
  if (!resp.ok) {
    if (resp.status === 401 && sessao.token && !rota.startsWith('/login')) expirou();
    throw Object.assign(new Error(dados?.erro || 'Algo deu errado.'), { status: resp.status, dados });
  }
  return dados;
}

/** Baixa o JSON completo (backup) usando o token da sessão. */
export async function baixarBackup() {
  const resp = await fetch('/api/backup', { headers: { Authorization: `Bearer ${sessao.token}` } });
  if (!resp.ok) throw new Error('Não foi possível gerar o backup.');
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saborr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
