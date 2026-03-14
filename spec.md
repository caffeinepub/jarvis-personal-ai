# JARVIS Personal AI

## Current State
The app has a working Motoko backend that handles conversation history, message routing, and signals the frontend to perform browser-based web searches. The frontend is a JARVIS AI chat interface with voice, emotional intelligence, and multi-source search.

## Requested Changes (Diff)

### Add
- Backend: Stable storage for API keys (OpenAI key, Google key, and an optional label/value generic slot)
- Backend: Admin password storage (hashed check) with set/verify functions
- Backend: `setAdminPassword(pwd)`, `verifyAdminPassword(pwd) -> Bool`, `setApiKey(name, value)`, `getApiKey(name) -> ?Text` functions
- Frontend: Admin panel page (route `/admin`) accessible via a small gear icon in the main UI
- Frontend: Password gate -- if no password set, prompt to create one; otherwise prompt to enter it
- Frontend: Once authenticated, show API key management form with fields for OpenAI API Key and Google API Key (custom label+value pairs)
- Frontend: Save/update keys via backend calls; show masked values for existing keys
- Frontend: Session-based auth state (stays logged in for the session, not persisted)

### Modify
- Backend: Add new stable vars for admin password hash and api key map without breaking existing stable vars
- Frontend: Add a small admin settings button/link to the main JARVIS UI

### Remove
- Nothing removed

## Implementation Plan
1. Update Motoko backend to add stable vars: `adminPasswordHash: Text`, `apiKeys: [(Text, Text)]`
2. Add backend functions: `setAdminPassword`, `verifyAdminPassword`, `setApiKey`, `getApiKey`, `listApiKeyNames`
3. Regenerate backend bindings
4. Build AdminPanel React component with password gate and key management form
5. Add route and nav link to admin panel from main UI
