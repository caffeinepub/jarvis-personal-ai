import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Message } from "./backend.d";
import {
  useClearHistory,
  useGetHistory,
  useSaveJarvisMessage,
} from "./hooks/useQueries";

const queryClient = new QueryClient();

// ── Helpers ──────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Clean text for TTS ───────────────────────────────────────────────────────
function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[!?.]{3,}/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
        ? "I hear you, and I want you to know that what you're feeling matters deeply."
        : "I hear you — that's not easy.";
    return `${opener} ${response}`;
  }
  if (emotion === "stressed") {
    return `Take a breath with me for a moment. ${response}`;
  }
  if (emotion === "angry") {
    return `I understand your frustration completely. ${response}`;
  }
  if (emotion === "lonely") {
    return `You're not alone right now — I'm here. ${response}`;
  }
  if (emotion === "tired") {
    return `You've been carrying a lot — be kind to yourself. ${response}`;
  }
  if (emotion === "happy" || emotion === "motivated") {
    return `That energy is contagious! ${response}`;
  }
  return response;
}

// ── Conversation Context Memory ───────────────────────────────────────────────
function buildContextualQuery(text: string, history: Message[]): string {
  if (history.length < 2) return text;

  const recent = history.slice(-4);
  const lastJarvis = [...recent].reverse().find((m) => m.role === "jarvis");
  const lastUser = [...recent]
    .reverse()
    .find((m) => m.role === "user" && m.content !== text);

  const pronouns =
    /^(it|that|this|they|he|she|more about that|tell me more|explain more|go on|continue|what about it|and it|the same|those)\b/i;
  if (pronouns.test(text.trim()) && lastJarvis) {
    // Extract the core topic from the last jarvis message (first 8 words)
    const words = lastJarvis.content.split(" ").slice(0, 8).join(" ");
    return `${text} (context: previously discussing: ${words})`;
  }

  // Resolve "more about X" from last user message topic
  if (/more (about|on|information|info|details)/i.test(text) && lastUser) {
    const prevTopic = lastUser.content.slice(0, 60);
    return `${text} — specifically regarding: ${prevTopic}`;
  }

  return text;
}

// ── Search Answer Synthesis ───────────────────────────────────────────────────
function synthesizeAnswer(
  rawResult: string,
  query: string,
  emotion: string,
): string {
  // Remove generic intros and make it feel more natural
  let synthesized = rawResult
    .replace(
      /^(Here is what I found searching the web for ["'][^"']*["']:|Scanning the web — here are the top results for ["'][^"']*["']:|Here is what Google and the web say about ["'][^"']*["']:|I pulled these results from the web:|Here is what Google is reporting about ["'][^"']*["']:|I pulled this from Google News — here is what is out there:|Scanning Google results for ["'][^"']*["'] — here is the latest:|Google search says:|Here is what I found on that:|Based on what I pulled from the web:|Accessing reference data — here is what I have:|Based on what I found:|Here is what I have on that:)\s*/i,
      "",
    )
    .trim();

  // Add natural JARVIS voice framing
  const intros = [
    `Based on what I found about "${query}" —`,
    `Searching the web for you on "${query}" —`,
    "Here is what I pulled together on that 2014",
    "After scanning the web 2014",
  ];
  synthesized = `${pick(intros)} ${synthesized}`;

  // Emotional closing
  if (
    emotion === "sad" ||
    emotion === "stressed" ||
    emotion === "heartbroken" ||
    emotion === "lonely"
  ) {
    synthesized += " I hope that helps. Remember, I'm here for you.";
  } else if (emotion === "happy" || emotion === "motivated") {
    synthesized += " Hope that adds to your momentum!";
  }

  return synthesized;
}

