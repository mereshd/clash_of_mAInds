import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pause, Play, Loader2, Volume2, VolumeX, Send, StopCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { TTSButton } from "@/components/TTSButton";
import { selectVoices } from "@/lib/voiceSelection";
import type { Personality } from "@/components/DebateSetup";

interface DebateEntry {
  debater: string;
  content: string;
  isA: boolean;
  isMediator?: boolean;
}

interface DebateArenaProps {
  personalityA: Personality;
  personalityB: Personality;
  topic: string;
  responseLength: number;
  onBack: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const LENGTH_INSTRUCTIONS: Record<number, string> = {
  1: "Keep your response to 1-2 sentences only.",
  2: "Keep your response to 1 short paragraph.",
  3: "Keep your response to 2-3 paragraphs.",
  4: "Write a thorough response of 3-5 paragraphs.",
  5: "Write an extensive, detailed response of 5+ paragraphs.",
};

async function streamDebateTurn({
  personalityA,
  personalityB,
  topic,
  history,
  responseLength,
  onDelta,
  onDone,
  signal,
}: {
  personalityA: Personality;
  personalityB: Personality;
  topic: string;
  history: DebateEntry[];
  responseLength: number;
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
    body: JSON.stringify({ personalityA, personalityB, topic, history, responseLength }),
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

export function DebateArena({ personalityA, personalityB, topic, responseLength, onBack }: DebateArenaProps) {
  const [voiceIdA, voiceIdB] = selectVoices(
    { name: personalityA.name, personality: "" },
    { name: personalityB.name, personality: "" }
  );
  const [entries, setEntries] = useState<DebateEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoPlayIndex, setAutoPlayIndex] = useState<number | null>(null);
  const [waitingForTTS, setWaitingForTTS] = useState(false);
  const [mediatorInput, setMediatorInput] = useState("");
  const [showMediator, setShowMediator] = useState(false);
  const [waitingForMediator, setWaitingForMediator] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const entriesRef = useRef<DebateEntry[]>([]);

  useEffect(() => { entriesRef.current = entries; }, [entries]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [entries, currentText, scrollToBottom]);

  const isRoundComplete = (history: DebateEntry[]) => {
    const debateOnly = history.filter(e => !e.isMediator);
    return debateOnly.length >= 2 && debateOnly.length % 2 === 0;
  };

  const runTurn = useCallback(async (currentHistory: DebateEntry[]) => {
    if (stopped) return;
    setStreaming(true);
    setError(null);
    setCurrentText("");

    const debateOnly = currentHistory.filter(e => !e.isMediator);
    const isA = debateOnly.length % 2 === 0;
    const currentPersonality = isA ? personalityA : personalityB;

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    try {
      await streamDebateTurn({
        personalityA,
        personalityB,
        topic,
        history: currentHistory,
        responseLength,
        signal: controller.signal,
        onDelta: (chunk) => {
          accumulated += chunk;
          setCurrentText(accumulated);
        },
        onDone: () => {},
      });

      const newEntry: DebateEntry = {
        debater: currentPersonality.name,
        content: accumulated,
        isA,
      };

      const updatedHistory = [...currentHistory, newEntry];
      setEntries(updatedHistory);
      setCurrentText("");
      setStreaming(false);

      const newIndex = updatedHistory.length - 1;

      if (voiceEnabled) {
        setAutoPlayIndex(newIndex);
        setWaitingForTTS(true);
      } else {
        if (isRoundComplete(updatedHistory)) {
          setWaitingForMediator(true);
          setShowMediator(true);
        } else if (!stopped) {
          setTimeout(() => {
            if (!paused && !stopped) runTurn(updatedHistory);
          }, 1500);
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Something went wrong");
        setStreaming(false);
      }
    }
  }, [personalityA, personalityB, topic, responseLength, paused, stopped, voiceEnabled]);

  useEffect(() => {
    runTurn([]);
    return () => { abortRef.current?.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!voiceEnabled && waitingForTTS) {
      setAutoPlayIndex(null);
      setWaitingForTTS(false);
      const current = entriesRef.current;
      if (isRoundComplete(current)) {
        setWaitingForMediator(true);
        setShowMediator(true);
      } else if (!stopped && !paused) {
        setTimeout(() => runTurn(current), 500);
      }
    }
  }, [voiceEnabled, waitingForTTS, stopped, paused, runTurn]);

  const handleTTSComplete = useCallback(() => {
    setAutoPlayIndex(null);
    setWaitingForTTS(false);
    const current = entriesRef.current;
    if (isRoundComplete(current)) {
      setWaitingForMediator(true);
      setShowMediator(true);
    } else if (!stopped && !paused) {
      setTimeout(() => runTurn(current), 500);
    }
  }, [stopped, paused, runTurn]);

  const handleMediatorSubmit = () => {
    if (mediatorInput.trim()) {
      const mediatorEntry: DebateEntry = {
        debater: "Mediator",
        content: mediatorInput.trim(),
        isA: false,
        isMediator: true,
      };
      const updated = [...entriesRef.current, mediatorEntry];
      setEntries(updated);
      setMediatorInput("");
    }
    setShowMediator(false);
    setWaitingForMediator(false);
    setTimeout(() => {
      if (!paused && !stopped) runTurn(entriesRef.current);
    }, 500);
  };

  const handleSkipMediator = () => {
    setShowMediator(false);
    setWaitingForMediator(false);
    setTimeout(() => {
      if (!paused && !stopped) runTurn(entriesRef.current);
    }, 500);
  };

  const handleStop = () => {
    setStopped(true);
    setWaitingForMediator(false);
    setShowMediator(false);
    abortRef.current?.abort();
    setStreaming(false);
  };

  const OBJECTIVE_LABEL: Record<string, string> = {
    neutral: "Neutral",
    argumentative: "Argumentative",
    affirmative: "Affirmative",
  };

  const debateOnly = entries.filter(e => !e.isMediator);
  const currentIsA = debateOnly.length % 2 === 0;
  const currentPersonality = currentIsA ? personalityA : personalityB;
  const roundCount = Math.ceil(debateOnly.length / 2);

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
          {!stopped && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaused(!paused);
                  if (paused && !streaming && !waitingForMediator) {
                    runTurn(entriesRef.current);
                  }
                }}
                className="border-border"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                className="border-border text-destructive hover:text-destructive"
                title="End debate"
              >
                <StopCircle className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="border-border"
            title={voiceEnabled ? "Mute voice" : "Enable voice"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <span className="text-xs text-muted-foreground font-mono">Round {roundCount}</span>
        </div>
      </div>

      {/* VS Header */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="text-right">
          <p className="font-bold debater-a-text text-lg">{personalityA.name}</p>
          <p className="text-xs text-muted-foreground">{OBJECTIVE_LABEL[personalityA.objective]}</p>
        </div>
        <div className="text-gradient-gold text-2xl font-bold">VS</div>
        <div className="text-left">
          <p className="font-bold debater-b-text text-lg">{personalityB.name}</p>
          <p className="text-xs text-muted-foreground">{OBJECTIVE_LABEL[personalityB.objective]}</p>
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
              initial={{ opacity: 0, x: entry.isMediator ? 0 : entry.isA ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className={`flex ${entry.isMediator ? "justify-center" : entry.isA ? "justify-start" : "justify-end"}`}
            >
              {entry.isMediator ? (
                <div className="max-w-[80%] rounded-xl p-4 bg-accent border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-3 h-3 text-accent-foreground" />
                    <p className="text-xs font-semibold text-accent-foreground">Mediator</p>
                  </div>
                  <p className="text-sm text-accent-foreground">{entry.content}</p>
                </div>
              ) : (
                <div
                  className={`max-w-[80%] rounded-xl p-4 ${
                    entry.isA
                      ? "debater-a-bg debater-a-glow debater-a-border border"
                      : "debater-b-bg debater-b-glow debater-b-border border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs font-semibold ${entry.isA ? "debater-a-text" : "debater-b-text"}`}>
                      {entry.debater}
                    </p>
                    {voiceEnabled && (
                      <TTSButton
                        text={entry.content}
                        isA={entry.isA}
                        voiceId={entry.isA ? voiceIdA : voiceIdB}
                        autoPlay={autoPlayIndex === i}
                        onPlaybackComplete={autoPlayIndex === i ? handleTTSComplete : undefined}
                      />
                    )}
                  </div>
                  <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{entry.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

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
                {currentPersonality.name}
              </p>
              <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{currentText}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}

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
              <span className="text-sm text-muted-foreground">{currentPersonality.name} is thinking...</span>
            </div>
          </motion.div>
        )}

        {showMediator && !streaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center"
          >
            <div className="w-full max-w-lg rounded-xl p-4 bg-accent/50 border border-border space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent-foreground" />
                <p className="text-sm font-semibold text-accent-foreground">Mediator Interjection</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Add context, redirect the debate, or ask a pointed question. Or skip to let them continue.
              </p>
              <Textarea
                placeholder="e.g. 'Can you both address the economic implications?'"
                value={mediatorInput}
                onChange={(e) => setMediatorInput(e.target.value)}
                className="bg-background/50 border-border min-h-[60px] resize-none text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={handleSkipMediator}>Skip</Button>
                <Button size="sm" onClick={handleMediatorSubmit} disabled={!mediatorInput.trim()}>
                  <Send className="w-3 h-3 mr-1" />
                  Interject
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {stopped && !streaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <p className="text-gradient-gold text-xl font-bold mb-2">🎤 Debate Ended</p>
            <p className="text-muted-foreground text-sm">The debate was concluded after {roundCount} rounds.</p>
          </motion.div>
        )}
      </div>

      {error && (
        <div className="text-center mb-4">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => runTurn(entriesRef.current)}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
