import { useState, useEffect } from 'react';

/**
 * Works exactly like useState but reads/writes to localStorage.
 * @param {string} key   - localStorage key
 * @param {*} initial    - default value if nothing is stored yet
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage quota exceeded or private-mode restriction — silently ignore
    }
  }, [key, value]);

  return [value, setValue];
}
