import React from 'react';

const SignInButton: React.FC = () => {
  const handleSignIn = () => {
    // App-level listeners can open a login modal by listening for this event.
    window.dispatchEvent(new Event('open-login'));
  };

  return (
    <button
      onClick={handleSignIn}
      title={'Sign in'}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid #5C5C5C',
        backgroundColor: '#2563eb',
        color: '#fff',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      Sign in
    </button>
  );
};

export default SignInButton;
