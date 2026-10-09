<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { sair } from '../api.js';
import AjustesDialog from '../components/AjustesDialog.vue';

const router = useRouter();
const ajustes = ref(false);

function deslogar() {
  sair();
  router.replace('/atletas');
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-icon name="sports_soccer" size="28px" class="q-mr-sm" />
        <q-toolbar-title class="text-weight-bold">saBORR futebol</q-toolbar-title>
        <q-btn flat round icon="settings" aria-label="Ajustes" @click="ajustes = true" />
        <q-btn flat round icon="logout" aria-label="Sair" @click="deslogar" />
      </q-toolbar>
      <q-tabs align="justify" indicator-color="accent" active-color="white" class="text-green-2">
        <q-route-tab to="/admin/atletas" icon="groups" label="Atletas" no-caps />
        <q-route-tab to="/admin/eventos" icon="event" label="Jogos" no-caps />
      </q-tabs>
    </q-header>

    <q-page-container>
      <router-view :key="$route.fullPath" />
    </q-page-container>

    <ajustes-dialog v-model="ajustes" />
  </q-layout>
</template>
