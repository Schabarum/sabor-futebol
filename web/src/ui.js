/** Diálogo de confirmação baseado em promessa: `if (await confirmar($q, {...})) ...` */
export function confirmar($q, { titulo, mensagem, ok = 'Confirmar', cor = 'primary' }) {
  return new Promise((resolve) => {
    $q.dialog({
      title: titulo,
      message: mensagem,
      persistent: true,
      cancel: { label: 'Cancelar', flat: true, noCaps: true, color: 'grey-8' },
      ok: { label: ok, color: cor, unelevated: true, noCaps: true },
    })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
      .onDismiss(() => resolve(false));
  });
}

export const avisoErro = ($q, e) => $q.notify({ type: 'negative', message: e?.message || 'Algo deu errado.' });
export const avisoOk = ($q, message) => $q.notify({ type: 'positive', message });
