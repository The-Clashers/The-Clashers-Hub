// GET /api/clan/:tag. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.

import { handleClan } from '../../server/routes';

export default handleClan;
