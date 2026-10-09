<script setup>
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../api.js';
import { avisoErro } from '../ui.js';

// atleta: objeto { id, nome, observacoes } para editar, ou null para criar
const props = defineProps({ modelValue: Boolean, atleta: { type: Object, default: null } });
const emit = defineEmits(['update:modelValue', 'salvo']);
const $q = useQuasar();

const nome = ref('');
const observacoes = ref('');
const salvando = ref(false);

watch(
  () => props.modelValue,
  (aberto) => {
    if (!aberto) return;
    nome.value = props.atleta?.nome ?? '';
    observacoes.value = props.atleta?.observacoes ?? '';
  },
);

async function salvar() {
  salvando.value = true;
  try {
    const corpo = { nome: nome.value, observacoes: observacoes.value };
    const resp = props.atleta
      ? await api('PUT', `/atletas/${props.atleta.id}`, corpo)
      : await api('POST', '/atletas', corpo);
    emit('salvo', resp, !props.atleta);
    emit('update:modelValue', false);
  } catch (e) {
    avisoErro($q, e);
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 420px; max-width: 94vw">
      <q-form @submit.prevent="salvar">
        <q-card-section>
          <div class="text-h6">{{ atleta ? 'Editar atleta' : 'Novo atleta' }}</div>
        </q-card-section>
        <q-card-section class="q-gutter-md q-pt-none">
          <q-input v-model="nome" outlined autofocus label="Nome" maxlength="80" :rules="[(v) => !!v?.trim() || 'Informe o nome']" />
          <q-input
            v-model="observacoes"
            outlined
            type="textarea"
            autogrow
            label="Observações (só você vê)"
            maxlength="500"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" color="grey-8" v-close-popup />
          <q-btn type="submit" unelevated no-caps label="Salvar" color="primary" :loading="salvando" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
