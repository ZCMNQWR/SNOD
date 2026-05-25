import React from 'react';
import { GOOGLE_CLIENT_ID, OAUTH_REDIRECT_URI } from '../config';

const SignInButton: React.FC = () => {
  const clientId = GOOGLE_CLIENT_ID;
  const redirectUri = OAUTH_REDIRECT_URI;

  const handleSignIn = () => {
    if (!clientId) return;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      access_type: 'offline',
      prompt: 'consent'
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = url;
  };

  return (
    <button
      onClick={handleSignIn}
      disabled={!clientId}
      title={clientId ? 'Sign in with Google' : 'Google OAuth not configured (set VITE_GOOGLE_CLIENT_ID)'}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid #5C5C5C',
        backgroundColor: clientId ? '#4285F4' : '#6b7280',
        color: '#fff',
        cursor: clientId ? 'pointer' : 'not-allowed',
        fontWeight: 600,
      }}
    >
      Sign in
    </button>
  );
};

export default SignInButton;
