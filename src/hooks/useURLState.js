import { useState, useEffect, useCallback } from 'react';

export function useURLState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has(key) ? params.get(key) : defaultValue;
  });

  const setURLState = useCallback((newValue) => {
    setValue(newValue);
    const url = new URL(window.location);
    if (newValue === defaultValue || newValue === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, newValue);
    }
    window.history.replaceState({}, '', url);
  }, [key, defaultValue]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setValue(params.has(key) ? params.get(key) : defaultValue);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [key, defaultValue]);

  return [value, setURLState];
}
