import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * App-wide light/dark theme, mirroring the mobile app's behaviour.
 *
 * Three modes, not two. The default is LIGHT: this product has its own look
 * and shouldn't flip to dark just because a laptop happens to be set that
 * way. 'dark' is the switch in the sidebar, and 'system' ('Auto') is there
 * for anyone who does want it to follow the OS.
 *
 * Unlike React Native, the web already has a cascade: every component styled
 * through the semantic tokens (bg-card, text-foreground, border-border)
 * flips automatically when `.dark` lands on <html>. Only hardcoded utility
 * colours (a literal white background, a fixed grey text) need touching.
 */

const STORAGE_KEY = 'uktex.themeMode';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  mode: ThemeMode;
  scheme: 'light' | 'dark';
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  /** Flips straight between light and dark, leaving 'system' behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue>({
  mode: 'light',
  scheme: 'light',
  isDark: false,
  setMode: () => {},
  toggle: () => {},
});

/** The mode a viewer gets before they have ever chosen one.
 *
 *  Light, deliberately -NOT 'system'. Following the OS meant every employee
 *  whose machine happens to be on dark was handed a dark app they never asked
 *  for. Light is this product's own default; dark is opt-in, either by the
 *  switch or by choosing Auto to follow the OS from then on. */
const DEFAULT_MODE: ThemeMode = 'light';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Private mode / storage disabled -fall through to the default below.
  }
  return DEFAULT_MODE;
}

function systemScheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Read synchronously on first render: resolving this in an effect would
  // paint one light frame before switching, which is the flash of wrong
  // theme every dark-mode user notices.
  const [mode, setModeState] = useState<ThemeMode>(readStored);
  const [system, setSystem] = useState<'light' | 'dark'>(systemScheme);

  // Keep following the OS while mode === 'system'. The listener stays
  // subscribed regardless, so switching back to 'system' is instantly right.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const scheme: 'light' | 'dark' = mode === 'system' ? system : mode;

  // The single place the class is applied. `color-scheme` comes along too so
  // native form controls, scrollbars and the browser's own UI match -without
  // it you get white scrollbars and a white date picker on a dark page.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', scheme === 'dark');
    root.style.colorScheme = scheme;
  }, [scheme]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // Not fatal -the theme still applies for this session.
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme, setMode]);

  const value = useMemo<ThemeValue>(
    () => ({ mode, scheme, isDark: scheme === 'dark', setMode, toggle }),
    [mode, scheme, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
