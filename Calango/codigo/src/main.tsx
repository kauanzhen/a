import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './interface/App';
import './interface/estilos.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
