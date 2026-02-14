import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pause, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface Debater {
  name: string;
  personality: string;
}

interface DebateEntry {
  debater: string;
  content: string;
  isA: boolean;
}

interface DebateArenaProps {
  debaterA: Debater;
  debaterB: Debater;
  topic: string;
  onBack: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function streamDebateTurn({
  debaterA,
  debaterB,
  topic,
  history,
  onDelta,
  onDone,
  signal,
}: {
  debaterA: Debater;
  debaterB: Debater;
  topic: string;
  history: DebateEntry[];
  onDelta: (text: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/debate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ debaterA, debaterB, topic, history }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    const err = await resp.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}

export function DebateArena({ debaterA, debaterB, topic, onBack }: DebateArenaProps) {
  const [entries, setEntries] = useState<DebateEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const entriesRef = useRef<DebateEntry[]>([]);

  const maxRounds = 6; // 3 rounds each

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, currentText, scrollToBottom]);

  const runTurn = useCallback(async (currentHistory: DebateEntry[]) => {
    if (currentHistory.length >= maxRounds) return;
    setStreaming(true);
    setError(null);
    setCurrentText("");

    const isA = currentHistory.length % 2 === 0;
    const currentDebater = isA ? debaterA : debaterB;

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    try {
      await streamDebateTurn({
        debaterA,
        debaterB,
        topic,
        history: currentHistory,
        signal: controller.signal,
        onDelta: (chunk) => {
          accumulated += chunk;
          setCurrentText(accumulated);
        },
        onDone: () => {},
      });

      const newEntry: DebateEntry = {
        debater: currentDebater.name,
        content: accumulated,
        isA,
      };

      const updatedHistory = [...currentHistory, newEntry];
      setEntries(updatedHistory);
      setCurrentText("");
      setStreaming(false);

      // Auto-continue if not paused and under max rounds
      if (updatedHistory.length < maxRounds) {
        setTimeout(() => {
          if (!paused) runTurn(updatedHistory);
        }, 1500);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Something went wrong");
        setStreaming(false);
      }
    }
  }, [debaterA, debaterB, topic, paused]);

  // Start on mount
  useEffect(() => {
    runTurn([]);
    return () => {
      abortRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentIsA = entries.length % 2 === 0;
  const currentDebater = currentIsA ? debaterA : debaterB;
  const debateComplete = entries.length >= maxRounds && !streaming;

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => { abortRef.current?.abort(); onBack(); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          New Debate
        </Button>
        <div className="text-center flex-1">
          <p className="text-sm text-muted-foreground">Debating</p>
          <p className="text-primary font-semibold text-sm md:text-base truncate max-w-md mx-auto">{topic}</p>
        </div>
        <div className="flex items-center gap-2">
          {!debateComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaused(!paused);
                if (paused && !streaming && entries.length < maxRounds) {
                  runTurn(entriesRef.current);
                }
              }}
              className="border-border"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            {Math.ceil(entries.length / 2)}/{maxRounds / 2} rounds
          </span>
        </div>
      </div>

      {/* VS Header */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="text-right">
          <p className="font-bold debater-a-text text-lg">{debaterA.name}</p>
          <p className="text-xs text-muted-foreground max-w-[150px] truncate">{debaterA.personality.slice(0, 50)}</p>
        </div>
        <div className="text-gradient-gold text-2xl font-bold">VS</div>
        <div className="text-left">
          <p className="font-bold debater-b-text text-lg">{debaterB.name}</p>
          <p className="text-xs text-muted-foreground max-w-[150px] truncate">{debaterB.personality.slice(0, 50)}</p>
        </div>
      </div>

      {/* Debate Messages */}
      <div
        ref={scrollRef}
        className="spotlight-arena rounded-2xl border border-border p-6 max-h-[60vh] overflow-y-auto space-y-6 mb-6"
      >
        <AnimatePresence>
          {entries.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: entry.isA ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className={`flex ${entry.isA ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-4 ${
                  entry.isA
                    ? "debater-a-bg debater-a-glow debater-a-border border"
                    : "debater-b-bg debater-b-glow debater-b-border border"
                }`}
              >
                <p className={`text-xs font-semibold mb-2 ${entry.isA ? "debater-a-text" : "debater-b-text"}`}>
                  {entry.debater}
                </p>
                <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{entry.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Currently streaming */}
        {streaming && currentText && (
          <motion.div
            initial={{ opacity: 0, x: currentIsA ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${currentIsA ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl p-4 ${
                currentIsA
                  ? "debater-a-bg debater-a-glow debater-a-border border"
                  : "debater-b-bg debater-b-glow debater-b-border border"
              }`}
            >
              <p className={`text-xs font-semibold mb-2 ${currentIsA ? "debater-a-text" : "debater-b-text"}`}>
                {currentDebater.name}
              </p>
              <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{currentText}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading indicator */}
        {streaming && !currentText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex ${currentIsA ? "justify-start" : "justify-end"}`}
          >
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${
              currentIsA ? "debater-a-bg debater-a-border border" : "debater-b-bg debater-b-border border"
            }`}>
              <Loader2 className={`w-4 h-4 animate-spin ${currentIsA ? "debater-a-text" : "debater-b-text"}`} />
              <span className="text-sm text-muted-foreground">{currentDebater.name} is thinking...</span>
            </div>
          </motion.div>
        )}

        {/* Debate complete */}
        {debateComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <p className="text-gradient-gold text-xl font-bold mb-2">🎤 Debate Complete!</p>
            <p className="text-muted-foreground text-sm">Both sides have made their arguments.</p>
          </motion.div>
        )}
      </div>

      {error && (
        <div className="text-center mb-4">
          <p className="text-destructive text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => runTurn(entriesRef.current)}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
