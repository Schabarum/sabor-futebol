<script setup>
import { computed } from 'vue';
import { brl, dataBR, diaSemana } from '../format.js';

// jogo: { data, jogou, pago, valor, totalParticipantes }
const props = defineProps({ jogo: { type: Object, required: true } });

const estado = computed(() => {
  const j = props.jogo;
  if (!j.jogou) return { icone: 'remove_circle_outline', cor: 'grey-6', texto: 'Não jogou' };
  if (j.pago) return { icone: 'check_circle', cor: 'positive', texto: 'Pago' };
  return { icone: 'pending', cor: 'warning', texto: 'Em aberto' };
});
</script>

<template>
  <q-item :class="{ 'sem-jogou': !jogo.jogou }">
    <q-item-section avatar>
      <q-icon :name="estado.icone" :color="estado.cor" size="28px" />
    </q-item-section>

    <q-item-section>
      <q-item-label class="text-weight-medium">{{ dataBR(jogo.data) }}</q-item-label>
      <q-item-label caption>
        {{ diaSemana(jogo.data) }}
        <template v-if="jogo.jogou"> · {{ jogo.totalParticipantes }} atletas</template>
        <template v-else> · não participou</template>
      </q-item-label>
    </q-item-section>

    <q-item-section side top v-if="jogo.jogou">
      <div class="valor" :class="jogo.pago ? 'text-positive' : 'text-negative'">{{ brl(jogo.valor) }}</div>
      <div class="text-caption" :class="jogo.pago ? 'text-positive' : 'text-warning'">{{ estado.texto }}</div>
    </q-item-section>

    <q-item-section side v-if="$slots.acao">
      <slot name="acao" />
    </q-item-section>
  </q-item>
</template>
