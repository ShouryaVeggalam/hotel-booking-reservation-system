/* =====================================================================
   config.js - runtime configuration for the browser.

   This is the ONLY file that has to change when the API moves to a
   different host. The frontend is a plain static site: there is no
   build step and no bundler, so the usual `import.meta.env` /
   `process.env` mechanism does not exist. Everything is therefore
   configured in one small file that every page loads.

   Three settings live here:

   1. The address of the API

        window.STAYWISE_API_BASE = '/api';
      Same origin (default). The page calls /api/... on its own host.
      In production the `vercel.json` rewrite forwards those calls to
      the Render API. No CORS is involved.

        window.STAYWISE_API_BASE = 'https://staywise-api.onrender.com/api';
      Direct to the API host. The browser calls the Render API
      directly. This requires the backend CORS_ORIGIN to list the
      frontend origin. This mode is the more robust of the two on a
      free tier, because a request that has to wake a sleeping service
      up is not cut short by a proxy in front of it.

   2. The timeout of a normal data request, in milliseconds.

        window.STAYWISE_API_TIMEOUT = 30000;
      A request that is not answered in time is aborted and reported
      as an error instead of leaving the page spinning forever.

   3. The timeout of the health check, in milliseconds.

        window.STAYWISE_API_HEALTH_TIMEOUT = 90000;
      The health check may be the request that wakes a sleeping free
      tier service up, so it is given more time.

   Never put a database credential in this file. Only the public
   address of the API belongs here.
   ===================================================================== */
window.STAYWISE_API_BASE = '/api';
window.STAYWISE_API_TIMEOUT = 30000;
window.STAYWISE_API_HEALTH_TIMEOUT = 90000;
