// src/index.js v0.1.7
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.7: Removed hash capture - let Supabase handle it naturally
//         - LaunchPage now checks session for profile instead
//         - Simpler flow: email link → Supabase → LaunchPage → ProfileCreation
// v0.1.6: Added redirect to /email-confirmed route after capturing hash
// v0.1.5: Better semantic naming for captured hash
//         - Renamed pendingConfirmation → urlHash (more accurate)
//         - Renamed confirmationCapturedAt → urlHashCapturedAt
//         - More flexible for future auth flows (signup, recovery, etc.)
// v0.1.4: Capture URL hash BEFORE React initialization
//         - Store confirmation hash in sessionStorage before anything else runs
//         - Prevents Supabase from consuming hash during initialization
// v0.1.3: Import order fix for CSS

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

const version = 'v0.1.7';

// No hash capture needed - Supabase and LaunchPage handle auth flow
console.log(`[INDEX] ${version} React initialization - letting Supabase handle auth naturally`);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

// EOF
