/* =====================================================================
   config.js - runtime configuration for the browser.

   This is the ONLY file that has to change when the API moves to a
   different host. The frontend is a plain static site: there is no
   build step and no bundler, so the usual `import.meta.env` /
   `process.env` mechanism does not exist. Everything is therefore
   configured in one small file that every page loads.

   Two supported modes:

   1. Same origin (default)
        window.STAYWISE_API_BASE = '/api';
      The page calls /api/... on its own host. In production the
      `vercel.json` rewrite forwards those calls to the Render API.
      No CORS is involved and there is nothing to configure.

   2. Direct to the API host
        window.STAYWISE_API_BASE = 'https://staywise-api.onrender.com/api';
      The browser calls the Render API directly. This requires the
      backend CORS_ORIGIN to list the frontend origin.

   Never put a database credential in this file. Only the public
   address of the API belongs here.
   ===================================================================== */
window.STAYWISE_API_BASE = '/api';
