import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: EffectiveTheme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  effectiveTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('zenet_theme_mode');
        if (saved === 'dark' || saved === 'light') return saved;
      }
    } catch (_) {}
    return 'light';
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem('zenet_theme_mode', mode);
    } catch (_) {}
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      if (root.style) root.style.colorScheme = 'dark';
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
        body.setAttribute('data-theme', 'dark');
      }
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      if (root.style) root.style.colorScheme = 'light';
      if (body) {
        body.classList.add('light');
        body.classList.remove('dark');
        body.setAttribute('data-theme', 'light');
      }
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme: theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

