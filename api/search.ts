// GET /api/search. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.
//
// The export shape is the Vercel web-standard form: a default export with a
// fetch method taking a Request and returning a Response. A bare
// `export default handler` is invoked Node-style (req, res) by the platform
// and crashes with FUNCTION_INVOCATION_FAILED, so the object form is load
// bearing, not style.

import { handleSearch } from '../server/routes';

export default {
  async fetch(request: Request): Promise<Response> {
    return handleSearch(request);
  },
};
