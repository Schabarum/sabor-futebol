<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from '../../api.js';
import { brl, dataBR, hojeISO, lerValor, semAcento } from '../../format.js';
import { avisoErro, avisoOk } from '../../ui.js';

// Sem `id` = novo jogo; com `id` = edição.
const props = defineProps({ id: { type: String, default: null } });
const $q = useQuasar();
const router = useRouter();

const carregando = ref(true);
const salvando = ref(false);
const atletas = ref([]);
const data = ref(hojeISO());
const valorTexto = ref('100');
const selecionados = ref([]);
const busca = ref('');
const ultimo = ref(null); // participantes do jogo mais recente (atalho "repetir")

onMounted(async () => {
  try {
    atletas.value = (await api('GET', '/atletas')).atletas;
    if (props.id) {
      const ev = await api('GET', `/eventos/${props.id}`);
      data.value = ev.data;
      valorTexto.value = String(ev.valorTotal).replace('.', ',');
      selecionados.value = ev.participantes.map((p) => p.id);
    } else {
      const lista = (await api('GET', '/eventos')).eventos;
      if (lista.length) {
        const ev = await api('GET', `/eventos/${lista[0].id}`);
        ultimo.value = { data: ev.data, ids: ev.participantes.map((p) => p.id) };
      }
    }
  } catch (e) {
    avisoErro($q, e);
    router.replace('/admin/eventos');
  } finally {
    carregando.value = false;
  }
});

const valor = computed(() => lerValor(valorTexto.value));
const valorOk = computed(() => Number.isFinite(valor.value) && valor.value > 0);
const porPessoa = computed(() => (valorOk.value && selecionados.value.length ? valor.value / selecionados.value.length : null));
const podeSalvar = computed(() => !!data.value && valorOk.value && selecionados.value.length > 0);

const visiveis = computed(() => {
  const t = semAcento(busca.value);
  return atletas.value.filter((a) => semAcento(a.nome).includes(t));
});

const marcarTodos = () => {
  selecionados.value = atletas.value.map((a) => a.id);
};
const limpar = () => {
  selecionados.value = [];
};
const repetirUltimo = () => {
  const existentes = new Set(atletas.value.map((a) => a.id));
  selecionados.value = ultimo.value.ids.filter((i) => existentes.has(i));
};

async function salvar() {
  if (!podeSalvar.value) return;
  salvando.value = true;
  try {
    const corpo = { data: data.value, valorTotal: valor.value, participantes: selecionados.value };
    const ev = props.id ? await api('PUT', `/eventos/${props.id}`, corpo) : await api('POST', '/eventos', corpo);
    avisoOk($q, props.id ? 'Jogo atualizado' : 'Jogo incluído');
    router.replace(`/admin/eventos/${ev.id}`);
  } catch (e) {
    avisoErro($q, e);
  } finally {
    salvando.value = false;
  }
}

const voltar = () => (props.id ? router.push(`/admin/eventos/${props.id}`) : router.push('/admin/eventos'));
</script>

<template>
  <q-page class="page" style="padding-bottom: 110px">
    <div v-if="carregando" class="flex flex-center q-pa-xl"><q-spinner-dots color="primary" size="40px" /></div>

    <template v-else>
      <div class="row items-center q-mb-md">
        <q-btn flat no-caps color="primary" icon="arrow_back" label="Voltar" @click="voltar" />
        <div class="text-h6 q-ml-sm">{{ id ? 'Editar jogo' : 'Novo jogo' }}</div>
      </div>

      <div class="cartao q-pa-md">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input :model-value="dataBR(data)" outlined readonly label="Data do jogo">
              <template #append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="data" mask="YYYY-MM-DD">
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Ok" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="valorTexto"
              outlined
              label="Valor total pago"
              prefix="R$"
              inputmode="decimal"
              :error="valorTexto !== '' && !valorOk"
              error-message="Informe um valor maior que zero"
            />
          </div>
        </div>
      </div>

      <div class="row items-end q-mt-md">
        <div class="secao-titulo col" style="margin-bottom: 4px">Quem jogou ({{ selecionados.length }})</div>
        <q-btn v-if="ultimo" flat dense no-caps color="primary" icon="history" :label="`Repetir ${dataBR(ultimo.data)}`" @click="repetirUltimo" />
        <q-btn flat dense no-caps color="primary" label="Todos" @click="marcarTodos" />
        <q-btn flat dense no-caps color="grey-8" label="Limpar" @click="limpar" />
      </div>

      <q-input v-model="busca" outlined dense bg-color="white" placeholder="Buscar atleta" clearable class="q-mb-sm">
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-list v-if="visiveis.length" class="cartao" separator>
        <q-item v-for="a in visiveis" :key="a.id" tag="label" v-ripple>
          <q-item-section side>
            <q-checkbox v-model="selecionados" :val="a.id" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ a.nome }}</q-item-label>
          </q-item-section>
          <q-item-section v-if="a.saldo > 0" side>
            <span class="text-caption text-negative">deve {{ brl(a.saldo) }}</span>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else class="text-grey-7 text-center q-pa-md">
        {{ atletas.length ? 'Nenhum atleta encontrado.' : 'Cadastre os atletas antes de incluir um jogo.' }}
      </div>

      <div v-if="id" class="text-caption text-grey-7 q-mt-md">
        Ao alterar o valor ou os participantes, o valor de cada um é recalculado. Quem for removido do jogo deixa de constar como pago.
      </div>

      <q-page-sticky position="bottom" expand>
        <div class="barra-fixa full-width">
          <div class="row items-center no-wrap q-px-md q-pt-sm" style="max-width: 820px; margin: 0 auto; width: 100%">
            <div class="col">
              <template v-if="porPessoa !== null">
                <div class="text-caption text-grey-7">{{ brl(valor) }} ÷ {{ selecionados.length }} atletas</div>
                <div class="text-h6 valor">{{ brl(porPessoa) }} <span class="text-body2 text-grey-7">por pessoa</span></div>
              </template>
              <div v-else class="text-grey-7">Informe o valor e selecione quem jogou</div>
            </div>
            <q-btn unelevated no-caps color="primary" size="lg" icon="check" label="Salvar" :disable="!podeSalvar" :loading="salvando" @click="salvar" />
          </div>
        </div>
      </q-page-sticky>
    </template>
  </q-page>
</template>
