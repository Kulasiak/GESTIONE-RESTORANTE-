import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { AppProvider } from './state';
import { installAutoLock } from './lib/vault';
import App from './App';

registerSW({ immediate: true });
installAutoLock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
