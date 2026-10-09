/**
 * Point d'entrée dédié pour l'application terrain FANISA Collecte.
 * Accessible sur /collecte — installe une PWA séparée sur Android.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CollecteModule from './components/CollecteModule';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CollecteModule />
  </StrictMode>,
);
