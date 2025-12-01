// src/pages/AboutPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.3: Sanitize HTML in about content to prevent XSS attacks
//         - Use sanitizeHTML() before rendering eraConfig.about
//         - Prevents malicious scripts in era configuration content
// v0.1.2: Fixed CSS classes to match StatsPage exactly
//         - container flex flex-column flex-center
//         - content-pane content-pane--wide
//         - card-header card-header--with-close
//         - card-title
//         - btn btn--secondary btn--sm for close
// v0.1.1: Removed inline styles - use existing CSS only (matches StatsPage)
// v0.1.0: Initial creation - About {Era} page

import React from 'react';
import { coreEngine, useGame } from '../context/GameContext';
import { sanitizeHTML } from '../utils/sanitizeHTML';

const version = 'v0.1.3';

const AboutPage = ({ onClose }) => {
  const eraConfig = coreEngine.selectedEraConfig;
    
  console.log('[ABOUT]', version, 'Rendering About page for era:', eraConfig?.name);
  
  // If no era config or no about content, show error
  if (!eraConfig || !eraConfig.about) {
    console.warn('[ABOUT]', version, 'No era config or about content available');
    return (
      <div className="container flex flex-column flex-center">
        <div className="content-pane content-pane--wide">
          <div className="card-header card-header--with-close">
            <h2 className="card-title">About</h2>
            {onClose && (
              <button className="btn btn--secondary btn--sm" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
          <div>
            <p>No historical information available for this era.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header card-header--with-close">
          <h2 className="card-title"></h2>
          {onClose && (
            <button className="btn btn--secondary btn--sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div>
          <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(eraConfig.about) }} />
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
// EOF
