import type { FC } from 'react';

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import LoginPageWrapper from './LoginPage/LoginPageWrapper';

interface AppInitializerProps {
  jiraHelpers: any;
  isAlwaysLoggedIn: boolean;
  onLoginSuccess: () => void;
  mainContentElement: HTMLElement;
}

const AppInitializer: FC<AppInitializerProps> = ({
  jiraHelpers,
  isAlwaysLoggedIn,
  onLoginSuccess,
  mainContentElement,
}) => {
  const [showLoginPage, setShowLoginPage] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);

  useEffect(() => {
    // If always logged in (plugin mode), skip login page
    if (isAlwaysLoggedIn) {
      setShowLoginPage(false);
      onLoginSuccess();
      return;
    }

    // Check if user has existing valid token
    if (jiraHelpers.hasValidAccessToken()) {
      setShowLoginPage(false);
      onLoginSuccess();
      return;
    }

    // Show login page
    setShowLoginPage(true);
  }, [jiraHelpers, isAlwaysLoggedIn, onLoginSuccess]);

  const handleLoginSuccess = () => {
    setShowLoginPage(false);
    setIsGuestMode(false);
    onLoginSuccess();
  };

  const handleGuestAccess = () => {
    setShowLoginPage(false);
    setIsGuestMode(true);
    // Set up guest mode - don't authenticate but continue with the app
    onLoginSuccess();
  };

  if (!showLoginPage) {
    return null; // The main app will be rendered by the main helper
  }

  return (
    <LoginPageWrapper jiraHelpers={jiraHelpers} onLoginSuccess={handleLoginSuccess} onGuestAccess={handleGuestAccess} />
  );
};

export const initializeApp = (config: any, options: any) => {
  const mainContent = document.getElementById('mainContent');
  if (!mainContent) {
    console.error('Could not find mainContent element');
    return;
  }

  // Create a container for the app initializer
  const appInitializerContainer = document.createElement('div');
  appInitializerContainer.id = 'app-initializer';
  appInitializerContainer.className = 'w-full h-full';

  // Replace the existing content with our initializer
  mainContent.innerHTML = '';
  mainContent.appendChild(appInitializerContainer);

  const root = createRoot(appInitializerContainer);

  return new Promise((resolve) => {
    root.render(
      <AppInitializer
        jiraHelpers={config.jiraHelpers}
        isAlwaysLoggedIn={options.isAlwaysLoggedIn}
        onLoginSuccess={() => {
          // Remove the login page and restore the original structure
          appInitializerContainer.remove();

          // Restore original main content structure
          mainContent.innerHTML = `
            <div class="color-bg-white px-4 top-0 z-50 border-b border-neutral-301">
              <nav class="mx-auto py-2 place-center">
                <div class="flex gap-4" style="align-items: center">
                  <ul class="flex gap-3 grow items-baseline">
                    <li>
                      <a
                        href="https://github.com/bitovi/jira-timeline-report"
                        class="color-gray-900 font-3xl underline-on-hover bitovi-font-poppins font-bold"
                      >
                        Status Reports for Jira
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://www.bitovi.com/services/agile-project-management-consulting"
                        class="bitovi-poppins color-text-bitovi-red-orange"
                        style="line-height: 37px; font-size: 14px; text-decoration: none"
                      >
                        by <img src="./images/bitovi-logo.png" class="inline align-baseline" />
                      </a>
                    </li>
                  </ul>
                  <select-cloud></select-cloud>
                  <div id="login"></div>
                </div>
              </nav>
            </div>
            <div id="loadingJira" class="place-center" style="display: none;">
              <p class="my-2">Loading the Jira Timeline Report ...</p>
            </div>
          `;

          resolve(undefined);
        }}
        mainContentElement={mainContent}
      />,
    );
  });
};

export default AppInitializer;
