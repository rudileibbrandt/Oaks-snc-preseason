# How to Rotate Your Firebase API Key

## Important Context

**Firebase API keys are meant to be public** in client-side apps - they're not secret credentials. Your real security comes from:
- ✅ **Firestore Security Rules** (you have these configured)
- ✅ **API Key Restrictions** (domain/IP restrictions)
- ✅ **Authentication** (users must sign in)

However, since your API key was exposed in git history, rotating it is still a good security practice.

---

## Step-by-Step Guide

### 1. Get Your New API Key from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/oaks-snc/settings/general)
2. Scroll down to "Your apps" section
3. Click on your web app (or create a new one if needed)
4. You'll see your config - copy the **new** `apiKey` value

**OR** get it from Google Cloud Console:

1. Go to [Google Cloud Console - APIs & Credentials](https://console.cloud.google.com/apis/credentials?project=oaks-snc)
2. Find your Firebase API key (it will show as "Browser key" or "Web API key")
3. Click on it to view details
4. You can either:
   - **Option A**: Create a new key (recommended)
     - Click "Create credentials" → "API key"
     - Copy the new key
   - **Option B**: Use the existing one (if you just want to restrict it)

### 2. Restrict Your API Key (IMPORTANT!)

This is the most important security step:

1. In Google Cloud Console, click on your API key
2. Under **"Application restrictions"**:
   - Select **"HTTP referrers (web sites)"**
   - Add your allowed domains:
     ```
     localhost:*
     http://localhost:*
     https://localhost:*
     *.oaks-snc.web.app/*
     *.oaks-snc.firebaseapp.com/*
     https://oaks-snc.web.app/*
     https://oaks-snc.firebaseapp.com/*
     ```
   - Add your custom domain if you have one
3. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Select only these APIs:
     - ✅ Firebase Authentication API
     - ✅ Cloud Firestore API
     - ✅ Firebase Installations API (if available)
4. Click **"Save"**

### 3. Update Your Local Environment

1. Open your `.env` file
2. Replace the old API key with the new one:
   ```bash
   VITE_FIREBASE_API_KEY=YOUR_NEW_API_KEY_HERE
   ```
3. Save the file

### 4. Test Locally

1. Restart your dev server:
   ```bash
   npm run dev
   ```
2. Test that:
   - ✅ Login works
   - ✅ Data loads from Firestore
   - ✅ You can save workout logs
3. If everything works, proceed to next step

### 5. Update Production

1. Build your app:
   ```bash
   npm run build
   ```
2. Deploy to Firebase:
   ```bash
   npm run deploy
   ```
3. Test on your production URL (e.g., `https://oaks-snc.web.app`)

### 6. Delete the Old API Key (After Testing)

**Wait 24-48 hours** after deploying to ensure everything works, then:

1. Go back to [Google Cloud Console - APIs & Credentials](https://console.cloud.google.com/apis/credentials?project=oaks-snc)
2. Find the **old** API key (the one that was exposed)
3. Click on it → Click **"Delete"**
4. Confirm deletion

### 7. Clean Up Git History (Optional but Recommended)

If the old key was committed to git, you should remove it from history:

```bash
# This will rewrite git history - be careful!
# Make sure you have a backup first

# Option 1: Use git-filter-repo (recommended)
git filter-repo --replace-text <(echo "AIzaSyD7mPaCU8OVMGLJdPh7EcRSPgCepEszEWs==>REDACTED")

# Option 2: Use BFG Repo-Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
bfg --replace-text passwords.txt

# After cleaning, force push (WARNING: This rewrites history!)
git push --force --all
```

**⚠️ Warning**: Rewriting git history will require all collaborators to re-clone the repo.

---

## Quick Checklist

- [ ] Get new API key from Firebase/Google Cloud Console
- [ ] Restrict the API key (HTTP referrers + API restrictions)
- [ ] Update `.env` file with new key
- [ ] Test locally (`npm run dev`)
- [ ] Build and deploy (`npm run build && npm run deploy`)
- [ ] Test production site
- [ ] Wait 24-48 hours
- [ ] Delete old API key
- [ ] (Optional) Clean git history

---

## Need Help?

If something breaks after rotating:
1. Check browser console for errors
2. Verify API key restrictions allow your domain
3. Check Firestore rules are still working
4. You can temporarily revert by updating `.env` back to the old key

---

## Security Best Practices Going Forward

1. ✅ **Never commit `.env` files** (already in `.gitignore`)
2. ✅ **Use environment variables** (already set up)
3. ✅ **Restrict API keys** (do this now!)
4. ✅ **Keep Firestore rules strict** (you have good rules)
5. ✅ **Rotate keys periodically** (every 90 days is recommended)

