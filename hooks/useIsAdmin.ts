import { useEffect, useState } from 'react';
import { db } from '../services/db';
import { getCurrentUser } from '../services/auth';

// Is the signed-in user the club admin (approves coach access)? firestore.rules enforce it too.
export const useIsAdmin = (): boolean => {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const uid = getCurrentUser()?.uid;
    if (!uid) return;
    db.getAdminUids()
      .then(uids => setIsAdmin(uids.includes(uid)))
      .catch(e => console.error('[useIsAdmin] Could not load admins:', e));
  }, []);
  return isAdmin;
};
