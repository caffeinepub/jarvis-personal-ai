# JARVIS Personal AI

## Current State
JARVIS is a personal AI assistant with rule-based responses covering 20+ topics and emotional intelligence. It supports text and voice interaction. The backend handles all response generation locally in Motoko with keyword matching.

## Requested Changes (Diff)

### Add
- SearchAPI.io HTTP outcall integration: when a query doesn't match any built-in rule, JARVIS calls SearchAPI with the user's message and returns a summary of the top search result snippet as its answer.

### Modify
- `sendMessage` backend function: make it `async*` and fall through to SearchAPI when the built-in `generateResponse` returns the default fallback message.
- The search query will use `https://www.searchapi.io/api/v1/search?engine=google&q=<query>&api_key=8xDr7MLMfQ8aMqq7yNrQzbJx`
- Parse the JSON response and extract the first organic result snippet.

### Remove
- Nothing removed.

## Implementation Plan
1. Update `main.mo` to use IC management canister HTTP outcalls to call SearchAPI for unknown queries.
2. Parse the JSON response for the `organic_results[0].snippet` field.
3. Return a formatted answer combining the snippet with JARVIS personality.
