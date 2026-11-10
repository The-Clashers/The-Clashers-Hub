import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useWindowDimensions } from 'react-native';
import {
  lightTheme,
  darkTheme,
  themeFor,
  densityFor,
  type ThemeTokens,
} from './tokens';

// Theme control. The canvas is light or dark; the user can override the
// system preference and the choice persists in localStorage.

export type ThemeName = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeTokens;
  name: ThemeName;
  setName: (name: ThemeName) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'tch.theme';

function readStoredName(): ThemeName | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // localStorage can throw in private mode or sandboxed iframes.
  }
  return null;
}

function writeStoredName(name: ThemeName): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore write errors.
  }
}

function systemName(): ThemeName {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveInitialName(): ThemeName {
  return readStoredName() ?? systemName();
}

export interface ThemeProviderProps {
  children: ReactNode;
  initialName?: ThemeName;
}

export function ThemeProvider({ children, initialName }: ThemeProviderProps) {
  const [name, setNameState] = useState<ThemeName>(
    initialName ?? resolveInitialName,
  );
  const { width } = useWindowDimensions();
  const density = densityFor(width);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      if (readStoredName() !== null) return;
      setNameState(event.matches ? 'dark' : 'light');
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  useEffect(() => {
    if (typeof Appearance === 'undefined' || !Appearance.setColorScheme) {
      return;
    }
    Appearance.setColorScheme(name);
  }, [name]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const colors =
      name === 'light' ? lightTheme.colors : darkTheme.colors;
    document.documentElement.style.backgroundColor = colors.canvas;
    document.documentElement.style.colorScheme = name;
    document.body.style.backgroundColor = colors.canvas;
    document.body.style.color = colors.textPrimary;
  }, [name]);

  const setName = useCallback((next: ThemeName) => {
    setNameState(next);
    writeStoredName(next);
  }, []);

  const toggle = useCallback(() => {
    setNameState((current) => {
      const next: ThemeName = current === 'light' ? 'dark' : 'light';
      writeStoredName(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: themeFor(name, density),
      name,
      setName,
      toggle,
    }),
    [name, density, setName, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      'useTheme must be used inside <ThemeProvider>. Wrap the app root in src/main.tsx.',
    );
  }
  return ctx;
}
