<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from '../../api.js';
import { brl } from '../../format.js';
import { avisoErro, avisoOk, confirmar } from '../../ui.js';
import JogoItem from '../../components/JogoItem.vue';
import AtletaFormDialog from '../../components/AtletaFormDialog.vue';

const props = defineProps({
  id: { type: String, required: true },
  somenteLeitura: { type: Boolean, default: false },
});

const baseAtletas = computed(() => (props.somenteLeitura ? '/atletas' : '/admin/atletas'));
const $q = useQuasar();
const router = useRouter();

const carregando = ref(true);
const dados = ref(null);
const dialogo = ref(false);
const ocupado = ref(false);

async function carregar() {
  try {
    dados.value = await api('GET', `/atletas/${props.id}`);
  } catch (e) {
    avisoErro($q, e);
    if (e.status === 404) router.replace(baseAtletas.value);
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);

const pendentes = computed(() => dados.value?.jogos.filter((j) => j.jogou && !j.pago) ?? []);
const historico = computed(() => dados.value?.jogos.filter((j) => !(j.jogou && !j.pago)) ?? []);

async function definirPago(jogo, pago) {
  ocupado.value = true;
  try {
    await api('PUT', `/eventos/${jogo.eventoId}/pagamentos/${props.id}`, { pago });
    await carregar();
  } catch (e) {
    avisoErro($q, e);
  } finally {
    ocupado.value = false;
  }
}

async function quitarTudo() {
  const ok = await confirmar($q, {
    titulo: 'Quitar tudo?',
    mensagem: `Marcar os ${pendentes.value.length} jogos em aberto de ${dados.value.atleta.nome} como pagos (${brl(dados.value.saldo)}). Você pode reabrir cada um depois.`,
    ok: 'Marcar como pago',
  });
  if (!ok) return;
  ocupado.value = true;
  try {
    dados.value = await api('POST', `/atletas/${props.id}/quitar-tudo`);
    avisoOk($q, 'Tudo quitado');
  } catch (e) {
    avisoErro($q, e);
  } finally {
    ocupado.value = false;
  }
}

async function excluir() {
  const nome = dados.value.atleta.nome;
  try {
    const ok = await confirmar($q, { titulo: 'Excluir atleta?', mensagem: `Excluir ${nome}?`, ok: 'Excluir', cor: 'negative' });
    if (!ok) return;
    await api('DELETE', `/atletas/${props.id}`);
  } catch (e) {
    if (e.status === 409 && e.dados?.codigo === 'TEM_JOGOS') {
      const ok = await confirmar($q, {
        titulo: `${nome} tem ${e.dados.qtdJogos} jogo(s) registrado(s)`,
        mensagem:
          'Excluir remove o atleta desses jogos e o valor de cada jogo será dividido de novo entre os atletas que ficarem. Os saldos de todos serão recalculados. Esta ação não pode ser desfeita.',
        ok: 'Excluir mesmo assim',
        cor: 'negative',
      });
      if (!ok) return;
      try {
        await api('DELETE', `/atletas/${props.id}?forcar=true`);
      } catch (e2) {
        return avisoErro($q, e2);
      }
    } else {
      return avisoErro($q, e);
    }
  }
  avisoOk($q, 'Atleta excluído');
  router.replace(baseAtletas.value);
}
</script>

<template>
  <q-page class="page q-pb-xl">
    <div v-if="carregando" class="flex flex-center q-pa-xl"><q-spinner-dots color="primary" size="40px" /></div>

    <template v-else-if="dados">
      <div class="row items-center q-mb-sm">
        <q-btn flat no-caps color="primary" icon="arrow_back" label="Atletas" :to="baseAtletas" />
        <q-space />
        <q-btn v-if="!somenteLeitura" flat round icon="more_vert" aria-label="Mais ações">
          <q-menu auto-close>
            <q-list style="min-width: 160px">
              <q-item clickable @click="dialogo = true">
                <q-item-section avatar><q-icon name="edit" /></q-item-section>
                <q-item-section>Editar</q-item-section>
              </q-item>
              <q-item clickable @click="excluir">
                <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
                <q-item-section class="text-negative">Excluir</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>

      <div class="cartao">
        <div class="q-pa-md">
          <div class="text-h5 text-weight-bold">{{ dados.atleta.nome }}</div>
          <div class="text-caption text-grey-7 q-mt-md">Saldo a pagar</div>
          <div class="saldo-grande" :class="dados.saldo > 0 ? 'text-negative' : 'text-positive'">{{ brl(dados.saldo) }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ dados.qtdJogos }} jogos · devido {{ brl(dados.totalDevido) }} · pago {{ brl(dados.totalPago) }}
          </div>
          <div v-if="dados.atleta.observacoes" class="q-mt-md text-body2 text-grey-8">
            <q-icon name="sticky_note_2" class="q-mr-xs" />{{ dados.atleta.observacoes }}
          </div>
        </div>
      </div>

      <div class="row items-end q-mt-sm">
        <div class="secao-titulo col" style="margin-bottom: 4px">Em aberto · composição do saldo</div>
        <q-btn
          v-if="!somenteLeitura && pendentes.length > 1"
          flat
          dense
          no-caps
          color="positive"
          icon="done_all"
          label="Quitar tudo"
          :disable="ocupado"
          @click="quitarTudo"
        />
      </div>
      <q-list v-if="pendentes.length" class="cartao" separator>
        <jogo-item v-for="j in pendentes" :key="j.eventoId" :jogo="j">
          <template v-if="!somenteLeitura" #acao>
            <q-btn unelevated dense no-caps color="positive" icon="check" label="Pagou" :disable="ocupado" @click="definirPago(j, true)" />
          </template>
        </jogo-item>
      </q-list>
      <div v-else class="cartao q-pa-md text-positive"><q-icon name="check_circle" class="q-mr-xs" />Nenhum jogo em aberto.</div>

      <div class="secao-titulo">Histórico</div>
      <q-list v-if="historico.length" class="cartao" separator>
        <jogo-item v-for="j in historico" :key="j.eventoId" :jogo="j">
          <template v-if="!somenteLeitura && j.jogou" #acao>
            <q-btn flat dense no-caps color="grey-8" icon="undo" label="Reabrir" :disable="ocupado" @click="definirPago(j, false)" />
          </template>
        </jogo-item>
      </q-list>
      <div v-else class="text-grey-7 q-pa-md">Nenhum outro jogo registrado.</div>

      <atleta-form-dialog v-if="!somenteLeitura" v-model="dialogo" :atleta="dados.atleta" @salvo="carregar" />
    </template>
  </q-page>
</template>
