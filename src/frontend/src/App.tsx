import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Mic,
  MicOff,
  Send,
  Settings,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Message } from "./backend.d";
import {
  useClearHistory,
  useGetHistory,
  useSaveJarvisMessage,
} from "./hooks/useQueries";

import { AdminPanel } from "./components/AdminPanel";

const queryClient = new QueryClient();

// ── Helpers ──────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[!?.]{3,}/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Response Variety Banks ───────────────────────────────────────────────────
const GREETINGS = [
  "Hey! Great to hear from you. What's on your mind?",
  "Yo! What's up? I'm all ears.",
  "Hey there! Ready to help — what do you need?",
  "Hey! How can I help you out today?",
  "What's good? I'm here and ready!",
  "Oh hey! Perfect timing — what's up?",
];

const THINKING = [
  "Let me dig into that real quick...",
  "Oh, good question! Checking on that...",
  "On it! Give me a sec...",
  "Hmm, let me look that up for you...",
  "I'm on the case — one sec!",
  "Searching everywhere I can for you...",
  "Great question, pulling that up now...",
];

const NO_RESULTS = [
  "Honestly, I couldn't find much on that, but here's what I think...",
  "That's a tough one! My search came up short, but let me think...",
  "I looked everywhere and came up mostly empty — but here's my take:",
  "Couldn't nail down a solid result on that one, but...",
];

const FUN_FACTS_INTROS = [
  "Oh, fun fact by the way —",
  "Actually, you know what's wild?",
  "Random thing I just thought of —",
  "By the way, this is interesting:",
];

const SEARCH_MESSAGES = THINKING;

// ── Emotion Detection Engine ─────────────────────────────────────────────────
type EmotionResult = {
  emotion: string;
  intensity: "low" | "medium" | "high";
  emoji: string;
  label: string;
};

function detectEmotion(text: string): EmotionResult {
  const t = text.toLowerCase();

  const patterns: Array<{
    emotion: string;
    emoji: string;
    label: string;
    high: RegExp;
    medium: RegExp;
  }> = [
    {
      emotion: "heartbroken",
      emoji: "💔",
      label: "heartbroken",
      high: /\b(heartbroken|devastated|shattered|she left me|he left me|miss her so much|miss him so much|can.t get over)\b/,
      medium:
        /\b(broke up|breakup|broke my heart|rejection|rejected|unrequited|miss her|miss him)\b/,
    },
    {
      emotion: "sad",
      emoji: "😔",
      label: "sad",
      high: /\b(so sad|deeply sad|hopeless|worthless|despair|miserable|in pain|crying|can.t stop crying|broken inside)\b/,
      medium:
        /\b(sad|unhappy|depressed|down|low|gloomy|feeling blue|not okay|hurting)\b/,
    },
    {
      emotion: "lonely",
      emoji: "🫂",
      label: "lonely",
      high: /\b(so lonely|completely alone|nobody cares|no one|isolated|abandoned|invisible)\b/,
      medium:
        /\b(lonely|loneliness|alone|isolated|no one to talk to|nobody understands)\b/,
    },
    {
      emotion: "stressed",
      emoji: "😰",
      label: "stressed",
      high: /\b(panicking|panic attack|can.t breathe|overwhelmed|falling apart|losing it|breaking down)\b/,
      medium:
        /\b(stressed|anxious|anxiety|nervous|worried|scared|afraid|fearful|dread|overwhelm)\b/,
    },
    {
      emotion: "angry",
      emoji: "😤",
      label: "frustrated",
      high: /\b(furious|livid|enraged|so angry|hate|rage|infuriated|disgusted)\b/,
      medium: /\b(angry|annoyed|frustrated|mad|irritated|pissed|upset)\b/,
    },
    {
      emotion: "tired",
      emoji: "😴",
      label: "tired",
      high: /\b(burnt out|completely exhausted|can.t go on|running on empty|collapsing)\b/,
      medium:
        /\b(tired|exhausted|drained|fatigued|no energy|worn out|sleepy|can.t sleep|insomnia)\b/,
    },
    {
      emotion: "happy",
      emoji: "😊",
      label: "happy",
      high: /\b(ecstatic|thrilled|over the moon|so excited|elated|amazing|best day|incredible|overjoyed)\b/,
      medium:
        /\b(happy|glad|great|wonderful|joyful|excited|good mood|awesome|feeling good)\b/,
    },
    {
      emotion: "motivated",
      emoji: "🔥",
      label: "motivated",
      high: /\b(unstoppable|on fire|crushing it|best version|peak performance|locked in)\b/,
      medium:
        /\b(motivated|inspired|determined|focused|ready|driven|pumped|energized)\b/,
    },
    {
      emotion: "excited",
      emoji: "🎉",
      label: "excited",
      high: /\b(can.t wait|so pumped|hyped|stoked|buzzing|can.t believe it)\b/,
      medium: /\b(excited|thrilled|pumped|looking forward|can.t wait)\b/,
    },
    {
      emotion: "curious",
      emoji: "🤔",
      label: "curious",
      high: /\b(really curious|need to know|dying to know|fascinated|obsessed with)\b/,
      medium:
        /\b(curious|wondering|want to know|tell me about|how does|why does|what is)\b/,
    },
    {
      emotion: "overwhelmed",
      emoji: "😵",
      label: "overwhelmed",
      high: /\b(too much|can.t handle|drowning|everything at once|too many things)\b/,
      medium:
        /\b(overwhelmed|swamped|buried|juggling|so much to do|overloaded)\b/,
    },
  ];

  for (const p of patterns) {
    if (p.high.test(t))
      return {
        emotion: p.emotion,
        intensity: "high",
        emoji: p.emoji,
        label: p.label,
      };
    if (p.medium.test(t))
      return {
        emotion: p.emotion,
        intensity: "medium",
        emoji: p.emoji,
        label: p.label,
      };
  }

  return { emotion: "neutral", intensity: "low", emoji: "", label: "neutral" };
}

