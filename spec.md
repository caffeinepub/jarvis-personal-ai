# JARVIS Personal AI

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- A personal AI assistant MVP with a Jarvis-like interface
- Conversational chat UI with message history
- Backend stores all conversations and messages
- Smart rule-based/pattern-matched responses covering: greetings, time/date, weather (static), tasks, jokes, identity, general knowledge snippets
- Voice-inspired UI: dark futuristic aesthetic, animated elements

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Backend: `addMessage(text)` -> returns AI response, stores conversation; `getMessages()` -> returns full history; `clearHistory()` -> wipes conversation
2. AI response engine in Motoko: pattern-match on user input, return contextual Jarvis-style responses
3. Frontend: full-screen chat interface, animated HUD-style UI, message bubbles, input bar, clear history button
