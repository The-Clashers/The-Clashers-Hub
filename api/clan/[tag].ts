// GET /api/clan/:tag. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.
//
// Web-standard fetch export (see api/search.ts for why the object form is
// load bearing on Vercel).

import { handleClan } from '../../server/routes';

export default {
  async fetch(request: Request): Promise<Response> {
    return handleClan(request);
  },
};
