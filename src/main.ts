import { mount } from 'svelte';
import App from './App.svelte';
import './styles/app.css';

const app = mount(App, { target: document.getElementById('app')! });

// PWA service worker: production only — in dev it would fight Vite's HMR and
// serve stale modules. Registration failures are non-fatal (the site just
// behaves like a regular web page).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

export default app;
