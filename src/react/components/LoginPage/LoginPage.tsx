import type { FC } from 'react';

import React, { useState } from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';

interface LoginPageProps {
  onJiraLogin: () => void;
  onGuestAccess: () => void;
  isLoginPending?: boolean;
}

const LoginPage: FC<LoginPageProps> = ({ onJiraLogin, onGuestAccess, isLoginPending = false }) => {
  const [selectedOption, setSelectedOption] = useState<'jira' | 'guest' | null>(null);

  const handleJiraLogin = () => {
    setSelectedOption('jira');
    onJiraLogin();
  };

  const handleGuestAccess = () => {
    setSelectedOption('guest');
    onGuestAccess();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <img src="./images/bitovi-logo.png" alt="Bitovi Logo" className="h-12 mx-auto mb-4" />
          <Heading size="large">Status Reports for Jira</Heading>
          <p className="text-slate-600 mt-2">
            Generate beautiful timeline reports and status updates from your Jira data
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <SectionMessage>
              <p>
                <strong>Connect to Jira:</strong> Access your real Jira projects and create comprehensive timeline
                reports.
              </p>
            </SectionMessage>

            <div className="w-full">
              <Button
                appearance="primary"
                onClick={handleJiraLogin}
                isLoading={isLoginPending && selectedOption === 'jira'}
                isDisabled={isLoginPending}
                testId="jira-login-button"
              >
                {isLoginPending && selectedOption === 'jira' ? 'Connecting to Jira...' : 'Connect to Jira'}
              </Button>
            </div>
          </div>

          <div className="flex items-center">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="px-3 text-slate-500 text-sm">or</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          <div className="space-y-4">
            <SectionMessage appearance="discovery">
              <p>
                <strong>Try as Guest:</strong> Explore the application with sample data to see how it works.
              </p>
            </SectionMessage>

            <div className="w-full">
              <Button
                appearance="subtle"
                onClick={handleGuestAccess}
                isLoading={isLoginPending && selectedOption === 'guest'}
                isDisabled={isLoginPending}
                testId="guest-access-button"
              >
                {isLoginPending && selectedOption === 'guest' ? 'Loading sample data...' : 'Continue as Guest'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          <p>
            By{' '}
            <a
              href="https://www.bitovi.com/services/agile-project-management-consulting"
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bitovi
            </a>
          </p>
          <p className="mt-1">
            <a
              href="https://github.com/bitovi/jira-timeline-report"
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