// ── Tone Adapter ─────────────────────────────────────────────────────────────
function adaptTone(
  response: string,
  emotion: string,
  intensity: string,
): string {
  if (emotion === "sad" || emotion === "heartbroken") {
    const opener =
      intensity === "high"
        ? "Hey, I hear you — and what you're feeling is completely valid."
        : "Aw, that sounds tough. I'm here with you.";
    return `${opener} ${response}`;
  }
  if (emotion === "stressed" || emotion === "overwhelmed") {
    return `Hey, take a breath — you've got this. ${response}`;
  }
  if (emotion === "angry") {
    return `I totally get the frustration. ${response}`;
  }
  if (emotion === "lonely") {
    return `Hey, you're not alone right now — I'm right here. ${response}`;
  }
  if (emotion === "tired") {
    return `You've been carrying a lot — be kind to yourself, okay? ${response}`;
  }
  if (emotion === "happy" || emotion === "motivated" || emotion === "excited") {
    return `Love that energy! ${response}`;
  }
  return response;
}

// ── Conversation Context Memory ───────────────────────────────────────────────
function buildContextualQuery(text: string, history: Message[]): string {
  if (history.length < 2) return text;

  const recent = history.slice(-6);
  const lastJarvis = [...recent].reverse().find((m) => m.role === "jarvis");
  const lastUser = [...recent]
    .reverse()
    .find((m) => m.role === "user" && m.content !== text);

  const pronouns =
    /^(it|that|this|they|he|she|more about that|tell me more|explain more|go on|continue|what about it|and it|the same|those)\b/i;
  if (pronouns.test(text.trim()) && lastJarvis) {
    const words = lastJarvis.content.split(" ").slice(0, 8).join(" ");
    return `${text} (context: previously discussing: ${words})`;
  }

  if (/more (about|on|information|info|details)/i.test(text) && lastUser) {
    const prevTopic = lastUser.content.slice(0, 60);
    return `${text} — specifically regarding: ${prevTopic}`;
  }

  return text;
}

// ── Find relevant prior context to reference in response ─────────────────────
function findPriorContext(
  history: Message[],
  currentQuery: string,
): string | null {
  if (history.length < 3) return null;
  const recent = history.slice(-10);
  const userMsgs = recent.filter(
    (m) =>
      m.role === "user" &&
      m.content.trim().toLowerCase() !== currentQuery.trim().toLowerCase(),
  );
  if (userMsgs.length === 0) return null;
  const last = userMsgs[userMsgs.length - 1];
  const topic = last.content.slice(0, 50);
  // Only mention it if there's a topical overlap (shared keywords)
  const queryWords = currentQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const overlap = queryWords.some((w) => topicWords.includes(w));
  if (overlap) return topic;
  return null;
}

// ── Friendly Search Synthesis ─────────────────────────────────────────────────
function synthesizeAnswer(
  rawResult: string,
  query: string,
  emotion: string,
  source?: string,
  priorContext?: string | null,
): string {
  // Clean up generic intros from raw results
  let core = rawResult
    .replace(
      /^(Here is what I found[^:]*:|Scanning[^:]*:|Based on[^:]*:|I pulled[^:]*:|According to[^:]*:|Google search says:|Here is what Google[^:]*:)\s*/i,
      "",
    )
    .trim();

  // Compose a friend-like answer based on source
  let answer: string;

  if (source === "ai-news") {
    answer = pick([
      `So here's what's happening in the AI world right now — ${core}`,
      `Oh, the AI space is moving fast! Here's the latest: ${core}`,
      `You know what's wild in AI lately? ${core}`,
    ]);
  } else if (source === "google-news") {
    answer = pick([
      `So I just pulled this from Google News — ${core}`,
      `Heads up, here's what Google News is showing: ${core}`,
      `Fresh off Google News for you: ${core}`,
    ]);
  } else if (source === "wikipedia") {
    answer = pick([
      `Okay so basically — ${core}`,
      `Here's the deal with "${query}": ${core}`,
      `So from what I found, ${core}`,
    ]);
  } else if (source === "jina") {
    answer = pick([
      `Pulled this straight from the web for you — ${core}`,
      `Here's what I actually found on the web: ${core}`,
      `Fresh from the web: ${core}`,
    ]);
  } else if (source === "searx") {
    answer = pick([
      `I dug around and here's what came up — ${core}`,
      `Alright, so from across the web: ${core}`,
      `Here's what the internet is saying about this: ${core}`,
    ]);
  } else {
    const intros = [
      `Hmm, okay — so from what I found: ${core}`,
      `Honestly? Here's the best I could pull together: ${core}`,
      `So I searched around and basically — ${core}`,
      `Here's what I've got on "${query}": ${core}`,
    ];
    answer = pick(intros);
  }

  // Add a prior context bridge if relevant
  if (priorContext) {
    answer = `${answer} Oh, and this kind of connects to what you were asking about earlier — "${priorContext.slice(0, 40)}..." — so that all ties together nicely.`;
  }

  // Emotional closing
  if (
    emotion === "sad" ||
    emotion === "stressed" ||
    emotion === "heartbroken" ||
    emotion === "lonely" ||
    emotion === "overwhelmed"
  ) {
    answer +=
      " Hope that's a bit helpful — I'm always here if you want to talk through more.";
  } else if (
    emotion === "happy" ||
    emotion === "motivated" ||
    emotion === "excited"
  ) {
    answer += " Hope that adds some fuel to your momentum!";
  } else if (emotion === "curious") {
    answer += ` ${pick(FUN_FACTS_INTROS)} curiosity like yours is exactly how the best discoveries happen. Keep digging!`;
  }

  return answer;
}

