// Plain-English messages for sign-in and sign-up errors, and a time limit for slow calls.
// Firebase's own messages ("Firebase: ... (auth/email-already-in-use).") read like a crash.

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'That email already has an account. Tap "Already have an account? Sign in" (or use Google if that is how you signed up).',
  'auth/weak-password': 'Pick a password of at least 6 characters.',
  'auth/invalid-email': 'That email address doesn\'t look right. Check for typos or a space at the end.',
  'auth/invalid-credential': 'Wrong email or password. Try again, or tap "Forgot password?".',
  'auth/wrong-password': 'Wrong email or password. Try again, or tap "Forgot password?".',
  'auth/user-not-found': 'No account with that email. Tap "Don\'t have an account? Sign up".',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Can\'t reach the server. Check your connection and try again.',
  'auth/popup-closed-by-user': 'The Google window closed before sign-in finished. Try again.',
  'auth/cancelled-popup-request': 'The Google window closed before sign-in finished. Try again.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Open this page in Safari or Chrome and try again, or use email and password.',
  'auth/web-storage-unsupported': 'This browser blocks sign-in. Open this page in Safari or Chrome.',
  'auth/operation-not-supported-in-this-environment': 'This browser blocks sign-in. Open this page in Safari or Chrome.',
  'auth/account-exists-with-different-credential': 'That email already signs in another way. Use email and password below, or tap "Forgot password?".',
  'auth/user-disabled': 'This account has been turned off. Ask a coach.',
  'auth/internal-error': 'Something went wrong on our side. Try again in a minute.',
  'auth/missing-password': 'Enter a password.',
  'auth/missing-email': 'Enter your email address.',
  'auth/timeout': 'Can\'t reach the server. Check your connection and try again.',
};

export const authErrorMessage = (err: unknown, action: 'sign in' | 'sign up' | 'send the reset email'): string => {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string' && MESSAGES[code]) return MESSAGES[code];
  return `Couldn't ${action}. Check your connection and try again.`;
};

// Rejects with `code: 'timeout'` if the promise hasn't settled in time.
export const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(message), { code: 'timeout' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Phone keyboards add capitals and a trailing space to emails.
export const cleanEmail = (email: string) => email.trim().toLowerCase();

// Apps' built-in browsers (Instagram, Facebook, Snapchat, TikTok, GroupMe, Android webviews).
// Google refuses to sign in there ("disallowed_useragent"), so the login screen says to open
// the page in Safari or Chrome.
export const isInAppBrowser = (ua: string) =>
  /FBAN|FBAV|FB_IAB|Instagram|Snapchat|musical_ly|BytedanceWebview|TikTok|GroupMe|LinkedInApp|Line\/|; wv\)/i.test(ua);
