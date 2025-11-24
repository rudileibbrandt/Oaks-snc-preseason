# OAuth Guide

This guide covers OAuth usage for both **GitHub authentication** (for git push) and **Firebase OAuth** (for your app).

---

## Part 1: Using OAuth for GitHub (Git Push)

### Option A: Use SSH Keys (Recommended - No OAuth needed)

SSH keys are easier and more secure than OAuth for git operations:

1. **Generate an SSH key** (if you don't have one):
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # Press Enter to accept default location
   # Optionally set a passphrase
   ```

2. **Add SSH key to GitHub**:
   ```bash
   # Copy your public key
   cat ~/.ssh/id_ed25519.pub
   # Or on older systems:
   cat ~/.ssh/id_rsa.pub
   ```
   
   Then:
   - Go to GitHub.com → Settings → SSH and GPG keys
   - Click "New SSH key"
   - Paste your public key
   - Save

3. **Update your git remote to use SSH**:
   ```bash
   git remote set-url origin git@github.com:rudileibbrandt/Oaks-snc-preseason.git
   ```

4. **Test the connection**:
   ```bash
   ssh -T git@github.com
   # Should say: "Hi rudileibbrandt! You've successfully authenticated..."
   ```

5. **Now you can push without authentication prompts**:
   ```bash
   git push
   ```

### Option B: Use Personal Access Token (OAuth-like)

1. **Create a Personal Access Token**:
   - Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Give it a name (e.g., "Oaks Project")
   - Select scopes: `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **Use the token when pushing**:
   ```bash
   git push
   # Username: rudileibbrandt
   # Password: [paste your token here]
   ```

3. **Or store it in credential helper** (so you don't enter it every time):
   ```bash
   # macOS
   git config --global credential.helper osxkeychain
   
   # Linux
   git config --global credential.helper cache
   
   # Windows
   git config --global credential.helper wincred
   ```

### Option C: Use GitHub CLI (OAuth flow)

1. **Install GitHub CLI**:
   ```bash
   # macOS
   brew install gh
   
   # Or download from: https://cli.github.com/
   ```

2. **Authenticate**:
   ```bash
   gh auth login
   # Follow the prompts - it will open a browser for OAuth
   ```

3. **Now git push works automatically**:
   ```bash
   git push
   ```

---

## Part 2: Firebase OAuth Setup (For Your App)

Your app uses Firebase Authentication with OAuth providers. Here's how to configure them:

### Google OAuth Setup

1. **In Firebase Console**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project (`oaks-snc`)
   - Go to Authentication → Sign-in method
   - Click on "Google"
   - Toggle "Enable"
   - Enter a support email
   - Click "Save"

2. **OAuth Consent Screen** (if needed):
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select your project
   - Go to APIs & Services → OAuth consent screen
   - Configure:
     - User Type: External (or Internal if using Google Workspace)
     - App name: "The Oaks Performance Portal"
     - Support email: Your email
     - Developer contact: Your email
   - Add scopes: `email`, `profile`
   - Add test users (if in testing mode)
   - Save

3. **Authorized Domains**:
   - In Firebase Console → Authentication → Settings → Authorized domains
   - Add your domains:
     - `localhost` (for development)
     - `oaks-snc.web.app` (Firebase hosting)
     - `oaks-snc.firebaseapp.com` (Firebase hosting)
     - Your custom domain (if any)

### Microsoft OAuth Setup

1. **Create Azure AD App Registration**:
   - Go to [Azure Portal](https://portal.azure.com)
   - Go to Azure Active Directory → App registrations
   - Click "New registration"
   - Name: "The Oaks Performance Portal"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: 
     - Type: Web
     - URI: `https://oaks-snc.firebaseapp.com/__/auth/handler`
   - Click "Register"

2. **Configure API Permissions**:
   - In your app registration → API permissions
   - Click "Add a permission" → Microsoft Graph → Delegated permissions
   - Add: `email`, `profile`, `openid`
   - Click "Add permissions"
   - Click "Grant admin consent" (if you're an admin)

3. **Get Client ID and Secret**:
   - In your app registration → Overview
   - Copy the "Application (client) ID"
   - Go to Certificates & secrets → New client secret
   - Copy the secret value (you won't see it again!)

4. **Add to Firebase**:
   - Go to Firebase Console → Authentication → Sign-in method
   - Click on "Microsoft"
   - Toggle "Enable"
   - Paste your Client ID and Client Secret
   - Click "Save"

5. **Authorized Domains** (same as Google):
   - Make sure your domains are in the authorized domains list

### Testing OAuth in Your App

1. **Local Development**:
   ```bash
   npm run dev
   # Visit http://localhost:5173
   # Try signing in with Google/Microsoft
   ```

2. **Production**:
   - Deploy to Firebase Hosting
   - Visit your hosted URL
   - Test OAuth sign-in

### Troubleshooting OAuth

**"Redirect URI mismatch"**:
- Make sure the redirect URI in Azure/Google matches exactly
- For Firebase, use: `https://YOUR-PROJECT.firebaseapp.com/__/auth/handler`

**"OAuth consent screen not configured"**:
- Complete the OAuth consent screen setup in Google Cloud Console
- Add test users if in testing mode

**"Invalid client"**:
- Check that Client ID and Secret are correct
- Make sure the app is enabled in Firebase

**"Domain not authorized"**:
- Add your domain to Firebase authorized domains
- Wait a few minutes for changes to propagate

---

## Part 3: How OAuth Works in Your App

### Code Flow

1. **User clicks "Continue with Google"**:
   ```typescript
   // In Login.tsx
   onClick={() => handleSignIn('google', signInWithGoogle)}
   ```

2. **Firebase opens OAuth popup**:
   ```typescript
   // In services/auth.ts
   export const signInWithGoogle = async () => {
     const provider = new firebase.auth.GoogleAuthProvider();
     provider.addScope('email');
     provider.addScope('profile');
     return firebase.auth().signInWithPopup(provider);
   };
   ```

3. **User authenticates with Google/Microsoft**:
   - Popup opens
   - User signs in
   - User grants permissions

4. **Firebase receives OAuth token**:
   - Firebase exchanges the OAuth token for a Firebase auth token
   - User is signed in to Firebase

5. **App receives user info**:
   ```typescript
   // In App.tsx
   onAuthStateChanged((user) => {
     if (user) {
       // User is signed in
       // Get user profile, create player record, etc.
     }
   });
   ```

### What Data You Get

After OAuth sign-in, you can access:
- `user.email` - User's email address
- `user.displayName` - User's full name
- `user.photoURL` - User's profile picture
- `user.uid` - Unique Firebase user ID

---

## Quick Reference

### For Git Push (Choose One):
- ✅ **SSH Keys** (easiest, most secure)
- ✅ **Personal Access Token** (works immediately)
- ✅ **GitHub CLI** (OAuth flow, user-friendly)

### For Firebase OAuth:
- ✅ **Google**: Enable in Firebase, configure OAuth consent screen
- ✅ **Microsoft**: Create Azure AD app, add Client ID/Secret to Firebase
- ✅ **Email/Password**: Just enable in Firebase (no OAuth needed)

---

## Need Help?

- **GitHub Authentication**: [GitHub Docs](https://docs.github.com/en/authentication)
- **Firebase Auth**: [Firebase Docs](https://firebase.google.com/docs/auth)
- **Google OAuth**: [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
- **Microsoft OAuth**: [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)

