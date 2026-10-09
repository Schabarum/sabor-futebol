import { createApp } from 'vue';
import { Quasar, Notify, Dialog } from 'quasar';
import langPt from 'quasar/lang/pt-BR';
import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/dist/quasar.css';
import './styles.css';

import App from './App.vue';
import router from './router.js';
import { aoSessaoExpirar, sair } from './api.js';

// Se o servidor responder 401 (sessão vencida), volta à visão pública dos atletas.
aoSessaoExpirar(() => {
  sair();
  router.replace('/atletas');
});

createApp(App)
  .use(Quasar, {
    plugins: { Notify, Dialog },
    lang: langPt,
    config: {
      brand: {
        primary: '#1b7a43',
        secondary: '#0d3b2a',
        accent: '#f5c518',
        positive: '#1b7a43',
        negative: '#c62828',
        warning: '#e08600',
      },
      notify: { position: 'top', timeout: 2500 },
    },
  })
  .use(router)
  .mount('#app');
