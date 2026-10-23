// GET /api/search. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.
//
// The default export must be a plain function: the platform's Node launcher
// invokes it as (req, res), and any other export shape (a bare web-standard
// handler, or the fetch-object form) crashes at invocation time on the
// deployed runtime. nodeHandler bridges the Node call into our web-standard
// handler and also tolerates a web-style call, which is what the local dev
// server makes.

import { handleSearch } from '../server/routes';
import { nodeHandler } from '../server/vercel-adapter';

export default nodeHandler(handleSearch);
