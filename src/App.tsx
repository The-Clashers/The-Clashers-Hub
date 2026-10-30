import { Route, Routes } from 'react-router';
import NavBar from './components/NavBar';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import ClanScreen from './screens/ClanScreen';
import PlayerScreen from './screens/PlayerScreen';
import PlayersScreen from './screens/PlayersScreen';
import ContributorsScreen from './screens/ContributorsScreen';
import CompareScreen from './screens/CompareScreen';
import TokenScreen from './screens/TokenScreen';

// The URL map is a product feature (shareable links), documented in the
// feature list. The owner's nav revision splits the old entry route into
// real pages: `/` is the home landing (hero lookup plus quick links),
// `/clans` is the clan search (name or #tag plus the filter row and the
// paginated results), `/players` is the player tag lookup, and
// `/contributors` credits the repo. The NavBar renders above every route
// with the same lookup, the page links, and the theme toggle, so the
// per-screen headers stopped carrying the brand and the toggle.
//
// `/clan/:tag` and `/player/:tag` keep their shareable bare-tag form (the
// `#` stays hidden, re-attached in exactly one place, lib/tag.ts).
// Compare gets its landing route here; the player and clan compare
// sub-routes land with the compare screens themselves. The /tokens route
// is a review surface for T-M0-2 and stays linked from the contributors
// page (the owner's call); the /hello M0 smoke screen is gone, the real
// /clan/:tag screen renders everything it used to render (the owner's
// duplicate-surface note).
export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/clans" element={<SearchScreen />} />
        <Route path="/players" element={<PlayersScreen />} />
        <Route path="/contributors" element={<ContributorsScreen />} />
        <Route path="/clan/:tag" element={<ClanScreen />} />
        <Route path="/player/:tag" element={<PlayerScreen />} />
        <Route path="/compare" element={<CompareScreen />} />
        <Route path="/tokens" element={<TokenScreen />} />
      </Routes>
    </>
  );
}
