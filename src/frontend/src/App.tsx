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

function isSearchQuery(t: string): boolean {
  return (
    /^(who|what|when|where|how|why|which|is |are |was |were |did |do |does |has |have |will |can |could |tell me about|search|look up|find out|latest|current|today|right now|news about|update on|define|meaning of|explain|describe|show me)/.test(
      t,
    ) ||
    /\b(latest|current|today|news|recent|now|2024|2025|2026|price|cost|score|winner|result|released|update|version|population|capital of|president of|prime minister|ceo of|founder of|age of|height of|birthday|born|died|invented|discovered|chrome|google chrome|browser|firefox|safari|edge|extension|incognito|bookmark|chromebook|webstore)\b/.test(
      t,
    )
  );
}

// ── Local smart response engine ──────────────────────────────────────────────
function generateLocalResponse(text: string): string | null {
  const t = text.toLowerCase().trim();

  if (isSearchQuery(t)) return null;

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
    return "I am J.A.R.V.I.S — Just A Rather Very Intelligent System. I am your personal AI companion: I think, search, listen, and talk back. I genuinely care about being useful to you.";

  if (
    /what can you do|your abilities|capabilities|features|help me with/.test(t)
  )
    return "I can answer questions, search Google for live information, have real conversations, support you emotionally, tell jokes, explain complex topics, and remember our chat. Just ask me anything.";

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
          const snippet = r.content?.slice(0, 150) ?? "";
          return `${r.title}: ${snippet}`;
        })
        .join(". ");

      const intro = pick([
        `Here is what I found searching the web for "${query}":`,
        `Scanning the web — here are the top results for "${query}":`,
        `Here is what Google and the web say about "${query}":`,
        "I pulled these results from the web:",
      ]);
      return `${intro} ${summary}.`;
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

    // Parse <item> blocks from RSS
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

    // Build a natural summary from top results
    const top = items.slice(0, 3);
    const summary = top
      .map((it) => {
        const desc =
          it.description && it.description.length > 20
            ? ` — ${it.description.slice(0, 120)}`
            : "";
        return `${it.title}${desc}`;
      })
      .join(". ");

    const intro = pick([
      `Here is what Google is reporting about "${query}":`,
      "I pulled this from Google News — here is what is out there:",
      `Scanning Google results for "${query}" — here is the latest:`,
      "Google search says:",
    ]);
    return `${intro} ${summary}.`;
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
  // 1. SearXNG — aggregates Google, Bing, and more
  const searxResult = await searchSearXNG(query);
  if (searxResult) return searxResult;

  // 2. Google News RSS fallback
  const googleResult = await searchGoogleNews(query);
  if (googleResult) return googleResult;

  // 3. Wikipedia fallback
  const wikiResult = await searchWikipedia(query);
  if (wikiResult) {
    const intro = pick([
      "Here is what I found on that:",
      "Based on what I pulled from the web:",
      "Accessing reference data — here is what I have:",
    ]);
    return `${intro} ${wikiResult}`;
  }

  // 4. DuckDuckGo instant answer
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
        return `${pick(["Based on what I found:", "Here is what I have on that:"])} ${result.trim()}`;
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
    (text: string) => {
      if (muted || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.85;
      utterance.rate = 0.92;
      utterance.volume = 1;
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            /male|david|george|daniel|alex|guy/i.test(v.name),
        );
        if (preferred) utterance.voice = preferred;
      };
      if (window.speechSynthesis.getVoices().length > 0) loadVoices();
      else window.speechSynthesis.onvoiceschanged = loadVoices;
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

// ── Main app ─────────────────────────────────────────────────────────────────
function JarvisApp() {
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [muted, setMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSearching) return;

    setInput("");
    cancel();

    const now = BigInt(Date.now());
    const userMsg: Message = {
      id: now,
      content: text,
      role: "user",
      timestamp: now,
    };
    const currentMessages = allMessages.length > 0 ? allMessages : history;
    setOptimisticMessages([...currentMessages, userMsg]);

    const localResponse = generateLocalResponse(text);

    if (localResponse !== null) {
      const jarvisMsg: Message = {
        id: BigInt(Date.now()),
        content: localResponse,
        role: "jarvis",
        timestamp: BigInt(Date.now()),
      };
      setOptimisticMessages((prev) => [...prev, jarvisMsg]);
      speak(localResponse);
      saveJarvisMessage.mutate(localResponse);
    } else {
      const searchingId = BigInt(Date.now());
      setOptimisticMessages((prev) => [
        ...prev,
        {
          id: searchingId,
          content: "🔍 Searching the web...",
          role: "jarvis",
          timestamp: searchingId,
        },
      ]);
      setIsSearching(true);

      let finalResponse: string;
      try {
        finalResponse = await browserSearch(text);
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
        {[
          ["top", "left"],
          ["bottom", "left"],
          ["top", "right"],
          ["bottom", "right"],
        ].map(([v, h]) => (
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
                  Google and the web if I need to.
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
                        🔍 Searching the web...
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
