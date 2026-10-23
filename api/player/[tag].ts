// GET /api/player/:tag. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.
//
// Plain-function default export via nodeHandler; see api/search.ts for why
// the shape is load bearing on the platform.

import { handlePlayer } from '../../server/routes';
import { nodeHandler } from '../../server/vercel-adapter';

export default nodeHandler(handlePlayer);
