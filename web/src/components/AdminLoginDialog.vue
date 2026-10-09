<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api, entrar } from '../api.js';
import { avisoErro } from '../ui.js';

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue']);

const $q = useQuasar();
const router = useRouter();

const senha = ref('');
const verSenha = ref(false);
const enviando = ref(false);

watch(
  () => props.modelValue,
  (aberto) => {
    if (aberto) senha.value = '';
  },
);

function fechar() {
  emit('update:modelValue', false);
}

async function entrarAdmin() {
  enviando.value = true;
  try {
    const dados = await api('POST', '/login/admin', { senha: senha.value });
    entrar(dados);
    fechar();
    router.push('/admin');
  } catch (e) {
    avisoErro($q, e);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 100%; max-width: 360px">
      <q-card-section>
        <div class="text-h6">Área administrativa</div>
        <div class="text-body2 text-grey-7">Senha de quem gerencia o racha</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-form @submit.prevent="entrarAdmin" class="q-gutter-md">
          <q-input
            v-model="senha"
            outlined
            label="Senha"
            :type="verSenha ? 'text' : 'password'"
            autocomplete="current-password"
            autofocus
            :rules="[(v) => !!v || 'Informe a senha']"
            lazy-rules
          >
            <template #append>
              <q-icon :name="verSenha ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="verSenha = !verSenha" />
            </template>
          </q-input>
          <div class="row q-gutter-sm">
            <q-btn flat no-caps label="Cancelar" color="grey-8" class="col" @click="fechar" />
            <q-btn type="submit" label="Entrar" color="primary" unelevated no-caps class="col" :loading="enviando" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