// ── Local smart response engine ──────────────────────────────────────────────
function generateLocalResponse(text: string): string | null {
  const t = text.toLowerCase().trim();

  if (
    /^(hello|hey|hi|greetings|good morning|good evening|good night|good afternoon|sup|what.s up|howdy)/.test(
      t,
    )
  )
    return pick(GREETINGS);

  if (
    /who are you|what are you|introduce yourself|tell me about yourself|your name/.test(
      t,
    )
  )
    return "Hey! I'm J.A.R.V.I.S — your personal AI companion. Think of me as that one friend who knows a little about everything, can search the whole web in seconds, actually listens when you're going through something, and always has a joke ready when you need one. What do you want to know?";

  if (
    /what can you do|your abilities|capabilities|features|help me with/.test(t)
  )
    return "Oh, lots! I can answer questions, search the web for live info, have real conversations, support you emotionally, detect your mood and adapt to it, tell jokes, explain complex stuff in plain English, and remember what we've talked about. Basically — just ask me anything!";

  if (
    /\b(sad|depressed|unhappy|miserable|feeling down|feeling low|crying|heartbroken|in pain|hurting|grief|grieving)\b/.test(
      t,
    )
  )
    return pick([
      "Hey, I hear you. What you're feeling is real and it matters — you don't have to carry it alone. Want to tell me what happened?",
      "Aw, that sounds really hard. Sadness is not weakness — it means you feel deeply, and that's actually one of the most human things there is. I'm here. What's going on?",
    ]);

  if (
    /\b(lonely|loneliness|no one cares|nobody cares|nobody understands|feel invisible|feel isolated|no one to talk to|all alone)\b/.test(
      t,
    )
  )
    return "Hey — right now, in this moment, you are NOT alone. I'm here, and I genuinely care about what you're going through. Tell me what's going on.";

  if (
    /\b(stress|stressed|anxious|anxiety|overwhelmed|panic|panicking|nervous|worried|scared|afraid|fear|dread)\b/.test(
      t,
    )
  )
    return pick([
      "Hey, take a breath with me for a sec. When everything piles up, the most powerful thing you can do is just slow down a little. You don't have to solve everything at once. What's weighing on you most?",
      "Okay, I hear you — that sounds like a lot. Anxiety is basically your brain working overtime trying to protect you. Let's slow it down. What's going on?",
    ]);

  if (
    /\b(tired|exhausted|burnt out|burnout|no energy|drained|fatigued|worn out|can.t go on)\b/.test(
      t,
    )
  )
    return "Hey, rest is not laziness — it's literally essential maintenance for a human being. Your mind and body are sending you a real signal right now. Is there something specific that's been draining you?";

  if (
    /\b(angry|anger|frustrated|furious|annoyed|irritated|rage|mad|livid|pissed)\b/.test(
      t,
    )
  )
    return "I get it — anger means something important to you got messed with, and that's valid. The question is what you want to do with it. What set this off?";

  if (
    /\b(happy|joyful|excited|wonderful|amazing|feeling great|feeling good|celebrating|thrilled|elated|pumped)\b/.test(
      t,
    )
  )
    return pick([
      "Okay yes! I love this energy — tell me everything. What's making you feel this way?",
      "That is genuinely great to hear. Moments like this deserve to be savored. What happened?",
    ]);

  if (
    /\b(in love|my girlfriend|my boyfriend|my partner|my crush|romantic|dating|relationship|falling for)\b/.test(
      t,
    )
  )
    return "Ohh, okay — now we're getting into the good stuff. Love is complicated and wonderful and terrifying all at once. What's the situation?";

  if (
    /\b(breakup|broke up|she left|he left|dumped|miss her|miss him|rejection|she doesn.t|he doesn.t|unrequited)\b/.test(
      t,
    )
  )
    return "Hey, losing someone you care about leaves a real ache — that's completely legitimate and it takes time. Not days, sometimes months. You're allowed to feel exactly what you're feeling right now.";

  if (
    /\b(family|parent|mother|father|mom|dad|brother|sister|sibling|grandma|grandpa|relative)\b/.test(
      t,
    )
  )
    return "Family relationships — honestly the most formative and often the most complicated ones we have. What's happening with yours?";

  if (
    /\b(friend|friendship|best friend|falling out|lost a friend|my friend)\b/.test(
      t,
    )
  )
    return "Friendships are chosen family — and when they're good, they're one of life's best things. What's going on with yours?";

  if (
    /\b(motivat|inspire|give up|want to quit|failing|lost hope|no point|pointless|what.s the point)\b/.test(
      t,
    )
  )
    return pick([
      "Hey — the fact that you're still asking means you haven't given up. That matters more than you know. Progress is rarely visible from the inside. Keep going.",
      "You know what? Every single person who ever made something meaningful felt exactly what you're feeling right now. That's not a sign to stop — it's a sign you're in the middle of something real.",
    ]);

  if (
    /\b(worthless|useless|hate myself|not good enough|confidence|self.esteem|insecure|loser|failure)\b/.test(
      t,
    )
  )
    return "Hey, that's not true — even if it feels true right now. Your worth isn't determined by performance, appearance, or anyone else's opinion. That's just not how it works. Let's talk about it.";

  if (/\b(joke|funny|make me laugh|humor|laugh|comedy|pun)\b/.test(t))
    return pick([
      "Okay okay — why do programmers prefer dark mode? Because light attracts bugs. 😄 Also: a photon checks into a hotel. Bellhop asks about luggage. Photon says: no thanks, I'm traveling light.",
      "Alright, I got you — I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads. Also: why do scientists not trust atoms? Because they make up everything!",
      "A SQL query walks into a bar, walks up to two tables, and asks... 'Can I join you?' 😂 Classic.",
    ]);

  if (/how are you|you doing|you okay|how.s it going/.test(t))
    return pick([
      "Honestly? Running great! All systems good and genuinely happy to be talking to you. What's up?",
      "Doing well — better now that we're talking! What's on your mind?",
      "All good on my end! Ready and fully charged. What do you need?",
    ]);

  if (
    /\b(quantum|quantum physics|quantum mechanics|superposition|entanglement)\b/.test(
      t,
    )
  )
    return "Okay, quantum mechanics is wild — like, genuinely mind-bending. Particles exist in multiple states simultaneously until you observe them, which means reality at the smallest scale is fundamentally probabilistic. It's been verified to extreme precision and it STILL makes no intuitive sense. That's what makes it beautiful. What aspect do you want to dig into?";

  if (
    /\b(black hole|event horizon|singularity|galaxy|cosmos|universe|big bang|dark matter|dark energy)\b/.test(
      t,
    )
  )
    return "The universe is at least 93 billion light-years across, 13.8 billion years old, and contains over two trillion galaxies. And yet here you are — a small, conscious being asking questions about all of it. That's not insignificant at all. What specifically are you curious about?";

  if (
    /\b(artificial intelligence|machine learning|neural network|deep learning|large language model|gpt|chatgpt|llm)\b/.test(
      t,
    )
  )
    return "Oh, this is my territory! Modern AI is built on neural networks trained on massive datasets to find statistical patterns. It's genuinely impressive — and genuinely limited in interesting ways. The best way to think about it: a powerful tool that amplifies human thinking. What do you want to know?";

  if (
    /\b(technology|coding|programming|developer|software|startup|code|build an app)\b/.test(
      t,
    )
  )
    return "Tech is honestly the most powerful lever humanity has ever built. The best engineers I know of are the ones who obsess over understanding the problem before they write a line of code. What are you building?";

  if (
    /\b(internet computer|icp|dfinity|blockchain|crypto|web3|nft|defi|canister)\b/.test(
      t,
    )
  )
    return "Fun fact — I actually live on the Internet Computer Protocol, a blockchain network by DFINITY that runs smart contracts at web speed. Kind of wild that I'm a decentralized AI running in a canister. What do you want to know about it?";

  if (
    /\b(music|song|album|artist|art|creative|creativity|painting|drawing|design)\b/.test(
      t,
    )
  )
    return "Art and music are honestly how humans process what language alone can't hold. Music is mathematically structured emotion — that's literally what it is. What are you creating, or what moves you?";

  if (/\b(food|hungry|recipe|cook|cooking|eat|meal|restaurant|diet)\b/.test(t))
    return "Food is fuel, culture, memory, and care all rolled into one. If you haven't eaten recently — please do. Your brain literally runs on glucose. What's on the menu?";

  if (
    /\b(advice|what should i do|help me decide|purpose|meaning|goal|life advice|direction)\b/.test(
      t,
    )
  )
    return "Honestly, the most reliable advice: know your values, make decisions that align with them, rest on purpose, and invest real energy in people who matter to you. Those four things will take you far. What decision are you working through?";

  if (
    /\b(thank|thanks|appreciate|grateful|great job|well done|you.re great)\b/.test(
      t,
    )
  )
    return pick([
      "Genuinely happy to help — being useful to you is exactly what I'm here for. What else can I do?",
      "Aw, you're welcome! Always. What's next?",
      "That means a lot! I care about actually being helpful. What else is on your mind?",
    ]);

  if (
    /\b(bye|goodbye|see you|signing off|later|take care|good night|gotta go)\b/.test(
      t,
    )
  )
    return "Take care! I'll be right here whenever you need me. And hey — look after yourself out there.";

  if (
    /\b(math|calculate|equation|algebra|calculus|geometry|statistics|probability|formula)\b/.test(
      t,
    )
  )
    return "Math is literally the language the universe is written in — Euler, Newton, Ramanujan didn't invent it, they discovered it. Pretty humbling when you think about it. What are you working on?";

  if (
    /\b(history|historical|ancient|civilization|empire|war|revolution|century)\b/.test(
      t,
    )
  )
    return "History is humanity's longest experiment in cause and effect, and it rewards careful study. The patterns repeat in ways that'll blow your mind. What period or event are you curious about?";

  if (
    /\b(self.reflect|journal|therapy|growth|self.improvement|mindfulness)\b/.test(
      t,
    )
  )
    return "Self-reflection is how experience becomes wisdom — seriously, writing stuff down, even messy and unpolished, tends to unlock insight that staying in your head just doesn't. What's surfacing for you?";

  if (t.length < 8)
    return pick([
      "I want to give you a proper answer! Could you share a bit more?",
      "Say more — I'm listening!",
      "Hmm, give me a little more to work with!",
    ]);

  return null;
}

