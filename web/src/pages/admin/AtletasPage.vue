<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from '../../api.js';
import { brl, iniciais, semAcento } from '../../format.js';
import { avisoErro } from '../../ui.js';
import AtletaFormDialog from '../../components/AtletaFormDialog.vue';

const props = defineProps({ somenteLeitura: { type: Boolean, default: false } });

const $q = useQuasar();
const router = useRouter();

const baseAtletas = computed(() => (props.somenteLeitura ? '/atletas' : '/admin/atletas'));

const carregando = ref(true);
const atletas = ref([]);
const resumo = ref(null);
const busca = ref('');
const soDevedores = ref(false);
const dialogo = ref(false);

async function carregar() {
  try {
    const d = await api('GET', '/atletas');
    atletas.value = d.atletas;
    resumo.value = d.resumo;
  } catch (e) {
    avisoErro($q, e);
  } finally {
    carregando.value = false;
  }
}
onMounted(carregar);

const filtrados = computed(() => {
  const termo = semAcento(busca.value);
  const lista = atletas.value.filter(
    (a) => (!soDevedores.value || a.saldo > 0) && semAcento(a.nome).includes(termo),
  );
  return soDevedores.value ? [...lista].sort((a, b) => b.saldo - a.saldo) : lista;
});

function aoSalvar(detalhe) {
  router.push(`${baseAtletas.value}/${detalhe.atleta.id}`);
}
</script>

<template>
  <q-page class="page q-pb-xl">
    <div v-if="carregando" class="flex flex-center q-pa-xl"><q-spinner-dots color="primary" size="40px" /></div>

    <template v-else>
      <div v-if="resumo" class="row q-col-gutter-sm q-mb-md">
        <div class="col-12 col-sm-4">
          <div class="cartao q-pa-md">
            <div class="text-caption text-grey-7">Em aberto</div>
            <div class="text-h5 valor" :class="resumo.totalEmAberto > 0 ? 'text-negative' : 'text-positive'">
              {{ brl(resumo.totalEmAberto) }}
            </div>
          </div>
        </div>
        <div class="col-6 col-sm-4">
          <div class="cartao q-pa-md">
            <div class="text-caption text-grey-7">Devedores</div>
            <div class="text-h5 valor">
              {{ resumo.qtdDevedores }}<span class="text-body2 text-grey-7"> de {{ resumo.qtdAtletas }}</span>
            </div>
          </div>
        </div>
        <div class="col-6 col-sm-4">
          <div class="cartao q-pa-md">
            <div class="text-caption text-grey-7">Já recebido</div>
            <div class="text-h5 valor text-positive">{{ brl(resumo.totalRecebido) }}</div>
          </div>
        </div>
      </div>

      <div class="row items-center q-col-gutter-sm q-mb-sm">
        <div class="col">
          <q-input v-model="busca" outlined dense bg-color="white" placeholder="Buscar atleta" clearable>
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </div>
        <div class="col-auto">
          <q-toggle v-model="soDevedores" label="Só devedores" />
        </div>
      </div>

      <q-list v-if="filtrados.length" class="cartao" separator>
        <q-item v-for="a in filtrados" :key="a.id" clickable v-ripple :to="`${baseAtletas}/${a.id}`">
          <q-item-section avatar>
            <q-avatar size="40px" :color="a.saldo > 0 ? 'red-1' : 'green-1'" :text-color="a.saldo > 0 ? 'negative' : 'positive'">
              {{ iniciais(a.nome) }}
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ a.nome }}</q-item-label>
            <q-item-label caption>
              {{ a.qtdJogos }} {{ a.qtdJogos === 1 ? 'jogo' : 'jogos' }}
              <template v-if="a.qtdPendentes"> · {{ a.qtdPendentes }} em aberto</template>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <span v-if="a.saldo > 0" class="valor text-negative">{{ brl(a.saldo) }}</span>
            <q-chip v-else dense square color="green-1" text-color="positive" label="Em dia" />
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-grey-7 text-center q-pa-lg">
        {{
          atletas.length
            ? 'Nenhum atleta encontrado.'
            : somenteLeitura
              ? 'Nenhum atleta cadastrado ainda.'
              : 'Nenhum atleta cadastrado ainda. Toque no + para começar.'
        }}
      </div>
    </template>

    <template v-if="!somenteLeitura">
      <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-btn fab icon="person_add" color="accent" text-color="secondary" aria-label="Novo atleta" @click="dialogo = true" />
      </q-page-sticky>
      <atleta-form-dialog v-model="dialogo" @salvo="aoSalvar" />
    </template>
  </q-page>
</template>
