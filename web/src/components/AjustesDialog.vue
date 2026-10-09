<script setup>
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api, baixarBackup } from '../api.js';
import { avisoErro, avisoOk } from '../ui.js';

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue']);
const $q = useQuasar();

const nome = ref('');
const chavePix = ref('');
const salvando = ref(false);

watch(
  () => props.modelValue,
  async (aberto) => {
    if (!aberto) return;
    try {
      const g = await api('GET', '/grupo');
      nome.value = g.nome;
      chavePix.value = g.chavePix;
    } catch (e) {
      avisoErro($q, e);
    }
  },
);

async function salvar() {
  salvando.value = true;
  try {
    await api('PUT', '/grupo', { nome: nome.value, chavePix: chavePix.value });
    avisoOk($q, 'Ajustes salvos');
    emit('update:modelValue', false);
  } catch (e) {
    avisoErro($q, e);
  } finally {
    salvando.value = false;
  }
}

async function backup() {
  try {
    await baixarBackup();
  } catch (e) {
    avisoErro($q, e);
  }
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 420px; max-width: 94vw">
      <q-form @submit.prevent="salvar">
        <q-card-section>
          <div class="text-h6">Ajustes</div>
        </q-card-section>
        <q-card-section class="q-gutter-md q-pt-none">
          <q-input v-model="nome" outlined label="Nome do grupo" :rules="[(v) => !!v || 'Obrigatório']" />
          <q-input v-model="chavePix" outlined label="Chave Pix" hint="Aparece para os atletas na hora de pagar" />
          <div>
            <q-btn flat no-caps color="primary" icon="download" label="Baixar backup (JSON)" @click="backup" />
            <div class="text-caption text-grey-7">Cópia completa dos atletas, jogos e pagamentos.</div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancelar" color="grey-8" v-close-popup />
          <q-btn type="submit" unelevated no-caps label="Salvar" color="primary" :loading="salvando" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
