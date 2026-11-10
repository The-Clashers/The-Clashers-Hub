# The Clashers Hub

Clan and player analytics for Clash of Clans, live and login-free.

The in-game profile shows raw counters, and stat trackers show walls of numbers. Neither directly answers whether an account is rushed, who fails to donate back on a clan roster, or who is ready for war. The Clashers Hub turns raw public game data into computed verdicts directly in the browser.

---

## Features

- **Clan Search and Roster Audits:** Search clans by name or tag. View live rosters with automatic donation balance flags, member roles, and league ranks.
- **Player Profiles and Rushed Progression:** Calculate category deficits across heroes, troops, spells, equipment, and pets against official Town Hall upgrade caps.
- **Head-to-Head Compare:** Compare two players or two clans side-by-side with metric-by-metric deltas and category advantages.
- **Town Hall Cap Explorer:** Interactive reference tool for Town Hall 7 through 18, detailing hero caps, level rails, equipment totals, and pet counts.
- **Recent Searches Persistence:** Quick-lookup chips saved to browser local storage for fast access without accounts or logins.
- **Theme System:** Native light and dark themes using custom design tokens, backdrop glass surfaces, and gold accent highlights.
- **Accessibility:** Full keyboard navigation support (Enter-key activation for link pressables), ARIA roles, and high-contrast color pairings.

---

## Architecture and Design Principles

1. **Zero Database:** The live Clash of Clans API acts as the data store. The application stores no user accounts, runs no snapshot jobs, and requires no external database.
2. **Key Isolation Boundary:** The `COC_API_TOKEN` exists strictly on the serverless proxy tier (`/api/*` and `server/`). The client bundle contains zero credentials.
3. **Client-Side Analysis Engines:** All progression audits, rushed calculations, and donation ratio verdicts execute in the browser as pure TypeScript modules with unit tests.
4. **Locally Bundled Reference Data:** Upgrade cap tables, super-troop normalizations, and game unit assets are bundled locally, eliminating unnecessary runtime API calls.
5. **React Native for Web:** The entire UI is built with React Native components (`View`, `Text`, `StyleSheet`, `Pressable`, `react-native-svg`) rendered cleanly to the browser DOM.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React Native for Web (`react-native-web`) |
| Build Tool | Vite |
| Language | TypeScript (strict mode) |
| Routing | React Router |
| Server State | TanStack Query |
| Graphics | `react-native-svg` |
| Font | `@fontsource-variable/inter` |
| API Tier | Vercel Serverless Functions (Node.js) |
| Game Data Proxy | RoyaleAPI Proxy (`cocproxy.royaleapi.dev`) |
| Test Runner | Vitest |

---

## Repository Structure

```
The-Clashers-Hub/
├── api/             # Vercel serverless functions (proxy endpoints)
├── docs/
│   ├── concept/     # Architecture, requirements tracker, and design specs
│   └── session/     # Session logs tracking development milestones
├── fixtures/        # Anonymized CoC API payloads for testing
├── scripts/         # Dev scripts (local API server, key verification)
├── server/          # Serverless tier logic (caching, upstream client)
├── src/
│   ├── api/         # Frontend API clients for /api endpoints
│   ├── assets/      # Game icons and placeholders
│   ├── components/  # Reusable UI components (NavBar, Footer, Gauge, etc.)
│   ├── engines/     # Pure scoring engines (rushed, donation balance)
│   ├── lib/         # Reference tables, tag parsing, recent searches
│   ├── screens/     # Screen views (Home, Clans, Players, Compare, etc.)
│   └── theme/       # Design tokens, themes, and base styles
└── test/            # Test setup and shared utilities
```

---

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Clash of Clans Developer API key (from https://developer.clashofclans.com)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/The-Clashers/The-Clashers-Hub.git
   cd The-Clashers-Hub
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```bash
   COC_API_TOKEN=your_jwt_token_here
   COC_API_BASE_URL=https://cocproxy.royaleapi.dev/v1
   ```

### Running Locally

Run both the API proxy server and the Vite client:

```bash
# Terminal 1: Start the local API server (port 3001)
npm run dev:api

# Terminal 2: Start the frontend Vite dev server (port 5173)
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Testing and Verification

Run the test suite, linter, and type checks:

```bash
# Run unit tests with Vitest
npm test

# Run ESLint
npm run lint

# Check types and compile production build
npm run build
```

---

## Documentation

Comprehensive project documentation is maintained in the `docs/` directory:

- [Concept Documentation](docs/concept/README.md)
  - [00 - Product Overview](docs/concept/00-overview.md)
  - [01 - Tech Stack](docs/concept/01-tech-stack.md)
  - [02 - Requirements Tracker](docs/concept/02-requirements-tracker.md)
  - [03 - Features List](docs/concept/03-features-list.md)
  - [04 - API Strategy](docs/concept/04-api-strategy.md)
  - [05 - Scoring Engines](docs/concept/05-scoring-engines.md)
  - [06 - Data Flow and Caching](docs/concept/06-data-flow-and-caching.md)
  - [07 - Design Language](docs/concept/07-design-language.md)
  - [08 - Roadmap](docs/concept/08-roadmap.md)
  - [09 - Coding Standards](docs/concept/09-coding-standards.md)
- [Session Logs](docs/session/README.md)

---

## Legal and Policy

This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: https://supercell.com/fan-content-policy.

Clash of Clans and its logos are trademarks of Supercell.

---

## License

This project is open source and available under the [MIT License](LICENSE).
