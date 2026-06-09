# Login Page Implementation

## Overview

The application now starts with a dedicated login page that replaces the previous inline authentication flow. Users can either authenticate with their Jira account or continue as guests to explore the application with sample data.

## Architecture

### Components

1. **LoginPage.tsx** - The main UI component that displays the login options

   - Styled with modern gradient background and card layout
   - Uses Atlaskit components for consistent UI
   - Provides both Jira authentication and guest access options

2. **LoginPageWrapper.tsx** - React wrapper component that handles authentication logic

   - Manages loading states during authentication
   - Interfaces with existing Jira authentication helpers
   - Handles success/error states

3. **main-helper.js** - Modified to show login page first
   - Checks authentication status on app startup
   - Shows login page for unauthenticated users
   - Continues with existing app flow after authentication

## User Flows

### Jira Authentication Flow

1. User clicks "Connect to Jira" button
2. App initiates OAuth flow using existing Jira authentication
3. User is redirected to Atlassian for authentication
4. Upon successful authentication, user returns to main application
5. App loads with full Jira integration

### Guest Access Flow

1. User clicks "Continue as Guest" button
2. App sets guest mode flag
3. Application loads with sample data (bitovi-training examples)
4. User can explore all features using mock data

## Integration with Existing Systems

### Authentication

- Reuses existing `jira-oidc-helpers` for OAuth flow
- Maintains compatibility with existing token management
- Preserves all existing authentication state handling

### Data Loading

- Guest mode leverages existing `isLoggedIn` checks in data requests
- When `isLoggedIn` is false, sample data is automatically used
- No changes needed to existing data fetching logic

### Plugin Mode

- Plugin mode (Jira app context) bypasses login page automatically
- Maintains existing behavior for embedded Jira applications

## Configuration

### Environment Variables

No new environment variables are required. The login page uses existing Jira OAuth configuration.

### Feature Flags

- Guest mode is enabled by setting `routeData.isGuestMode = true`
- Login state is managed through existing `loginComponent.isLoggedIn` property

## Styling

The login page uses:

- Tailwind CSS for responsive layout
- Atlaskit components for buttons and messages
- Custom gradient background for modern appearance
- Bitovi branding and external links

## Testing

### Manual Testing

1. Visit the application at http://localhost:5173
2. Verify login page appears for unauthenticated users
3. Test both authentication paths:
   - Jira authentication (requires valid OAuth credentials)
   - Guest access (loads sample data immediately)

### Automated Testing

Test framework is configured but test dependencies need to be installed for full test coverage.

## Accessibility

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatible
- Focus management during state transitions

## Future Enhancements

1. **Enhanced Error Handling** - More detailed error messages for authentication failures
2. **Remember Choice** - Option to remember user preference for guest vs authenticated mode
3. **Onboarding** - Interactive tutorial for guest mode users
4. **Branding Customization** - Configurable branding for white-label deployments
