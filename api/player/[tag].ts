// GET /api/player/:tag. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.

import { handlePlayer } from '../../server/routes';

export default handlePlayer;
