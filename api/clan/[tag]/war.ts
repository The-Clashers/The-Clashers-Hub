// GET /api/clan/:tag/war. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.

import { handleWar } from '../../../server/routes';

export default handleWar;
