import { useEffect, useState } from 'react';
import { loadAlumniNames } from '../services/classYears';
import { normalizeName } from '../services/alumni';

// Normalized names of graduated players, for hiding them on everyday screens.
// Empty until loaded. isAlumniName(name) is the usual way to use it.
export const useAlumniNames = () => {
  const [names, setNames] = useState<Set<string>>(new Set());
  useEffect(() => {
    let live = true;
    loadAlumniNames().then(n => { if (live) setNames(n); });
    return () => { live = false; };
  }, []);
  const isAlumniName = (name: string) => names.has(normalizeName(name));
  return { alumniNames: names, isAlumniName };
};
