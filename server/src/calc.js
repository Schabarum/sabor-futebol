// Regras de cálculo. Nada aqui é gravado no JSON: saldos e valores por pessoa
// são sempre derivados de "quem jogou" e "quem pagou" em cada jogo. Assim,
// editar ou excluir um jogo/atleta nunca deixa um saldo desatualizado.

export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Valor exato (sem arredondar) que cada participante deve no jogo. */
export function valorPorPessoa(evento) {
  return evento.valorTotal / evento.participantes.length;
}

/** Jogos ordenados do mais recente para o mais antigo (empate: o cadastrado por último primeiro). */
export function eventosRecentesPrimeiro(eventos) {
  return eventos
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.data.localeCompare(a.e.data) || b.i - a.i)
    .map((x) => x.e);
}

/**
 * Extrato de um atleta: todos os jogos (jogou ou não), o que ele deve em cada
 * um, o que já pagou e o saldo em aberto.
 */
export function extratoDoAtleta(db, atletaId) {
  let devido = 0;
  let pago = 0;

  const jogos = eventosRecentesPrimeiro(db.eventos).map((ev) => {
    const jogou = ev.participantes.includes(atletaId);
    const vpp = valorPorPessoa(ev);
    const pagou = jogou && ev.pagamentos.includes(atletaId);
    if (jogou) devido += vpp;
    if (pagou) pago += vpp;
    return {
      eventoId: ev.id,
      data: ev.data,
      jogou,
      pago: pagou,
      valor: jogou ? r2(vpp) : 0,
      totalParticipantes: ev.participantes.length,
      valorTotal: ev.valorTotal,
    };
  });

  const saldo = devido - pago;
  return {
    jogos,
    totalDevido: r2(devido),
    totalPago: r2(pago),
    saldo: saldo < 0.005 ? 0 : r2(saldo),
    qtdJogos: jogos.filter((j) => j.jogou).length,
    qtdPendentes: jogos.filter((j) => j.jogou && !j.pago).length,
  };
}

/** Resumo de um jogo: quantos pagaram, quanto falta receber. */
export function resumoDoEvento(ev) {
  const vpp = valorPorPessoa(ev);
  const qtd = ev.participantes.length;
  const qtdPagos = ev.pagamentos.length;
  const aberto = (qtd - qtdPagos) * vpp;
  return {
    id: ev.id,
    data: ev.data,
    valorTotal: ev.valorTotal,
    qtdParticipantes: qtd,
    valorPorPessoa: r2(vpp),
    qtdPagos,
    valorRecebido: r2(qtdPagos * vpp),
    valorEmAberto: aberto < 0.005 ? 0 : r2(aberto),
  };
}
