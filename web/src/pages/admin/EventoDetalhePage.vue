<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from '../../api.js';
import { brl, dataBR, diaSemana, iniciais } from '../../format.js';
import { avisoErro, avisoOk, confirmar } from '../../ui.js';

const props = defineProps({ id: { type: String, required: true } });
const $q = useQuasar();
const router = useRouter();

const carregando = ref(true);
const evento = ref(null);
const ocupado = ref(false);

async function carregar() {
  try {
    evento.value = await api('GET', `/eventos/${props.id}`);
  } catch (e) {
    avisoErro($q, e);
    if (e.status === 404) router.replace('/admin/eventos');
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);

async function definirPago(atleta, pago) {
  ocupado.value = true;
  try {
    evento.value = await api('PUT', `/eventos/${props.id}/pagamentos/${atleta.id}`, { pago });
  } catch (e) {
    avisoErro($q, e);
  } finally {
    ocupado.value = false;
  }
}

async function excluir() {
  const ok = await confirmar($q, {
    titulo: 'Excluir jogo?',
    mensagem: `O jogo de ${dataBR(evento.value.data)} (${brl(evento.value.valorTotal)}) será removido e os saldos dos ${evento.value.qtdParticipantes} participantes serão recalculados. Esta ação não pode ser desfeita.`,
    ok: 'Excluir',
    cor: 'negative',
  });
  if (!ok) return;
  try {
    await api('DELETE', `/eventos/${props.id}`);
    avisoOk($q, 'Jogo excluído');
    router.replace('/admin/eventos');
  } catch (e) {
    avisoErro($q, e);
  }
}
</script>

<template>
  <q-page class="page q-pb-xl">
    <div v-if="carregando" class="flex flex-center q-pa-xl"><q-spinner-dots color="primary" size="40px" /></div>

    <template v-else-if="evento">
      <div class="row items-center q-mb-sm">
        <q-btn flat no-caps color="primary" icon="arrow_back" label="Jogos" to="/admin/eventos" />
        <q-space />
        <q-btn flat round icon="more_vert" aria-label="Mais ações">
          <q-menu auto-close>
            <q-list style="min-width: 160px">
              <q-item clickable :to="`/admin/eventos/${id}/editar`">
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

      <div class="cartao q-pa-md">
        <div class="text-h5 text-weight-bold">{{ dataBR(evento.data) }}</div>
        <div class="text-grey-7">{{ diaSemana(evento.data) }}</div>
        <div class="row q-mt-md text-center">
          <div class="col">
            <div class="text-caption text-grey-7">Valor do jogo</div>
            <div class="valor">{{ brl(evento.valorTotal) }}</div>
          </div>
          <div class="col">
            <div class="text-caption text-grey-7">{{ evento.qtdParticipantes }} atletas</div>
            <div class="valor">{{ brl(evento.valorPorPessoa) }} cada</div>
          </div>
          <div class="col">
            <div class="text-caption text-grey-7">Em aberto</div>
            <div class="valor" :class="evento.valorEmAberto > 0 ? 'text-negative' : 'text-positive'">{{ brl(evento.valorEmAberto) }}</div>
          </div>
        </div>
        <q-linear-progress
          :value="evento.qtdPagos / evento.qtdParticipantes"
          color="positive"
          track-color="grey-3"
          rounded
          size="8px"
          class="q-mt-md"
        />
        <div class="text-caption text-grey-7 q-mt-xs">{{ evento.qtdPagos }} de {{ evento.qtdParticipantes }} já pagaram</div>
      </div>

      <div class="secao-titulo">Participantes</div>
      <q-list class="cartao" separator>
        <q-item v-for="p in evento.participantes" :key="p.id">
          <q-item-section avatar>
            <q-avatar size="36px" :color="p.pago ? 'green-1' : 'orange-1'" :text-color="p.pago ? 'positive' : 'warning'">
              {{ iniciais(p.nome) }}
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              <router-link :to="`/admin/atletas/${p.id}`" class="text-black" style="text-decoration: none">{{ p.nome }}</router-link>
            </q-item-label>
            <q-item-label caption :class="p.pago ? 'text-positive' : 'text-warning'">
              {{ p.pago ? 'Pago' : 'Em aberto' }} · {{ brl(p.valor) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn v-if="!p.pago" unelevated dense no-caps color="positive" icon="check" label="Pagou" :disable="ocupado" @click="definirPago(p, true)" />
            <q-btn v-else flat dense no-caps color="grey-8" icon="undo" label="Reabrir" :disable="ocupado" @click="definirPago(p, false)" />
          </q-item-section>
        </q-item>
      </q-list>
    </template>
  </q-page>
</template>
