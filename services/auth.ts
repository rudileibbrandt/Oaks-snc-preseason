import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// Get auth instance
export const getAuth = () => firebase.auth();

// Sign in with Google
export const signInWithGoogle = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  return firebase.auth().signInWithPopup(provider);
};

// Sign in with Microsoft
export const signInWithMicrosoft = async () => {
  const provider = new firebase.auth.OAuthProvider('microsoft.com');
  provider.addScope('email');
  provider.addScope('profile');
  return firebase.auth().signInWithPopup(provider);
};

// Sign in with Email/Password
export const signInWithEmail = async (email: string, password: string) => {
  return firebase.auth().signInWithEmailAndPassword(email, password);
};

// Sign up with Email/Password
export const signUpWithEmail = async (email: string, password: string) => {
  return firebase.auth().createUserWithEmailAndPassword(email, password);
};

// Sign out
export const signOut = async () => {
  return firebase.auth().signOut();
};

// Get current user
export const getCurrentUser = () => {
  return firebase.auth().currentUser;
};

// Listen to auth state changes
export const onAuthStateChanged = (callback: (user: firebase.User | null) => void) => {
  return firebase.auth().onAuthStateChanged(callback);
};