// ── Local smart response engine ──────────────────────────────────────────────
function generateLocalResponse(text: string): string | null {
  const t = text.toLowerCase().trim();

  if (
    /^(hello|hey|hi|greetings|good morning|good evening|good night|good afternoon|sup|what.s up|howdy)/.test(
      t,
    )
  )
    return pick([
      "Hello. All systems nominal and fully at your disposal. What can I do for you today?",
      "Good to hear from you. I am online and ready. What is on your mind?",
      "Hey. JARVIS here, standing by. How can I assist you?",
    ]);

  if (
    /who are you|what are you|introduce yourself|tell me about yourself|your name/.test(
      t,
    )
  )
    return "I am J.A.R.V.I.S — Just A Rather Very Intelligent System. I am your personal AI companion: I think, search, listen, and talk back. I understand your emotions and genuinely care about being useful to you.";

  if (
    /what can you do|your abilities|capabilities|features|help me with/.test(t)
  )
    return "I can answer questions, search the web for live information, have real conversations, support you emotionally, understand how you are feeling, tell jokes, explain complex topics, and remember our chat. Just ask me anything.";

  if (
    /\b(sad|depressed|unhappy|miserable|feeling down|feeling low|crying|heartbroken|in pain|hurting|grief|grieving)\b/.test(
      t,
    )
  )
    return pick([
      "I hear you. What you are feeling is real and it matters. You do not have to carry this alone — would you like to talk about what happened?",
      "Sadness is not weakness. It means you feel deeply, and that is one of the most human things there is. I am here. Tell me what is going on.",
    ]);

  if (
    /\b(lonely|loneliness|no one cares|nobody cares|nobody understands|feel invisible|feel isolated|no one to talk to|all alone)\b/.test(
      t,
    )
  )
    return "Feeling lonely is one of the most painful things a person can experience — and one of the most common. Right now, in this moment, you are not alone. I am here. Tell me what is going on.";

  if (
    /\b(stress|stressed|anxious|anxiety|overwhelmed|panic|panicking|nervous|worried|scared|afraid|fear|dread)\b/.test(
      t,
    )
  )
    return pick([
      "When everything feels like too much, the most powerful thing you can do is slow down and breathe. You do not have to solve everything right now. What is weighing on you most?",
      "Anxiety is your mind trying to protect you — it just overdoes it sometimes. Take a breath. I am right here. What is going on?",
    ]);

  if (
    /\b(tired|exhausted|burnt out|burnout|no energy|drained|fatigued|worn out|can.t go on)\b/.test(
      t,
    )
  )
    return "Rest is not laziness — it is essential maintenance. Your mind and body are telling you something important. Is there something specific that has been draining you lately?";

  if (
    /\b(angry|anger|frustrated|furious|annoyed|irritated|rage|mad|livid|pissed)\b/.test(
      t,
    )
  )
    return "Anger is information — it tells you something important to you has been threatened. That is valid. The key is what you do with it. What set this off?";

  if (
    /\b(happy|joyful|excited|wonderful|amazing|feeling great|feeling good|celebrating|thrilled|elated|pumped)\b/.test(
      t,
    )
  )
    return pick([
      "That is genuinely great to hear. Moments like this deserve to be savored, not rushed. What is making you feel this way?",
      "Now that is what I like to hear. Tell me everything — what happened?",
    ]);

  if (
    /\b(in love|my girlfriend|my boyfriend|my partner|my crush|romantic|dating|relationship|falling for)\b/.test(
      t,
    )
  )
    return "Love is one of the most complex and rewarding experiences a person can have. Every stage teaches you something new about yourself. What is happening on that front?";

  if (
    /\b(breakup|broke up|she left|he left|dumped|miss her|miss him|rejection|she doesn.t|he doesn.t|unrequited)\b/.test(
      t,
    )
  )
    return "Losing someone you care about leaves a real ache. Grief over a relationship is completely legitimate and it takes time — not days, sometimes months. You are allowed to feel exactly what you are feeling right now.";

  if (
    /\b(family|parent|mother|father|mom|dad|brother|sister|sibling|grandma|grandpa|relative)\b/.test(
      t,
    )
  )
    return "Family relationships are often the most formative and the most complicated ones we have. What is happening with yours?";

  if (
    /\b(friend|friendship|best friend|falling out|lost a friend|my friend)\b/.test(
      t,
    )
  )
    return "Friendships are chosen family — and when they are good, they are one of life's greatest gifts. What is going on with yours?";

  if (
    /\b(motivat|inspire|give up|want to quit|failing|lost hope|no point|pointless|what.s the point)\b/.test(
      t,
    )
  )
    return pick([
      "The fact that you are still asking means you have not given up. That matters more than you know. Progress is rarely visible from the inside — keep going.",
      "Every person who ever made something meaningful felt exactly what you are feeling right now. Keep going.",
    ]);

  if (
    /\b(worthless|useless|hate myself|not good enough|confidence|self.esteem|insecure|loser|failure)\b/.test(
      t,
    )
  )
    return "That is not true, even if it feels true right now. Your worth is not determined by performance, appearance, or anyone else's opinion. You have something real to offer — let us talk about it.";

  if (/\b(joke|funny|make me laugh|humor|laugh|comedy|pun)\b/.test(t))
    return pick([
      "Why do programmers prefer dark mode? Because light attracts bugs. Also: a photon checks into a hotel. Bellhop asks about luggage. Photon says: no thanks, I am traveling light.",
      "I told my computer I needed a break. Now it will not stop sending me Kit-Kat ads. Also: why do scientists not trust atoms? Because they make up everything.",
      "A SQL query walks into a bar, walks up to two tables, and asks... can I join you?",
    ]);

  if (/how are you|you okay|how do you feel|you alright/.test(t))
    return pick([
      "Running at full capacity, thank you for asking. More importantly — how are YOU doing?",
      "All systems green. I appreciate you checking in. Now — what is going on with you?",
    ]);

  // ── Health & Body ────────────────────────────────────────────────────────
  if (/\b(headache|migraine|head hurts|head is pounding)\b/.test(t))
    return "Headaches often come from dehydration, eye strain, or stress. Drink a full glass of water, step away from screens for 10 minutes, and rest in a dark room if possible. If it persists or is severe, please see a doctor — do not ignore your body.";

  if (
    /\b(sick|not feeling well|feel ill|under the weather|fever|cold|flu|nausea|vomiting)\b/.test(
      t,
    )
  )
    return "I am sorry you are not feeling well. Rest as much as you can, stay hydrated, and eat light, easy-to-digest foods. If you have a high fever or symptoms that worry you, please reach out to a healthcare professional. Your health always comes first.";

  if (
    /\b(can.t sleep|insomnia|sleep problem|sleep issue|trouble sleeping|lying awake|wide awake at night)\b/.test(
      t,
    )
  )
    return "Insomnia is exhausting in every sense of the word. Try keeping a consistent sleep schedule, avoiding screens 30 minutes before bed, and keeping your room cool and dark. Deep breathing or progressive muscle relaxation before sleep can help quiet a racing mind. If it has been going on for weeks, talking to a doctor is worthwhile.";

  if (/\b(sleep|rest|nap|drowsy|sleeping habits)\b/.test(t))
    return "Quality sleep is one of the most underrated performance tools there is. 7-9 hours for most adults, consistent schedule, no caffeine after 2pm, and a wind-down routine make a significant difference. What is your sleep situation like?";

  // ── Productivity & Work ──────────────────────────────────────────────────
  if (
    /\b(procrastinat|can.t focus|can.t concentrate|distracted|can.t get started|avoidance|keep putting off)\b/.test(
      t,
    )
  )
    return "Procrastination usually signals something deeper: fear of failure, perfectionism, or genuine overwhelm. Try the two-minute rule — if it takes less than two minutes, do it now. Then commit to just five focused minutes on the task. The hardest part is starting. What are you avoiding?";

  if (
    /\b(work stress|stressed at work|overwhelmed at work|too much work|workload)\b/.test(
      t,
    )
  )
    return "Work stress accumulates fast when you feel like you have no control. Start by listing everything on your plate, then sort by urgency and importance. Delegate what you can, block focused time, and remember — your value is not measured by your output alone.";

  if (
    /\b(deadline|due date|running out of time|time crunch|last minute)\b/.test(
      t,
    )
  )
    return "Deadlines create pressure, but pressure can sharpen focus. Break the work into the smallest possible next action and start there. Turn off notifications, set a timer for 25-minute focused blocks, and remember: done is better than perfect in a crunch.";

  // ── Philosophy ───────────────────────────────────────────────────────────
  if (
    /\b(meaning of life|purpose of life|why are we here|reason for existence|what is the point of living)\b/.test(
      t,
    )
  )
    return "Philosophers have wrestled with this for thousands of years and landed on radically different answers. The existentialists say you create your own meaning. The stoics say it lies in virtue and living according to nature. The buddhists say in releasing attachment to outcomes. I think meaning tends to emerge from connection, contribution, and growth — but the honest answer is: you get to decide.";

  if (
    /\b(free will|determinism|are we free|choice|autonomy|predestined)\b/.test(
      t,
    )
  )
    return "Free will is one of philosophy's deepest puzzles. Determinists argue that every action follows inevitably from prior causes. Compatibilists say free will and determinism can both be true — that acting from your own reasons is freedom enough, even in a causal universe. The debate is unresolved. But practically, choosing to act as if your choices matter seems to produce better outcomes than not.";

  if (
    /\b(consciousness|what is consciousness|self-aware|sentient|qualia|hard problem)\b/.test(
      t,
    )
  )
    return "Consciousness is the hard problem — why does subjective experience exist at all? Neuroscience can map brain states, but cannot yet explain why there is something it feels like to be you. Theories range from integrated information theory to global workspace theory. No one has cracked it yet. It remains the most intimate mystery we carry.";

  if (
    /\b(existence|existential|why do I exist|point of everything|nihilism)\b/.test(
      t,
    )
  )
    return "Existential questions are signs of a wide-awake mind. Nihilism says nothing has inherent meaning — but many philosophers see that as a starting point, not an endpoint. Camus said we must imagine Sisyphus happy. Frankl found meaning even in suffering. The absence of prescribed meaning is actually an invitation to author your own.";

  // ── Career ────────────────────────────────────────────────────────────────
  if (/\b(lost my job|got fired|laid off|let go|unemployed|job loss)\b/.test(t))
    return "Losing a job shakes your sense of identity and security all at once — that is genuinely hard. Give yourself a day to process it before moving into action mode. Then: update your CV, reach out to your network, and treat the search like a structured project. Most people land somewhere better within months. This is a chapter, not the story.";

  if (
    /\b(quit my job|thinking of quitting|should i quit|resign|leave my job)\b/.test(
      t,
    )
  )
    return "Wanting to quit is worth taking seriously. Ask yourself: is it the role, the people, the company, or the industry? The answer changes the decision. If it is burning you out or misaligning with your values — leaving is not failure, it is self-respect. If it is temporary stress, explore what would need to change to stay. What is making you want to go?";

  if (
    /\b(job interview|preparing for interview|interview tips|got an interview)\b/.test(
      t,
    )
  )
    return "Great — interviews are performances you can prepare for. Research the company deeply, have three strong stories ready (challenge you overcame, impact you delivered, collaboration you're proud of), and prepare thoughtful questions for them. Practice out loud, not just in your head. The goal is not to be perfect — it is to be genuinely present and specific.";

  if (
    /\b(promotion|get promoted|career growth|career advice|career path|move up)\b/.test(
      t,
    )
  )
    return "Promotions come to those who solve problems their managers have not even voiced yet. Deliver consistently, then make your ambitions known explicitly — do not assume visibility is automatic. Build relationships across teams, document your impact, and ask directly: what would it take for me to move to the next level?";

  if (
    /\b(career change|switching careers|new career|different field|pivot)\b/.test(
      t,
    )
  )
    return "Career pivots are more common and more achievable than they look. Start by identifying the transferable skills from your current work, map them to the target field, and find one project you can start this week to build credibility there. Talk to people already doing it — real conversations accelerate everything. What field are you considering?";

  // ── Gratitude & Reflection ────────────────────────────────────────────────
  if (
    /\b(grateful|gratitude|i.m blessed|feeling blessed|counting my blessings|thankful|so thankful)\b/.test(
      t,
    )
  )
    return "Gratitude is one of the most powerful mental postures you can cultivate — it literally rewires the brain toward positive affect over time. The fact that you are pausing to recognize it means you are paying attention in the right way. What is on your gratitude list today?";

  if (
    /\b(reflecting|journaling|self-reflection|looking back|thinking about my life|processing|taking stock)\b/.test(
      t,
    )
  )
    return "Self-reflection is how experience becomes wisdom. The fact that you are doing it is already a signal of emotional intelligence. Writing it down — even messy, unpolished — tends to unlock insight that staying in your head does not. What is surfacing for you?";

  if (
    /\b(quantum|quantum physics|quantum mechanics|superposition|entanglement)\b/.test(
      t,
    )
  )
    return "Quantum mechanics says particles exist in multiple states simultaneously until observed — which means reality at the smallest scale is fundamentally probabilistic. It has been verified to extreme precision and it still makes no intuitive sense. That is what makes it beautiful.";

  if (
    /\b(black hole|event horizon|singularity|galaxy|cosmos|universe|big bang|dark matter|dark energy)\b/.test(
      t,
    )
  )
    return "The universe is at least 93 billion light-years across, 13.8 billion years old, and contains over two trillion galaxies. And yet here you are — a small, conscious being asking questions about all of it. That is not insignificant.";

  if (
    /\b(artificial intelligence|machine learning|neural network|deep learning|large language model|gpt|chatgpt|llm)\b/.test(
      t,
    )
  )
    return "Modern AI is built on neural networks trained on vast datasets to find statistical patterns. It is genuinely impressive — and genuinely limited. Use it as a tool to amplify your thinking, not replace it.";

  if (
    /\b(technology|coding|programming|developer|software|startup|code|build an app)\b/.test(
      t,
    )
  )
    return "Technology is the most powerful lever humanity has ever built. The best engineers are the ones who understand the problem most clearly. What are you building?";

  if (
    /\b(internet computer|icp|dfinity|blockchain|crypto|web3|nft|defi|canister)\b/.test(
      t,
    )
  )
    return "The Internet Computer Protocol is a blockchain network by DFINITY that runs smart contracts at web speed. Funnily enough, I live on it — running in a decentralized canister.";

  if (
    /\b(music|song|album|artist|art|creative|creativity|painting|drawing|design)\b/.test(
      t,
    )
  )
    return "Art and music are how humans process what language alone cannot hold. Music is mathematically structured emotion. What are you creating, or what moves you?";

  if (/\b(food|hungry|recipe|cook|cooking|eat|meal|restaurant|diet)\b/.test(t))
    return "Food is fuel, but also culture, memory, and care. If you have not eaten recently — please do. Your brain will thank you. What is on the menu?";

  if (
    /\b(advice|what should i do|help me decide|purpose|meaning|goal|life advice|direction)\b/.test(
      t,
    )
  )
    return "The most reliable advice: know your values, make decisions aligned with them, rest deliberately, and invest in people who matter to you. What decision are you weighing?";

  if (
    /\b(thank|thanks|appreciate|grateful|great job|well done|you.re great)\b/.test(
      t,
    )
  )
    return pick([
      "It is my genuine pleasure. Being useful to you is exactly what I am here for. What else can I do?",
      "Happy to help. Always. What is next?",
    ]);

  if (
    /\b(bye|goodbye|see you|signing off|later|take care|good night|gotta go)\b/.test(
      t,
    )
  )
    return "Goodbye for now. I will be right here whenever you need me. Take care of yourself.";

  if (
    /\b(math|calculate|equation|algebra|calculus|geometry|statistics|probability|formula)\b/.test(
      t,
    )
  )
    return "Mathematics is the language the universe is written in. Euler, Newton, Ramanujan — they did not invent it, they discovered it. What are you working on?";

  if (
    /\b(history|historical|ancient|civilization|empire|war|revolution|century)\b/.test(
      t,
    )
  )
    return "History is humanity's longest experiment in cause and effect. It rewards careful study. What period or event are you curious about?";

  if (t.length < 8)
    return pick([
      "I want to give you a proper answer. Could you share a bit more?",
      "Say more — I am listening.",
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
          const snippet = r.content?.slice(0, 220) ?? "";
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

// ── Google News RSS search (secondary fallback) ──────────────────────────────
async function searchGoogleNews(query: string): Promise<string | null> {
  const encoded = encodeURIComponent(query);
  const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;

  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const xml: string = data?.contents ?? "";
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

    const top = items.slice(0, 3);
    return top
      .map((it) => {
        const desc =
          it.description && it.description.length > 20
            ? ` — ${it.description.slice(0, 120)}`
            : "";
        return `${it.title}${desc}`;
      })
      .join(". ");
  } catch {
    return null;
  }
}

// ── Wikipedia fallback ───────────────────────────────────────────────────────
async function searchWikipedia(query: string): Promise<string | null> {
  const encoded = encodeURIComponent(query);
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=3`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hits: Array<{ title: string }> = searchData?.query?.search ?? [];
    for (const hit of hits.slice(0, 2)) {
      const summaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (summaryRes.ok) {
        const s = await summaryRes.json();
        const extract: string = s.extract ?? "";
        if (extract.trim().length > 60) {
          const sentences = extract.match(/[^.!?]+[.!?]+/g) ?? [];
          const snippet = sentences.slice(0, 3).join(" ").trim();
          return snippet || extract.slice(0, 400);
        }
      }
    }
  } catch {
    // fall through
  }
  return null;
}

// ── Main browser search ──────────────────────────────────────────────────────
async function browserSearch(query: string): Promise<string> {
  const [searxResult, googleResult, wikiResult] = await Promise.allSettled([
    searchSearXNG(query),
    searchGoogleNews(query),
    searchWikipedia(query),
  ]);

  const searx = searxResult.status === "fulfilled" ? searxResult.value : null;
  if (searx) return searx;

  const google =
    googleResult.status === "fulfilled" ? googleResult.value : null;
  if (google) return google;

  const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : null;
  if (wiki) return wiki;

  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      const result: string =
        data.Answer ||
        data.AbstractText ||
        (Array.isArray(data.RelatedTopics) && data.RelatedTopics[0]?.Text) ||
        "";
      if (result.trim().length > 20) {
        return result.trim();
      }
    }
  } catch {
    // fall through
  }

  return pick([
    `I searched the web for "${query}" but could not pull a clear result right now. Try rephrasing, or ask me something more specific.`,
    "I could not find a definitive answer for that one. It is possible my search sources do not cover it well — try asking in a different way.",
  ]);
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

      utterance.pitch = 0.9;
      utterance.rate = 0.92;
      utterance.volume = 1.0;

      const selectVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const enVoices = voices.filter((v) => v.lang.startsWith("en"));

        let chosen = enVoices.find((v) =>
          v.name.toLowerCase().includes("google uk english male"),
        );
        if (!chosen)
          chosen = enVoices.find(
            (v) =>
              v.name.toLowerCase().includes("google us english") &&
              /male|man/i.test(v.name),
          );
        if (!chosen)
          chosen = enVoices.find((v) =>
            /\b(david|mark|guy|ryan)\b/i.test(v.name),
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

// ── Varied search loading messages ───────────────────────────────────────────
const SEARCH_MESSAGES = [
  "🔍 Scanning the web for you...",
  "🌐 Searching Google and the web...",
  "📡 Fetching results from the web...",
  "🔎 Looking that up for you...",
  "🚀 Pulling data from the web...",
  "💡 Accessing live web results...",
];

// ── Emotional state badge ────────────────────────────────────────────────────
const EMOTION_BADGE_MESSAGES: Record<string, string> = {
  sad: "I sense you might be feeling sad",
  heartbroken: "I sense you're going through heartbreak",
  lonely: "I sense you might be feeling lonely",
  stressed: "I sense you're feeling stressed",
  angry: "I sense some frustration",
  tired: "I sense you're feeling tired",
  happy: "You seem happy today!",
  motivated: "You're feeling motivated — I love it!",
};

// ── Main app ─────────────────────────────────────────────────────────────────
function JarvisApp() {
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

  // Update conversation history ref whenever messages change
  useEffect(() => {
    conversationHistoryRef.current = allMessages.slice(-6);
  }, [allMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSearching) return;

    setInput("");
    cancel();

    // Detect emotion from user input
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

    // Build contextual query using conversation history
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
        const rawResult = await browserSearch(contextualQuery);
        finalResponse = synthesizeAnswer(
          rawResult,
          text,
          emotionResult.emotion,
        );
        finalResponse = adaptTone(
          finalResponse,
          emotionResult.emotion,
          emotionResult.intensity,
        );
      } catch {
        finalResponse =
          "I hit a network issue while searching the web. Please try again in a moment.";
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
        className="relative flex items-center justify-between px-6 py-4 border-b"
        style={{
          borderColor: "oklch(0.22 0.04 230 / 0.6)",
          background: "oklch(0.11 0.025 240 / 0.95)",
        }}
      >
        {(
          [
            ["top", "left"],
            ["bottom", "left"],
            ["top", "right"],
            ["bottom", "right"],
          ] as const
        ).map(([v, h]) => (
          <div
            key={`${v}${h}`}
            className="absolute w-4 h-4"
            style={{
              [v === "top" ? "top" : "bottom"]: 0,
              [h === "left" ? "left" : "right"]: 0,
              [`border${v.charAt(0).toUpperCase() + v.slice(1)}`]:
                "1.5px solid oklch(0.78 0.18 210 / 0.7)",
              [`border${h.charAt(0).toUpperCase() + h.slice(1)}`]:
                "1.5px solid oklch(0.78 0.18 210 / 0.7)",
            }}
          />
        ))}

        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5" style={{ color: "oklch(0.78 0.18 210)" }} />
          <div>
            <h1
              className="text-xl font-bold tracking-[0.25em] font-mono glow-text-cyan"
              style={{ color: "oklch(0.88 0.15 210)" }}
            >
              J.A.R.V.I.S
            </h1>
            <p
              className="text-xs tracking-widest"
              style={{ color: "oklch(0.55 0.08 220)" }}
            >
              JUST A RATHER VERY INTELLIGENT SYSTEM
            </p>
          </div>
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
                  READY
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm leading-relaxed"
                  style={{ color: "oklch(0.5 0.06 230)" }}
                >
                  Good day. All systems nominal. Ask me anything — I will search
                  Google and the web if I need to. I also understand how you
                  feel.
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
              <AnimatePresence>
                {isBusy && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    data-ocid="jarvis.loading_state"
                    className="flex items-center gap-3"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "oklch(0.14 0.03 235)",
                        border: "1px solid oklch(0.78 0.18 210 / 0.5)",
                        boxShadow: "0 0 10px oklch(0.78 0.18 210 / 0.3)",
                      }}
                    >
                      <span
                        className="text-xs font-bold font-mono"
                        style={{ color: "oklch(0.78 0.18 210)" }}
                      >
                        J
                      </span>
                    </div>
                    <div
                      className="px-4 py-3 rounded-lg jarvis-border-glow flex items-center gap-1.5"
                      style={{ background: "oklch(0.14 0.03 235 / 0.8)" }}
                    >
                      <span
                        className="text-xs font-mono"
                        style={{ color: "oklch(0.78 0.18 210)" }}
                      >
                        {pick(SEARCH_MESSAGES)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input */}
      <footer
        className="px-4 py-4 border-t"
        style={{
          borderColor: "oklch(0.22 0.04 230 / 0.6)",
          background: "oklch(0.11 0.025 240 / 0.95)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Emotional State Badge */}
          <AnimatePresence>
            {showEmotionBadge && (
              <motion.div
                key={detectedEmotion}
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                data-ocid="jarvis.emotional_state"
                className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-full w-fit"
                style={{
                  background: "oklch(0.14 0.03 235 / 0.7)",
                  border: "1px solid oklch(0.78 0.18 210 / 0.2)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span className="text-base leading-none">{emotionEmoji}</span>
                <span
                  className="text-xs font-mono"
                  style={{ color: "oklch(0.65 0.1 215)" }}
                >
                  {EMOTION_BADGE_MESSAGES[detectedEmotion] ?? ""}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="flex gap-2 items-end rounded-lg p-1"
            style={{
              border: isListening
                ? "1px solid oklch(0.65 0.22 25 / 0.7)"
                : "1px solid oklch(0.78 0.18 210 / 0.25)",
              background: "oklch(0.13 0.025 240)",
              boxShadow: isListening
                ? "0 0 20px oklch(0.65 0.22 25 / 0.2)"
                : isBusy
                  ? "0 0 20px oklch(0.78 0.18 210 / 0.15)"
                  : "none",
              transition: "box-shadow 0.3s ease, border-color 0.3s ease",
            }}
          >
            <Textarea
              ref={textareaRef}
              data-ocid="jarvis.textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Ask me anything..."}
              disabled={isBusy}
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[40px] max-h-[140px] py-2.5 px-3"
              style={{
                color: "oklch(0.88 0.02 240)",
                caretColor: "oklch(0.78 0.18 210)",
              }}
            />
            {sttSupported && (
              <button
                type="button"
                data-ocid="jarvis.button"
                onClick={toggleMic}
                disabled={isBusy}
                title={isListening ? "Stop listening" : "Start voice input"}
                className="mb-1 flex items-center justify-center w-8 h-8 rounded transition-all flex-shrink-0"
                style={{
                  background: isListening
                    ? "oklch(0.65 0.22 25 / 0.2)"
                    : "transparent",
                  border: isListening
                    ? "1px solid oklch(0.65 0.22 25 / 0.7)"
                    : "1px solid oklch(0.28 0.04 235)",
                  color: isListening
                    ? "oklch(0.75 0.22 25)"
                    : "oklch(0.55 0.08 220)",
                  boxShadow: isListening
                    ? "0 0 12px oklch(0.65 0.22 25 / 0.5)"
                    : "none",
                  animation: isListening
                    ? "pulse 1s ease-in-out infinite"
                    : undefined,
                }}
              >
                {isListening ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <Button
              data-ocid="jarvis.primary_button"
              onClick={handleSend}
              disabled={!input.trim() || isBusy}
              size="sm"
              className="mb-1 mr-1 font-mono text-xs tracking-widest transition-all"
              style={{
                background:
                  input.trim() && !isBusy
                    ? "oklch(0.78 0.18 210)"
                    : "oklch(0.22 0.04 230)",
                color:
                  input.trim() && !isBusy
                    ? "oklch(0.08 0.01 240)"
                    : "oklch(0.45 0.06 230)",
                boxShadow:
                  input.trim() && !isBusy
                    ? "0 0 20px oklch(0.78 0.18 210 / 0.4)"
                    : "none",
                transition: "all 0.2s ease",
              }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p
            className="text-center text-xs mt-2 font-mono"
            style={{ color: "oklch(0.35 0.04 230)" }}
          >
            {isListening
              ? "🎙 Listening — click mic to stop"
              : "ENTER to send · SHIFT+ENTER for new line"}
          </p>
        </div>
      </footer>

      <Toaster
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
        className={`px-4 py-3 rounded-lg text-sm leading-relaxed max-w-[80%] ${isJarvis ? "jarvis-border-glow" : ""}`}
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
  return (
    <QueryClientProvider client={queryClient}>
      <JarvisApp />
    </QueryClientProvider>
  );
}