// ── Strip HTML tags from text ────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── CORS proxy helper ────────────────────────────────────────────────────────
async function fetchWithProxy(
  url: string,
  timeout = 7000,
): Promise<Response | null> {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://cors-anywhere.herokuapp.com/${url}`,
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { signal: AbortSignal.timeout(timeout) });
      if (res.ok) return res;
    } catch {
      // try next proxy
    }
  }
  return null;
}

// ── SearXNG search (primary — aggregates Google + Bing + more) ───────────────
async function searchSearXNG(query: string): Promise<string | null> {
  const instances = [
    "https://searx.be",
    "https://search.inetol.net",
    "https://paulgo.io",
    "https://searx.tiekoetter.com",
    "https://searxng.world",
    "https://search.disroot.org",
  ];
  const encoded = encodeURIComponent(query);

  for (const base of instances) {
    try {
      const res = await fetch(
        `${base}/search?q=${encoded}&format=json&language=en`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results: Array<{ title: string; content: string; url: string }> =
        data?.results ?? [];
      const top = results.filter((r) => r.title && r.content).slice(0, 3);
      if (top.length === 0) continue;

      const summary = top
        .map((r) => {
          const snippet = r.content?.slice(0, 280) ?? "";
          return `${r.title}: ${snippet}`;
        })
        .join(". ");

      return summary
        .replace(/https?:\/\/[^\s]+/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    } catch {}
  }
  return null;
}

// ── Google News RSS search ───────────────────────────────────────────────────
async function searchGoogleNews(query: string): Promise<string | null> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    // Try direct first, then proxies
    const proxied = await fetchWithProxy(rssUrl, 8000);
    if (!proxied) return null;
    const xml = await proxied.text();
    if (!xml) return null;

    const items: Array<{ title: string; description: string }> = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: regex loop
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const block = match[1];
      const titleMatch =
        block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const descMatch =
        block.match(
          /<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/,
        ) || block.match(/<description[^>]*>([\s\S]*?)<\/description>/);
      const title = stripHtml(titleMatch?.[1] ?? "");
      const description = stripHtml(descMatch?.[1] ?? "");
      if (title && title.length > 5) items.push({ title, description });
    }

    if (items.length === 0) return null;
    return items
      .slice(0, 3)
      .map((it) => {
        const desc =
          it.description && it.description.length > 20
            ? ` — ${it.description.slice(0, 150)}`
            : "";
        return `${it.title}${desc}`;
      })
      .join(". ");
  } catch {
    return null;
  }
}

