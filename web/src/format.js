const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const brl = (n) => moeda.format(n ?? 0);

// "2026-09-16" -> Date local (evita o deslocamento de fuso de new Date('2026-09-16'))
const paraData = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};

export const dataBR = (iso) => (iso ? paraData(iso).toLocaleDateString('pt-BR') : '');

export const diaSemana = (iso) => {
  if (!iso) return '';
  const s = paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Aceita "100", "77,50", "77.5" e "1.234,50". Devolve NaN se não for número. */
export const lerValor = (txt) => {
  const s = String(txt ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return NaN;
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return Number(normal);
};

export const iniciais = (nome) =>
  (nome || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const semAcento = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
