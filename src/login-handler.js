/**
 * Handles the login page functionality
 */

export function initializeLoginScreen(jiraHelpers, onLoginSuccess) {
  const loginScreen = document.getElementById('loginScreen');
  const mainContent = document.getElementById('mainContent');
  const connectToJiraBtn = document.getElementById('connectToJiraBtn');
  const continueAsGuestBtn = document.getElementById('continueAsGuestBtn');

  // Show login screen initially
  loginScreen.style.display = 'flex';
  mainContent.style.display = 'none';

  // Handle Connect to Jira button
  connectToJiraBtn.addEventListener('click', async () => {
    try {
      // Show loading state
      connectToJiraBtn.disabled = true;
      connectToJiraBtn.textContent = 'Connecting...';
      connectToJiraBtn.classList.add('opacity-50');

      // Get access token (this will redirect to Jira OAuth)
      await jiraHelpers.getAccessToken();

      // Hide login screen and show main app
      loginScreen.style.display = 'none';
      mainContent.style.display = 'flex';

      // Call success callback with authenticated state
      onLoginSuccess(true);
    } catch (error) {
      console.error('Failed to connect to Jira:', error);

      // Reset button state
      connectToJiraBtn.disabled = false;
      connectToJiraBtn.textContent = 'Connect to Jira';
      connectToJiraBtn.classList.remove('opacity-50');

      // Show error message
      showErrorMessage('Failed to connect to Jira. Please try again.');
    }
  });

  // Handle Continue as Guest button
  continueAsGuestBtn.addEventListener('click', () => {
    // Hide login screen and show main app
    loginScreen.style.display = 'none';
    mainContent.style.display = 'flex';

    // Call success callback with guest state
    onLoginSuccess(false);
  });

  // Check if user is already logged in
  if (jiraHelpers.hasValidAccessToken()) {
    // User is already authenticated, proceed to main app
    loginScreen.style.display = 'none';
    mainContent.style.display = 'flex';
    onLoginSuccess(true);
  }
}

function showErrorMessage(message) {
  // Remove any existing error message
  const existingError = document.getElementById('loginError');
  if (existingError) {
    existingError.remove();
  }

  // Create and show error message
  const errorDiv = document.createElement('div');
  errorDiv.id = 'loginError';
  errorDiv.className = 'mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm';
  errorDiv.textContent = message;

  // Insert error message before the buttons
  const connectToJiraBtn = document.getElementById('connectToJiraBtn');
  connectToJiraBtn.parentNode.insertBefore(errorDiv, connectToJiraBtn);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}
