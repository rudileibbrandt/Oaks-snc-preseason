import React, { useState } from 'react';
import { signInWithGoogle, signInWithMicrosoft, signInWithEmail, signUpWithEmail } from '../services/auth';
import { Loader2, AlertCircle, Mail } from 'lucide-react';

interface Props {
  onLoginSuccess: () => void;
  onSignUpSuccess: () => void; // New callback for signup
}

const Login: React.FC<Props> = ({ onLoginSuccess, onSignUpSuccess }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (provider: 'google' | 'microsoft', signInFn: () => Promise<any>) => {
    setIsLoading(provider);
    setError(null);
    
    try {
      const result = await signInFn();
      console.log('Sign in successful:', result.user);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || `Failed to sign in with ${provider}`);
      setIsLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading('email');
    setError(null);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        // For signup, trigger registration flow
        onSignUpSuccess();
      } else {
        await signInWithEmail(email, password);
        // For signin, use normal login flow
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`);
      setIsLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] animate-fade-in">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-2">The Oaks</h1>
          <p className="text-neutral-400 text-sm">Performance Portal</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex items-start text-red-500 text-sm">
            <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleSignIn('google', signInWithGoogle)}
            disabled={isLoading !== null}
            className="w-full bg-white hover:bg-neutral-100 text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading === 'google' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <button
            onClick={() => handleSignIn('microsoft', signInWithMicrosoft)}
            disabled={isLoading !== null}
            className="w-full bg-[#0078D4] hover:bg-[#006CBE] text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading === 'microsoft' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23" fill="currentColor">
                  <path d="M0 0h10.5v10.5H0zM12.5 0H23v10.5H12.5zM0 12.5h10.5V23H0zM12.5 12.5H23V23H12.5z"/>
                </svg>
                Continue with Microsoft
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-neutral-950 px-2 text-neutral-500">Or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-neutral-400 text-sm mb-2 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              disabled={isLoading !== null}
              className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
              required
            />
          </div>

          <div>
            <label className="block text-neutral-400 text-sm mb-2 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading !== null}
              className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading !== null}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading === 'email' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Mail size={18} className="mr-2" />
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            disabled={isLoading !== null}
            className="w-full text-sm text-neutral-400 hover:text-neutral-300 underline disabled:opacity-50"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
