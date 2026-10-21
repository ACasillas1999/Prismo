import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registrar Service Worker para soporte PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('PWA Service Worker registrado con éxito:', reg.scope);
    }).catch((err) => {
      console.log('Error al registrar Service Worker:', err);
    });
  });
} else if ('serviceWorker' in navigator) {
  // También en desarrollo si el navegador lo permite
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW no registrado en dev o error:', err);
    });
  });
}

