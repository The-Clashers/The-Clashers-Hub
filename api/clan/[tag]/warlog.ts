// GET /api/clan/:tag/warlog. Thin adapter: the platform runs this file as
// the function; all logic lives in server/.

import { handleWarlog } from '../../../server/routes';

export default handleWarlog;
