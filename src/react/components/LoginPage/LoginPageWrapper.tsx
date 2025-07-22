import type { FC } from 'react';

import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage';

interface JiraHelpers {
  hasValidAccessToken: () => boolean;
  getAccessToken: () => Promise<any>;
}

interface LoginPageWrapperProps {
  jiraHelpers: JiraHelpers;
  onLoginSuccess: () => void;
  onGuestAccess: () => void;
}

const LoginPageWrapper: FC<LoginPageWrapperProps> = ({ jiraHelpers, onLoginSuccess, onGuestAccess }) => {
  const [isLoginPending, setIsLoginPending] = useState(false);

  // Check if user is already logged in on mount
  useEffect(() => {
    if (jiraHelpers.hasValidAccessToken()) {
      onLoginSuccess();
    }
  }, [jiraHelpers, onLoginSuccess]);

  const handleJiraLogin = async () => {
    setIsLoginPending(true);
    try {
      await jiraHelpers.getAccessToken();
      onLoginSuccess();
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoginPending(false);
    }
  };

  const handleGuestAccess = () => {
    setIsLoginPending(true);
    // Add a small delay to show loading state for guest mode
    setTimeout(() => {
      onGuestAccess();
    }, 500);
  };

  return <LoginPage onJiraLogin={handleJiraLogin} onGuestAccess={handleGuestAccess} isLoginPending={isLoginPending} />;
};

export default LoginPageWrapper;
