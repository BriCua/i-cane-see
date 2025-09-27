import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [verificationSent, setVerificationSent] = useState(false);
  const { login, loginWithGoogle, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      window.location.reload();
    } catch (error) {
      setError('Invalid email or password.');
      return;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(email, password);
      setVerificationSent(true);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    // In Firebase, email verification is handled automatically
    // We'll check if email is verified on auth state change
    setError('Please check your email and click the verification link, then refresh this page.');
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleError('');
      await loginWithGoogle();
      window.location.reload();
    } catch (error) {
      setGoogleError('Google sign-in failed. Please try again.');
      return;
    }
  };

  return (
    <div id="main-content" className="py-24 px-6 flex flex-col items-center w-full min-h-screen relative">
      <BackButton className="absolute top-4 left-4" />
      <h1 className="text-center text-4xl font-bold mb-8">
        {mode === 'login' ? 'Login' : 'Register Account'}
      </h1>
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        {verificationSent ? (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Check Your Email</h2>
            <p className="text-gray-600">
              We've sent a verification link to <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            <fieldset className="space-y-6">
              <legend className="text-lg font-semibold mb-4">
                {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </legend>

              {error && (
                <div className="text-red-600 text-sm" role="alert">
                  {error}
                </div>
              )}

              {googleError && (
                <div className="text-red-600 text-sm" role="alert">
                  {googleError}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-base font-medium mb-2">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby="email-desc"
                />
                <p id="email-desc" className="text-sm text-gray-600 mt-1">Enter your email address</p>
              </div>

              <div>
                <label htmlFor="password" className="block text-base font-medium mb-2">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength="6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-describedby="password-desc"
                />
                <p id="password-desc" className="text-sm text-gray-600 mt-1">Enter a password (minimum 6 characters)</p>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
              >
                {mode === 'login' ? 'Login' : 'Register'}
              </button>

              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  className="mt-4 w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium flex items-center justify-center"
                  aria-describedby="google-desc"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
                <p className="text-sm text-gray-600 text-center mt-1">
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {mode === 'login' ? 'Register' : 'Login'}
                  </button>
                </p>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}