/* =====================================================================
   config.js - runtime configuration for the browser.

   This is the ONLY file that has to change when the API moves to a
   different host. The frontend is a plain static site: there is no
   build step and no bundler, so the usual `import.meta.env` /
   `process.env` mechanism does not exist. Everything is therefore
   configured in one small file that every page loads.

   The API base is set to the live Vercel backend so the browser calls
   it directly. This avoids depending on a Vercel rewrite and works
   even if the project root directory changes.
   ===================================================================== */
window.STAYWISE_API_BASE = 'https://staywise-api-eight.vercel.app/api';
window.STAYWISE_API_TIMEOUT = 30000;
window.STAYWISE_API_HEALTH_TIMEOUT = 90000;
