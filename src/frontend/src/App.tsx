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
  useSendMessage,
} from "./hooks/useQueries";

const queryClient = new QueryClient();

// ── Voice hook ──────────────────────────────────────────────────────────────
function useVoice(muted: boolean) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (muted || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.9;
      utterance.rate = 0.95;
      utterance.volume = 1;

      // Prefer a deep male English voice if available
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            /male|david|george|daniel|alex/i.test(v.name),
        );
        if (preferred) utterance.voice = preferred;
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        loadVoices();
      } else {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const { data: history = [], isLoading: historyLoading } = useGetHistory();
  const sendMessage = useSendMessage();
  const clearHistory = useClearHistory();
  const { speak, cancel, isSpeaking } = useVoice(muted);

  // Check STT support
  const w = window as any;
  const SpeechRecognitionAPI: any =
    w.SpeechRecognition || w.webkitSpeechRecognition;
  const sttSupported = !!SpeechRecognitionAPI;

  // Merge real history with optimistic updates
  const allMessages =
    optimisticMessages.length > 0 ? optimisticMessages : history;

  // biome-ignore lint/correctness/useExhaustiveDependencies: allMessages triggers scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  // Sync optimistic with real data once loaded
  useEffect(() => {
    if (history.length > 0) {
      setOptimisticMessages([]);
    }
  }, [history]);

  // Stop listening/speaking when component unmounts
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      cancel();
    };
  }, [cancel]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;

    setInput("");
    cancel(); // stop any current speech

    const now = BigInt(Date.now());
    const userMsg: Message = {
      id: now,
      content: text,
      role: "user",
      timestamp: now,
    };
    const currentMessages = allMessages.length > 0 ? allMessages : history;
    setOptimisticMessages([...currentMessages, userMsg]);

    try {
      const response = await sendMessage.mutateAsync(text);
      const jarvisMsg: Message = {
        id: BigInt(Date.now()),
        content: response,
        role: "jarvis",
        timestamp: BigInt(Date.now()),
      };
      setOptimisticMessages((prev) => [...prev, jarvisMsg]);
      speak(response);
    } catch {
      toast.error("Failed to reach J.A.R.V.I.S — please try again.");
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== now));
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
    if (!sttSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      textareaRef.current?.focus();
    };

    recognition.onerror = (e: any) => {
      setIsListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access denied. Please allow mic permissions.");
      } else if (e.error !== "aborted") {
        toast.error("Voice recognition error. Please try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const isEmpty = allMessages.length === 0 && !historyLoading;

  const statusLabel = sendMessage.isPending
    ? "PROCESSING"
    : isSpeaking
      ? "SPEAKING"
      : "ONLINE";

  const statusPulse = isSpeaking || sendMessage.isPending;

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
        {/* HUD corners */}
        <div
          className="absolute top-0 left-0 w-4 h-4"
          style={{
            borderTop: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
            borderLeft: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-4 h-4"
          style={{
            borderBottom: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
            borderLeft: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
          }}
        />
        <div
          className="absolute top-0 right-0 w-4 h-4"
          style={{
            borderTop: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
            borderRight: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-4 h-4"
          style={{
            borderBottom: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
            borderRight: "1.5px solid oklch(0.78 0.18 210 / 0.7)",
          }}
        />

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
          {/* Status dot */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: isSpeaking
                  ? "oklch(0.85 0.2 140)"
                  : "oklch(0.78 0.18 210)",
                boxShadow: isSpeaking
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

          {/* Mute toggle */}
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

      {/* Messages area */}
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
                  Good day. All systems are nominal. How may I assist you today?
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-wrap gap-2 justify-center mt-4"
                >
                  {[
                    "What can you do?",
                    "Tell me a joke",
                    "Explain quantum physics",
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
                {sendMessage.isPending && (
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
                      <div
                        className="w-2 h-2 rounded-full typing-dot"
                        style={{ background: "oklch(0.78 0.18 210)" }}
                      />
                      <div
                        className="w-2 h-2 rounded-full typing-dot"
                        style={{ background: "oklch(0.78 0.18 210)" }}
                      />
                      <div
                        className="w-2 h-2 rounded-full typing-dot"
                        style={{ background: "oklch(0.78 0.18 210)" }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input area */}
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
                : sendMessage.isPending
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
              placeholder={
                isListening ? "Listening..." : "Speak your command..."
              }
              disabled={sendMessage.isPending}
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[40px] max-h-[140px] py-2.5 px-3"
              style={{
                color: "oklch(0.88 0.02 240)",
                caretColor: "oklch(0.78 0.18 210)",
              }}
            />

            {/* Mic button */}
            {sttSupported && (
              <button
                type="button"
                data-ocid="jarvis.button"
                onClick={toggleMic}
                disabled={sendMessage.isPending}
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
              disabled={!input.trim() || sendMessage.isPending}
              size="sm"
              className="mb-1 mr-1 font-mono text-xs tracking-widest transition-all"
              style={{
                background:
                  input.trim() && !sendMessage.isPending
                    ? "oklch(0.78 0.18 210)"
                    : "oklch(0.22 0.04 230)",
                color:
                  input.trim() && !sendMessage.isPending
                    ? "oklch(0.08 0.01 240)"
                    : "oklch(0.45 0.06 230)",
                boxShadow:
                  input.trim() && !sendMessage.isPending
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
      {isJarvis ? (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
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
      ) : (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: "oklch(0.20 0.03 240)",
            border: "1px solid oklch(0.35 0.06 230 / 0.5)",
          }}
        >
          <span
            className="text-xs font-bold font-mono"
            style={{ color: "oklch(0.65 0.05 230)" }}
          >
            U
          </span>
        </div>
      )}

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
