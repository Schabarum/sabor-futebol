<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminLoginDialog from '../components/AdminLoginDialog.vue';

const route = useRoute();
const router = useRouter();
const loginAdmin = ref(false);

function abrirAdmin() {
  loginAdmin.value = true;
}

watch(
  () => route.query.admin,
  (v) => {
    if (v !== undefined && v !== null && v !== '0' && v !== 'false') {
      loginAdmin.value = true;
      const q = { ...route.query };
      delete q.admin;
      router.replace({ path: route.path, query: q });
    }
  },
  { immediate: true },
);
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-icon name="sports_soccer" size="28px" class="q-mr-sm" />
        <q-toolbar-title class="text-weight-bold">saBORR futebol</q-toolbar-title>
        <q-btn flat no-caps icon="admin_panel_settings" label="Gerenciar" @click="abrirAdmin" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view :key="route.fullPath" />
    </q-page-container>

    <admin-login-dialog v-model="loginAdmin" />
  </q-layout>
</template>
