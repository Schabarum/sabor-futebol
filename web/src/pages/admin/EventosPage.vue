<script setup>
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../../api.js';
import { brl, dataBR, diaSemana } from '../../format.js';
import { avisoErro } from '../../ui.js';

const $q = useQuasar();
const carregando = ref(true);
const eventos = ref([]);

onMounted(async () => {
  try {
    eventos.value = (await api('GET', '/eventos')).eventos;
  } catch (e) {
    avisoErro($q, e);
  } finally {
    carregando.value = false;
  }
});
</script>

<template>
  <q-page class="page q-pb-xl">
    <div v-if="carregando" class="flex flex-center q-pa-xl"><q-spinner-dots color="primary" size="40px" /></div>

    <template v-else>
      <q-list v-if="eventos.length" class="cartao" separator>
        <q-item v-for="e in eventos" :key="e.id" clickable v-ripple :to="`/admin/eventos/${e.id}`" class="q-py-md">
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ dataBR(e.data) }}
              <span class="text-grey-7 text-weight-regular"> · {{ diaSemana(e.data) }}</span>
            </q-item-label>
            <q-item-label caption>
              {{ brl(e.valorTotal) }} · {{ e.qtdParticipantes }} atletas · {{ brl(e.valorPorPessoa) }} cada
            </q-item-label>
            <q-linear-progress
              :value="e.qtdParticipantes ? e.qtdPagos / e.qtdParticipantes : 0"
              color="positive"
              track-color="grey-3"
              rounded
              size="6px"
              class="q-mt-sm"
            />
          </q-item-section>
          <q-item-section side>
            <q-chip v-if="e.valorEmAberto === 0" dense square color="green-1" text-color="positive" label="Quitado" />
            <template v-else>
              <div class="valor text-negative">{{ brl(e.valorEmAberto) }}</div>
              <div class="text-caption text-grey-7">{{ e.qtdPagos }}/{{ e.qtdParticipantes }} pagos</div>
            </template>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-grey-7 text-center q-pa-lg">Nenhum jogo registrado. Toque no + para incluir o primeiro.</div>
    </template>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="add" color="accent" text-color="secondary" aria-label="Novo jogo" to="/admin/eventos/novo" />
    </q-page-sticky>
  </q-page>
</template>
