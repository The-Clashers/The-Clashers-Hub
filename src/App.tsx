import { Route, Routes } from 'react-router';
import HomeScreen from './screens/HomeScreen';
import ClanScreen from './screens/ClanScreen';
import PlayerScreen from './screens/PlayerScreen';
import CompareScreen from './screens/CompareScreen';
import TokenScreen from './screens/TokenScreen';
import HelloClanScreen from './screens/HelloClanScreen';

// The URL map is a product feature (shareable links), documented in the
// feature list. Compare gets its landing route here; the player and clan
// compare sub-routes land with the compare screens themselves. The /tokens
// route is a review surface for T-M0-2 and /hello is the T-M0-5 milestone
// smoke surface (a hardcoded tag rendered from live data). Both stay in
// place for design QA on the preview deploy.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/clan/:tag" element={<ClanScreen />} />
      <Route path="/player/:tag" element={<PlayerScreen />} />
      <Route path="/compare" element={<CompareScreen />} />
      <Route path="/tokens" element={<TokenScreen />} />
      <Route path="/hello" element={<HelloClanScreen />} />
    </Routes>
  );
}
