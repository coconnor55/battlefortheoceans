// src/reportWebVitals.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.2: Removed Sentry integration - Web Vitals logging disabled for now
//         - Can be re-enabled later if needed for performance monitoring

const reportWebVitals = onPerfEntry => {
  // Web Vitals reporting disabled - can be re-enabled if needed
  // For now, focus on error logging via Supabase
  if (process.env.NODE_ENV === 'development' && onPerfEntry && onPerfEntry instanceof Function) {
    // Optional: Log to console in development
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    }).catch(() => {
      // web-vitals package not installed - silently continue
    });
  }
};

export default reportWebVitals;
