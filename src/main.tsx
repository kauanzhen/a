import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { ProvedorApp } from './hooks/app';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ProvedorApp>
        <App />
      </ProvedorApp>
    </HashRouter>
  </StrictMode>,
);
