import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const LIGHT_DEFAULT_VERSION = 'light-default-v1';

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';

  // Migrate users who previously received dark as the default. After this
  // one-time migration, the theme toggle can persist an explicit dark choice.
  if (localStorage.getItem('theme-default-version') !== LIGHT_DEFAULT_VERSION) {
    localStorage.setItem('theme-default-version', LIGHT_DEFAULT_VERSION);
    localStorage.setItem('theme', 'light');
    return 'light';
  }

  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
