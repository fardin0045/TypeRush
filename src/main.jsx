import ErrorBoundary from './ErrorBoundary.jsx';
import React from 'react';
import { createRoot } from 'react-dom/client';
import GameRouter from './GameRouter.jsx';
import './style.css';
import './race-screen.css';
import './side-race.css';
import './fight/fight.css';
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <GameRouter />
  </ErrorBoundary>,
);
