# JARVIS Personal AI

## Current State
JARVIS is a browser-based AI assistant with emotional intelligence, multi-source search (Wikipedia, DuckDuckGo, Google News RSS, Open Library), natural male TTS voice, STT input, and conversation context memory. No API key required.

## Requested Changes (Diff)

### Add
- Google News RSS search: pull live headlines/summaries from Google News for any topic
- Google Search snippets via public feeds or DuckDuckGo JSON fallback
- AI topic boost: dedicated search path for AI-related queries (ChatGPT, Gemini, ML, etc.) using Google News AI feed
- Parallel fetch: all sources queried simultaneously

### Modify
- Search engine: add Google News RSS and Google Search RSS as primary sources
- Search prioritization: Google News for news/current events, Wikipedia for factual, DuckDuckGo as fallback
- Response synthesis: incorporate Google News titles and snippets into JARVIS answers

### Remove
- Nothing; existing sources remain as fallbacks

## Implementation Plan
1. Add searchGoogleNews(query) using Google News RSS feed parsed via DOMParser
2. Add AI-topic detection boosting Google News AI feed for AI/ML queries
3. Update parallel search orchestrator to include new Google sources
4. Update answer synthesis to prefer Google News for news, Wikipedia for facts
5. Keep all existing sources as additional fallbacks
