// src/index.js (v0.1.1)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Import styles in correct order (CRITICAL)
import './index.css';              // 1. Global resets first
import './styles/theme.css';       // 2. Theme variables and base styles

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

// EOF
