// GET /api/search. Thin adapter: the platform runs this file as the
// function; all logic lives in server/.

import { handleSearch } from '../server/routes';

export default handleSearch;