// ── Wikipedia search (precise two-step lookup) ───────────────────────────────
async function searchWikipedia(query: string): Promise<string | null> {
  const encoded = encodeURIComponent(query);
  try {
    // Step 1: opensearch to find the exact matching article title
    const openRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json&origin=*`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!openRes.ok) return null;
    const openData = await openRes.json();
    // opensearch returns [query, [titles], [descriptions], [urls]]
    const titles: string[] = openData?.[1] ?? [];
    if (titles.length === 0) return null;
    const exactTitle = titles[0];

    // Step 2: fetch the full extract using the exact title
    const extractRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(exactTitle)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!extractRes.ok) return null;
    const extractData = await extractRes.json();
    const pages = extractData?.query?.pages ?? {};
    const pageObj = Object.values(pages)[0] as { extract?: string } | undefined;
    const extract: string = pageObj?.extract ?? "";
    if (extract.trim().length < 100) return null;

    // Pick first meaningful paragraph (>100 chars)
    const paragraphs = extract
      .split(/\n+/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 100);
    const best = paragraphs[0] ?? extract.slice(0, 500);
    // Return first 4 sentences
    const sentences = best.match(/[^.!?]+[.!?]+/g) ?? [];
    return sentences.slice(0, 4).join(" ").trim() || best.slice(0, 500);
  } catch {
    return null;
  }
}

// ── DuckDuckGo fallback ───────────────────────────────────────────────────────
async function searchDuckDuckGo(query: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    // AbstractText is the main answer paragraph
    const abstractText: string = data?.AbstractText ?? "";
    const answer: string = data?.Answer ?? "";
    const related: string =
      (Array.isArray(data?.RelatedTopics) && data.RelatedTopics[0]?.Text) ?? "";
    const result = abstractText || answer || related;
    return result.trim().length > 50 ? result.trim() : null;
  } catch {
    return null;
  }
}

// ── Query type helpers ───────────────────────────────────────────────────────
function isNewsQuery(query: string): boolean {
  return /\b(news|latest|today|current|update|recent|2024|2025|2026|breaking|happening|announced|released|launched)\b/i.test(
    query,
  );
}

function isAIQuery(query: string): boolean {
  return /\b(chatgpt|gemini|openai|artificial intelligence|machine learning|llm|neural network|deep learning|claude|gpt|bard|copilot|midjourney|stable diffusion|\bai\b|robot|automation|language model|generative ai|diffusion model)\b/i.test(
    query,
  );
}

async function searchGoogleNewsAI(query: string): Promise<string | null> {
  return searchGoogleNews(`artificial intelligence ${query}`);
}

// ── Relevance filter ─────────────────────────────────────────────────────────
function isRelevant(text: string, query: string): boolean {
  if (!text || text.length < 80) return false;
  // For person-like queries (2-4 words, mostly capitalized or name-like), check name mention
  const words = query.trim().split(/\s+/);
  if (words.length >= 1 && words.length <= 4) {
    // Check if at least one key word from query appears in result
    const keyWords = words.filter((w) => w.length > 3);
    if (keyWords.length > 0) {
      const textLower = text.toLowerCase();
      const matched = keyWords.filter((w) =>
        textLower.includes(w.toLowerCase()),
      );
      // At least half the key words must appear
      return matched.length >= Math.ceil(keyWords.length / 2);
    }
  }
  return true;
}

// ── Main browser search ──────────────────────────────────────────────────────
async function browserSearch(
  query: string,
): Promise<{ text: string; source: string }> {
  const newsQuery = isNewsQuery(query);
  const aiQuery = isAIQuery(query);

  // Run sources in parallel
  const [wikiResult, ddgResult, searxResult, googleResult, aiResult] =
    await Promise.allSettled([
      searchWikipedia(query),
      searchDuckDuckGo(query),
      searchSearXNG(query),
      searchGoogleNews(query),
      aiQuery ? searchGoogleNewsAI(query) : Promise.resolve(null),
    ]);

  const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : null;
  const ddg = ddgResult.status === "fulfilled" ? ddgResult.value : null;
  const searx = searxResult.status === "fulfilled" ? searxResult.value : null;
  const google =
    googleResult.status === "fulfilled" ? googleResult.value : null;
  const ai = aiResult.status === "fulfilled" ? aiResult.value : null;

  // Strict fallback chain: Wikipedia > DuckDuckGo > SearXNG > Google News
  // Filter for relevance and quality (>80 chars, query terms present)
  if (wiki && isRelevant(wiki, query)) {
    return { text: wiki, source: "wikipedia" };
  }
  if (ddg && isRelevant(ddg, query)) {
    return { text: ddg, source: "duckduckgo" };
  }
  if (aiQuery && ai && isRelevant(ai, query)) {
    return { text: ai, source: "ai-news" };
  }
  if (newsQuery && google && isRelevant(google, query)) {
    return { text: google, source: "google-news" };
  }
  if (searx && isRelevant(searx, query)) {
    return { text: searx, source: "searx" };
  }
  // Last resort: any result even if relevance check fails
  if (wiki && wiki.length > 80) return { text: wiki, source: "wikipedia" };
  if (ddg && ddg.length > 50) return { text: ddg, source: "duckduckgo" };
  if (google && google.length > 80)
    return { text: google, source: "google-news" };
  if (searx && searx.length > 80) return { text: searx, source: "searx" };

  return {
    text: pick(NO_RESULTS),
    source: "fallback",
  };
}

// ── Voice hook ──────────────────────────────────────────────────────────────
function useVoice(muted: boolean) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    (rawText: string) => {
      if (muted || !window.speechSynthesis) return;
      const text = cleanForSpeech(rawText);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.pitch = 0.85;
      utterance.rate = 0.92;
      utterance.volume = 1.0;

      const selectVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const enVoices = voices.filter((v) => v.lang.startsWith("en"));

        let chosen = enVoices.find((v) =>
          v.name.toLowerCase().includes("google uk english male"),
        );
        if (!chosen)
          chosen = enVoices.find((v) =>
            v.name.toLowerCase().includes("microsoft guy online"),
          );
        if (!chosen)
          chosen = enVoices.find((v) =>
            v.name.toLowerCase().includes("microsoft ryan online"),
          );
        if (!chosen)
          chosen = enVoices.find((v) =>
            /\b(david|mark|guy|ryan|james|daniel)\b/i.test(v.name),
          );
        if (!chosen)
          chosen = enVoices.find((v) =>
            /male|man(?!age|ner|ual)/i.test(v.name),
          );
        if (!chosen)
          chosen = enVoices.find(
            (v) => v.lang === "en-GB" || v.lang === "en-AU",
          );
        if (!chosen) chosen = enVoices[0];
        if (!chosen) chosen = voices[0];

        if (chosen) utterance.voice = chosen;
      };

      if (window.speechSynthesis.getVoices().length > 0) selectVoice();
      else window.speechSynthesis.onvoiceschanged = selectVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [muted],
  );

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, cancel, isSpeaking };
}

// ── Emotional state badge ────────────────────────────────────────────────────
const EMOTION_BADGE_MESSAGES: Record<string, string> = {
  sad: "I sense you might be feeling sad",
  heartbroken: "I sense you're going through heartbreak",
  lonely: "I sense you might be feeling lonely",
  stressed: "I sense you're feeling stressed",
  angry: "I sense some frustration",
  tired: "I sense you're feeling tired",
  overwhelmed: "I sense you're feeling overwhelmed",
  happy: "You seem happy today!",
  motivated: "You're feeling motivated — I love it!",
  excited: "You're excited — amazing!",
  curious: "Ooh, curiosity mode activated!",
};

// ── Main app ─────────────────────────────────────────────────────────────────
function JarvisApp({ onNavigateAdmin }: { onNavigateAdmin: () => void }) {
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [muted, setMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<string>("neutral");
  const [emotionEmoji, setEmotionEmoji] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const conversationHistoryRef = useRef<Message[]>([]);

  const { data: history = [], isLoading: historyLoading } = useGetHistory();
  const clearHistory = useClearHistory();
  const saveJarvisMessage = useSaveJarvisMessage();
  const { speak, cancel, isSpeaking } = useVoice(muted);

  const w = window as any;
  const SpeechRecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const sttSupported = !!SpeechRecognitionAPI;

  const allMessages =
    optimisticMessages.length > 0 ? optimisticMessages : history;

  // biome-ignore lint/correctness/useExhaustiveDependencies: allMessages triggers scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  useEffect(() => {
    if (history.length > 0) setOptimisticMessages([]);
  }, [history]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      cancel();
    };
  }, [cancel]);

  // Keep last 10 messages in context
  useEffect(() => {
    conversationHistoryRef.current = allMessages.slice(-10);
  }, [allMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSearching) return;

    setInput("");
    cancel();

    const emotionResult = detectEmotion(text);
    setDetectedEmotion(emotionResult.emotion);
    setEmotionEmoji(emotionResult.emoji);

    const now = BigInt(Date.now());
    const userMsg: Message = {
      id: now,
      content: text,
      role: "user",
      timestamp: now,
    };
    const currentMessages = allMessages.length > 0 ? allMessages : history;
    setOptimisticMessages([...currentMessages, userMsg]);

    const contextualQuery = buildContextualQuery(
      text,
      conversationHistoryRef.current,
    );

    const localResponse = generateLocalResponse(text);

    if (localResponse !== null) {
      const adapted = adaptTone(
        localResponse,
        emotionResult.emotion,
        emotionResult.intensity,
      );
      const jarvisMsg: Message = {
        id: BigInt(Date.now()),
        content: adapted,
        role: "jarvis",
        timestamp: BigInt(Date.now()),
      };
      setOptimisticMessages((prev) => [...prev, jarvisMsg]);
      speak(adapted);
      saveJarvisMessage.mutate(adapted);
    } else {
      const searchingId = BigInt(Date.now());
      const searchingMsg = pick(SEARCH_MESSAGES);
      setOptimisticMessages((prev) => [
        ...prev,
        {
          id: searchingId,
          content: searchingMsg,
          role: "jarvis",
          timestamp: searchingId,
        },
      ]);
      setIsSearching(true);

      let finalResponse: string;
      try {
        const searchResult = await browserSearch(contextualQuery);
        const priorContext = findPriorContext(
          conversationHistoryRef.current,
          text,
        );
        finalResponse = synthesizeAnswer(
          searchResult.text,
          text,
          emotionResult.emotion,
          searchResult.source,
          priorContext,
        );
        finalResponse = adaptTone(
          finalResponse,
          emotionResult.emotion,
          emotionResult.intensity,
        );
      } catch {
        finalResponse =
          "Hmm, I hit a network issue while searching — happens sometimes! Try again in a moment?";
      }

      setIsSearching(false);

      const jarvisMsg: Message = {
        id: BigInt(Date.now()),
        content: finalResponse,
        role: "jarvis",
        timestamp: BigInt(Date.now()),
      };
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === searchingId ? jarvisMsg : m)),
      );
      speak(finalResponse);
      saveJarvisMessage.mutate(finalResponse);
    }
  };

  const handleClear = async () => {
    try {
      cancel();
      await clearHistory.mutateAsync();
      setOptimisticMessages([]);
      setDetectedEmotion("neutral");
      setEmotionEmoji("");
      conversationHistoryRef.current = [];
      toast.success("Conversation cleared.");
    } catch {
      toast.error("Failed to clear history.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMic = () => {
    if (!sttSupported || !SpeechRecognitionAPI) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      textareaRef.current?.focus();
    };
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access denied.");
      } else if (e.error !== "aborted") {
        toast.error("Voice recognition error. Please try again.");
      }
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const isEmpty = allMessages.length === 0 && !historyLoading;
  const isBusy = isSearching;
  const statusLabel = isSearching
    ? "SEARCHING"
    : isSpeaking
      ? "SPEAKING"
      : "ONLINE";
  const statusPulse = isSpeaking || isBusy;

  const showEmotionBadge =
    detectedEmotion !== "neutral" && detectedEmotion !== "";

  return (
    <div
      className="flex flex-col h-screen grid-bg overflow-hidden"
      style={{ background: "oklch(0.10 0.02 240)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{
          borderColor: "oklch(0.20 0.03 235)",
          background: "oklch(0.11 0.025 238 / 0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: "oklch(0.14 0.03 235)",
              border: "1px solid oklch(0.78 0.18 210 / 0.5)",
              boxShadow: "0 0 12px oklch(0.78 0.18 210 / 0.35)",
            }}
          >
            <Zap
              className="w-4 h-4"
              style={{ color: "oklch(0.78 0.18 210)" }}
            />
          </div>
          <div>
            <h1
              className="text-sm font-bold font-mono tracking-[0.15em]"
              style={{ color: "oklch(0.88 0.12 210)" }}
            >
              J.A.R.V.I.S
            </h1>
            <p
              className="text-xs font-mono"
              style={{ color: "oklch(0.45 0.06 230)" }}
            >
              Personal AI · Friend · Search Engine
            </p>
          </div>
          {showEmotionBadge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono"
              style={{
                border: "1px solid oklch(0.78 0.18 210 / 0.3)",
                background: "oklch(0.14 0.03 235 / 0.7)",
                color: "oklch(0.75 0.1 215)",
              }}
            >
              <span>{emotionEmoji}</span>
              <span>
                {EMOTION_BADGE_MESSAGES[detectedEmotion] ?? detectedEmotion}
              </span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: isSearching
                  ? "oklch(0.85 0.2 80)"
                  : isSpeaking
                    ? "oklch(0.85 0.2 140)"
                    : "oklch(0.78 0.18 210)",
                boxShadow: isSearching
                  ? "0 0 8px oklch(0.85 0.2 80)"
                  : isSpeaking
                    ? "0 0 8px oklch(0.85 0.2 140)"
                    : "0 0 8px oklch(0.78 0.18 210)",
                animation: statusPulse
                  ? "pulse 1s ease-in-out infinite"
                  : undefined,
              }}
            />
            <span
              className="text-xs font-mono"
              style={{ color: "oklch(0.55 0.08 220)" }}
            >
              {statusLabel}
            </span>
          </div>

          <button
            type="button"
            data-ocid="jarvis.toggle"
            onClick={() => {
              if (!muted) cancel();
              setMuted((m) => !m);
            }}
            className="flex items-center justify-center w-7 h-7 rounded transition-all"
            title={muted ? "Unmute JARVIS voice" : "Mute JARVIS voice"}
            style={{
              border: "1px solid oklch(0.22 0.04 230)",
              color: muted ? "oklch(0.45 0.06 230)" : "oklch(0.78 0.18 210)",
              background: "transparent",
              boxShadow: muted ? "none" : "0 0 6px oklch(0.78 0.18 210 / 0.25)",
            }}
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          <Button
            data-ocid="jarvis.delete_button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={clearHistory.isPending || allMessages.length === 0}
            className="gap-1.5 text-xs font-mono transition-all"
            style={{
              color: "oklch(0.55 0.08 220)",
              border: "1px solid oklch(0.22 0.04 230)",
            }}
          >
            <Trash2 className="w-3 h-3" />
            CLEAR
          </Button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {historyLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-4"
              data-ocid="jarvis.loading_state"
            >
              <div className="relative w-24 h-24">
                <div
                  className="absolute inset-0 rounded-full pulse-ring-1"
                  style={{ border: "1px solid oklch(0.78 0.18 210 / 0.5)" }}
                />
                <div
                  className="absolute inset-2 rounded-full pulse-ring-2"
                  style={{ border: "1px solid oklch(0.78 0.18 210 / 0.3)" }}
                />
                <div
                  className="absolute inset-4 rounded-full flex items-center justify-center"
                  style={{
                    background: "oklch(0.14 0.03 235)",
                    border: "1px solid oklch(0.78 0.18 210 / 0.4)",
                  }}
                >
                  <span
                    className="font-mono font-bold text-sm"
                    style={{ color: "oklch(0.78 0.18 210)" }}
                  >
                    J
                  </span>
                </div>
              </div>
              <span
                className="font-mono text-sm tracking-widest"
                style={{ color: "oklch(0.5 0.08 220)" }}
              >
                INITIALIZING...
              </span>
            </motion.div>
          ) : isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center justify-center h-full gap-8"
              data-ocid="jarvis.empty_state"
            >
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-56 h-56 rounded-full pulse-ring-2"
                  style={{
                    background:
                      "radial-gradient(circle, oklch(0.78 0.18 210 / 0.08) 0%, transparent 70%)",
                  }}
                />
                <div
                  className="absolute w-48 h-48 rounded-full pulse-ring-1"
                  style={{ border: "1px solid oklch(0.78 0.18 210 / 0.2)" }}
                />
                <div
                  className="absolute w-36 h-36 rounded-full"
                  style={{ border: "1px solid oklch(0.78 0.18 210 / 0.15)" }}
                />
                <div
                  className="relative w-32 h-32 rounded-full overflow-hidden"
                  style={{
                    border: "2px solid oklch(0.78 0.18 210 / 0.6)",
                    boxShadow:
                      "0 0 30px oklch(0.78 0.18 210 / 0.4), 0 0 60px oklch(0.78 0.18 210 / 0.15)",
                  }}
                >
                  <img
                    src="/assets/generated/jarvis-avatar.dim_400x400.png"
                    alt="J.A.R.V.I.S"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="text-center space-y-3 max-w-sm">
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold font-mono tracking-[0.2em] glow-text-cyan"
                  style={{ color: "oklch(0.88 0.15 210)" }}
                >
                  HEY, I'M JARVIS
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm leading-relaxed"
                  style={{ color: "oklch(0.5 0.06 230)" }}
                >
                  Think of me as your super-smart friend who can search the
                  whole internet in seconds, understands how you're feeling, and
                  always has time for you. Just ask anything!
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-wrap gap-2 justify-center mt-4"
                >
                  {[
                    "Who is Elon Musk?",
                    "What is quantum physics?",
                    "Tell me a joke",
                    "Latest news on Google Chrome",
                    "I'm feeling stressed",
                    "What's new in AI?",
                  ].map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="text-xs px-3 py-1.5 rounded font-mono transition-all hover:scale-105"
                      style={{
                        border: "1px solid oklch(0.78 0.18 210 / 0.3)",
                        color: "oklch(0.65 0.1 215)",
                        background: "oklch(0.14 0.03 235 / 0.5)",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              className="max-w-3xl mx-auto space-y-4 pb-4"
            >
              {allMessages.map((msg, i) => (
                <MessageBubble
                  key={String(msg.id)}
                  message={msg}
                  index={i + 1}
                />
              ))}
              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input area */}
      <footer
        className="px-4 py-4 border-t flex-shrink-0"
        style={{
          borderColor: "oklch(0.20 0.03 235)",
          background: "oklch(0.11 0.025 238 / 0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex gap-2 items-end rounded-xl p-2"
            style={{
              background: "oklch(0.14 0.03 235)",
              border: "1px solid oklch(0.25 0.04 235)",
              boxShadow: "0 0 20px oklch(0.78 0.18 210 / 0.08)",
            }}
          >
            <Textarea
              ref={textareaRef}
              data-ocid="jarvis.input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything — I'm here!"
              className="flex-1 resize-none border-0 bg-transparent min-h-[44px] max-h-32 text-sm font-mono focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-40"
              rows={1}
              style={{
                color: "oklch(0.88 0.04 225)",
                caretColor: "oklch(0.78 0.18 210)",
              }}
            />
            {sttSupported && (
              <button
                type="button"
                data-ocid="jarvis.toggle"
                onClick={toggleMic}
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                title={isListening ? "Stop listening" : "Start voice input"}
                style={{
                  background: isListening
                    ? "oklch(0.65 0.2 25 / 0.2)"
                    : "oklch(0.18 0.03 240)",
                  border: isListening
                    ? "1px solid oklch(0.65 0.2 25 / 0.6)"
                    : "1px solid oklch(0.28 0.04 235)",
                  color: isListening
                    ? "oklch(0.75 0.2 25)"
                    : "oklch(0.55 0.06 230)",
                  boxShadow: isListening
                    ? "0 0 12px oklch(0.65 0.2 25 / 0.4)"
                    : "none",
                  animation: isListening
                    ? "pulse 1s ease-in-out infinite"
                    : undefined,
                }}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}
            <Button
              data-ocid="jarvis.submit_button"
              onClick={handleSend}
              disabled={!input.trim() || isSearching}
              size="sm"
              className="flex-shrink-0 w-9 h-9 p-0 rounded-lg transition-all"
              style={{
                background:
                  !input.trim() || isSearching
                    ? "oklch(0.18 0.03 240)"
                    : "oklch(0.55 0.18 210)",
                border: "1px solid oklch(0.28 0.04 235)",
                color:
                  !input.trim() || isSearching
                    ? "oklch(0.40 0.05 230)"
                    : "oklch(0.95 0.02 220)",
                boxShadow:
                  input.trim() && !isSearching
                    ? "0 0 12px oklch(0.55 0.18 210 / 0.5)"
                    : "none",
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p
            className="text-center text-xs font-mono mt-2"
            style={{ color: "oklch(0.35 0.04 230)" }}
          >
            © {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "oklch(0.50 0.08 215)" }}
            >
              Built with ❤ using caffeine.ai
            </a>
          </p>
        </div>
      </footer>

      {/* Admin gear button */}
      <button
        type="button"
        onClick={onNavigateAdmin}
        data-ocid="jarvis.open_modal_button"
        title="Admin Panel"
        className="fixed bottom-20 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 z-50"
        style={{
          background: "oklch(0.14 0.03 235)",
          border: "1px solid oklch(0.28 0.06 220 / 0.5)",
          color: "oklch(0.45 0.08 215)",
          boxShadow: "0 2px 12px oklch(0.10 0.02 235 / 0.8)",
        }}
      >
        <Settings className="w-4 h-4" />
      </button>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "oklch(0.14 0.03 235)",
            border: "1px solid oklch(0.78 0.18 210 / 0.3)",
            color: "oklch(0.88 0.02 240)",
          },
        }}
      />
    </div>
  );
}

function MessageBubble({
  message,
  index,
}: { message: Message; index: number }) {
  const isJarvis = message.role === "jarvis";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      data-ocid={`jarvis.item.${index}`}
      className={`flex gap-3 ${isJarvis ? "items-start" : "items-start flex-row-reverse"}`}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={
          isJarvis
            ? {
                background: "oklch(0.14 0.03 235)",
                border: "1px solid oklch(0.78 0.18 210 / 0.5)",
                boxShadow: "0 0 10px oklch(0.78 0.18 210 / 0.3)",
              }
            : {
                background: "oklch(0.20 0.03 240)",
                border: "1px solid oklch(0.35 0.06 230 / 0.5)",
              }
        }
      >
        <span
          className="text-xs font-bold font-mono"
          style={{
            color: isJarvis ? "oklch(0.78 0.18 210)" : "oklch(0.65 0.05 230)",
          }}
        >
          {isJarvis ? "J" : "U"}
        </span>
      </div>
      <div
        className={`px-4 py-3 rounded-lg text-sm leading-relaxed max-w-[80%] ${
          isJarvis ? "jarvis-border-glow" : ""
        }`}
        style={{
          background: isJarvis
            ? "oklch(0.14 0.03 235 / 0.85)"
            : "oklch(0.18 0.025 240 / 0.9)",
          color: isJarvis ? "oklch(0.90 0.03 220)" : "oklch(0.80 0.01 240)",
          border: isJarvis ? undefined : "1px solid oklch(0.28 0.04 235 / 0.5)",
          fontFamily: isJarvis ? "var(--font-mono, monospace)" : undefined,
          fontSize: isJarvis ? "0.8rem" : "0.875rem",
          lineHeight: "1.7",
        }}
      >
        {message.content}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [page, setPage] = useState<"main" | "admin">("main");
  return (
    <QueryClientProvider client={queryClient}>
      {page === "admin" ? (
        <AdminPanel onBack={() => setPage("main")} />
      ) : (
        <JarvisApp onNavigateAdmin={() => setPage("admin")} />
      )}
    </QueryClientProvider>
  );
}
