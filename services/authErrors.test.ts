// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage, withTimeout, isInAppBrowser, cleanEmail, cleanJoinCode } from './authErrors.ts';

const fbErr = (code: string) => Object.assign(new Error(`Firebase: Something (${code}).`), { code });

test('common sign-up and sign-in errors read as plain English, never raw Firebase text', () => {
  const codes = [
    'auth/email-already-in-use', 'auth/weak-password', 'auth/invalid-email', 'auth/invalid-credential',
    'auth/wrong-password', 'auth/user-not-found', 'auth/too-many-requests', 'auth/network-request-failed',
    'auth/popup-closed-by-user', 'auth/popup-blocked', 'auth/cancelled-popup-request',
    'auth/account-exists-with-different-credential', 'auth/user-disabled', 'auth/internal-error',
    'auth/missing-password', 'auth/missing-email', 'auth/timeout',
  ];
  for (const code of codes) {
    const msg = authErrorMessage(fbErr(code), 'sign up');
    assert.ok(!/Firebase|auth\//.test(msg), `${code} → ${msg}`);
  }
});

test('an email already in use points the player to Sign in', () => {
  assert.match(authErrorMessage(fbErr('auth/email-already-in-use'), 'sign up'), /sign in/i);
});

test('an unknown error still hides Firebase text', () => {
  const msg = authErrorMessage(fbErr('auth/something-new'), 'sign in');
  assert.ok(!/Firebase|auth\//.test(msg), msg);
  assert.match(msg, /sign in/i);
});

test('withTimeout passes a fast answer through', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50, 'slow'), 7);
});

test('withTimeout rejects with a timeout code when nothing answers', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20, 'too slow'), (e: any) => e.code === 'timeout' && e.message === 'too slow');
});

test('app built-in browsers (where Google blocks sign-in) are spotted; Safari and Chrome are not', () => {
  const inApp = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.10.0.40',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.0.0 BytedanceWebview/d8a21c6',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 GroupMe/6.1',
  ];
  const browsers = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ];
  for (const ua of inApp) assert.equal(isInAppBrowser(ua), true, ua);
  for (const ua of browsers) assert.equal(isInAppBrowser(ua), false, ua);
});

test('emails lose stray spaces and capitals from phone keyboards', () => {
  assert.equal(cleanEmail('  Steve.Tucker@Gmail.com '), 'steve.tucker@gmail.com');
});

test('join codes match however a player types them', () => {
  assert.equal(cleanJoinCode(' oaks-cg3g '), 'OAKS-CG3G');
  assert.equal(cleanJoinCode('oaks cg3g'), 'OAKS-CG3G');
  assert.equal(cleanJoinCode('OAKSCG3G'), 'OAKS-CG3G');
  assert.equal(cleanJoinCode('OAKS–CG3G'), 'OAKS-CG3G'); // phone keyboards turn - into a dash
});
