// src/utils/sanitizeHTML.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: HTML sanitization utility using DOMPurify
//         - Sanitizes HTML content before rendering with dangerouslySetInnerHTML
//         - Prevents XSS attacks from malicious HTML content
//         - Allows safe HTML tags and attributes for content display

import DOMPurify from 'dompurify';

const version = 'v0.1.0';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - Unsanitized HTML string
 * @param {Object} options - DOMPurify configuration options
 * @returns {string} Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const sanitizeHTML = (dirty, options = {}) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  // Default configuration: Allow common HTML tags for content display
  // Block scripts, event handlers, and dangerous attributes
  const defaultOptions = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'div', 'span',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'alt', 'src', 'width', 'height', 'class', 'id',
      'colspan', 'rowspan', 'align', 'style'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Remove any script tags and event handlers
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Keep relative URLs safe
    ALLOW_DATA_ATTR: false,
    // Sanitize style attributes
    ALLOW_UNKNOWN_PROTOCOLS: false
  };

  const config = { ...defaultOptions, ...options };

  try {
    return DOMPurify.sanitize(dirty, config);
  } catch (error) {
    console.error(`[SANITIZE] ${version} Error sanitizing HTML:`, error);
    // Return empty string on error to prevent XSS
    return '';
  }
};

/**
 * Sanitize HTML for game snapshot content (more restrictive)
 * @param {string} dirty - Unsanitized HTML string
 * @returns {string} Sanitized HTML string
 */
export const sanitizeSnapshotHTML = (dirty) => {
  return sanitizeHTML(dirty, {
    // Even more restrictive for user-generated snapshot content
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'h1', 'h2', 'h3', 'div', 'span', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['class', 'style'],
    // No links or images in snapshots
    ALLOWED_URI_REGEXP: /^$/i
  });
};

export default sanitizeHTML;

