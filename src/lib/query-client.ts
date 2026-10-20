import { QueryClient } from '@tanstack/react-query';

// Shared query defaults. The server tier owns freshness with its per-route
// TTL cache, so the client stays conservative here: data is considered stale
// after a minute (inside every server TTL), a failed call gets exactly one
// retry (the tier already retries upstream throttles itself), and no
// refetch happens just because the tab regained focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
