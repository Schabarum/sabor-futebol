import { createRouter, createWebHistory } from 'vue-router';
import { sessao } from './api.js';

const rotas = [
  { path: '/login', redirect: { path: '/atletas', query: { admin: '1' } } },
  {
    path: '/',
    component: () => import('./layouts/PublicLayout.vue'),
    children: [
      { path: '', redirect: '/atletas' },
      { path: 'atletas', component: () => import('./pages/admin/AtletasPage.vue'), props: { somenteLeitura: true } },
      {
        path: 'atletas/:id',
        component: () => import('./pages/admin/AtletaDetalhePage.vue'),
        props: (route) => ({ id: route.params.id, somenteLeitura: true }),
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('./layouts/AdminLayout.vue'),
    meta: { papel: 'admin' },
    redirect: '/admin/atletas',
    children: [
      { path: 'atletas', component: () => import('./pages/admin/AtletasPage.vue') },
      { path: 'atletas/:id', component: () => import('./pages/admin/AtletaDetalhePage.vue'), props: true },
      { path: 'eventos', component: () => import('./pages/admin/EventosPage.vue') },
      { path: 'eventos/novo', component: () => import('./pages/admin/EventoFormPage.vue') },
      { path: 'eventos/:id', component: () => import('./pages/admin/EventoDetalhePage.vue'), props: true },
      { path: 'eventos/:id/editar', component: () => import('./pages/admin/EventoFormPage.vue'), props: true },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/atletas' },
];

const router = createRouter({ history: createWebHistory(), routes: rotas });

router.beforeEach((to) => {
  const exigido = to.matched.find((r) => r.meta.papel)?.meta.papel;
  if (exigido && sessao.papel !== exigido) {
    return sessao.papel === 'admin' ? '/admin' : { path: '/atletas', query: { admin: '1' } };
  }
  return true;
});

export default router;
