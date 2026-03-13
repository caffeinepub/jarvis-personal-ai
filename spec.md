# JARVIS Personal AI

## Current State
A full-stack Jarvis-inspired AI assistant with:
- Local smart response engine covering emotions, greetings, topics
- Browser-based multi-source search (SearXNG, Google News RSS, Wikipedia, DuckDuckGo)
- Natural male TTS voice with voice selection priority
- STT via Web Speech API
- Conversation history saved to backend
- Animated HUD-style UI with OKLCH cyan theme

## Requested Changes (Diff)

### Add
- **Emotion detection engine**: Analyze user message text to detect primary emotion (sad, depressed, lonely, stressed/anxious, angry, happy/excited, heartbroken, exhausted, fearful, neutral) with confidence scoring
- **Emotion-aware response adapter**: Dynamically shift JARVIS tone, vocabulary, and empathy level based on detected emotion — comforting when sad, energetic when happy, grounding when stressed, calm when angry
- **Conversation memory**: Track last 5 messages as context; use prior conversation topics to enrich search queries and responses (e.g. follow-up questions understand pronouns/context)
- **Emotional state indicator**: Subtle visual cue in the UI showing detected emotional state of the user (small badge/label near input or in header)
- **Richer search synthesis**: When search results come back, JARVIS synthesizes them into a natural-language answer in its own voice rather than reading raw snippets — adapting the answer warmth to the user's emotional state
- **Expanded local knowledge**: More topic categories — science, health, productivity, philosophy, current events intro, career/work stress support
- **Smart query enhancement**: Before searching, JARVIS refines the query using conversation context to get more relevant results

### Modify
- `generateLocalResponse`: Integrate emotion detection so every response is tonally adapted
- `browserSearch`: Synthesize results into a full natural-language paragraph rather than a list of snippets; add emotional warmth layer to output
- Search loading messages: Make them more natural and conversational
- Empty state prompt suggestions: Update to reflect emotional intelligence capabilities

### Remove
- Nothing to remove

## Implementation Plan
1. Add `detectEmotion(text)` function — returns `{ emotion, intensity }` object using keyword + pattern matching
2. Add `adaptTone(response, emotion, intensity)` — wraps or modifies a response string to match detected emotional state (adds empathy prefix for sad/stressed, excitement for happy, calm grounding for angry)
3. Add `buildContextualQuery(text, conversationHistory)` — extracts context from last 3 messages to enhance search queries
4. Add `synthesizeSearchResult(rawResult, query, emotion)` — converts search snippets into full natural paragraphs with JARVIS voice
5. Update `generateLocalResponse` to call `detectEmotion` and use `adaptTone`
6. Update `browserSearch` to call `synthesizeSearchResult` before returning
7. Update `handleSend` to pass conversation context to search functions
8. Add emotional state badge to the input area showing detected emotion with an appropriate icon
9. Expand local knowledge base with health, productivity, philosophy, and career/work categories
10. Update empty state suggestions to showcase emotional intelligence
