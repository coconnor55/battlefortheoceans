// src/index.js (v0.1.3)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './utils/Debug.js'

// Import styles in correct order (CRITICAL)
import './index.css';                        // 1. Global resets first
import './styles/theme.css';                 // 2. Theme variables and base styles
import './styles/shared-components.css';     // 3. NEW - Shared component patterns
import './styles/modal-overlay.css';         // 4. Modal systems
import './styles/buttons.css';               // 5. Button system
import './styles/forms.css';                 // 6. Form components
import './styles/game-ui.css';               // 7. Game-specific UI (replace with v2.0.0)
import './styles/utilities.css';             // 8. Utility classes
import './styles/stats.css';
import './styles/responsive.css';            // 9. Responsive adjustments (last)

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

// EOF
