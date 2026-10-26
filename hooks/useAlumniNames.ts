import { useEffect, useState } from 'react';
import { loadAlumniNames } from '../services/classYears';
import { normalizeName } from '../services/alumni';

// Normalized names of graduated players, for hiding them on everyday screens.
// `ready` is false until the list has loaded: screens wait for it, so alumni never flash up.
export const useAlumniNames = () => {
  const [names, setNames] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    loadAlumniNames().then(n => { if (live) { setNames(n); setReady(true); } });
    return () => { live = false; };
  }, []);
  const isAlumniName = (name: string) => names.has(normalizeName(name));
  return { alumniNames: names, isAlumniName, ready };
};
