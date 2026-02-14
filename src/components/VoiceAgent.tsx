import { useState, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface VoiceAgentProps {
  agentId?: string;
}

export function VoiceAgent({ agentId: initialAgentId }: VoiceAgentProps) {
  const [agentId, setAgentId] = useState(initialAgentId || "");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
    },
    onDisconnect: () => {},
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        setTranscript((prev) => [
          ...prev,
          { role: "user", text: message.user_transcription_event.user_transcript },
        ]);
      } else if (message.type === "agent_response") {
        setTranscript((prev) => [
          ...prev,
          { role: "agent", text: message.agent_response_event.agent_response },
        ]);
      }
    },
    onError: (err: any) => {
      console.error("Voice agent error:", err);
      setError("Connection error. Please try again.");
      setIsConnecting(false);
    },
  });

  const startConversation = useCallback(async () => {
    if (!agentId.trim()) {
      setError("Please enter your ElevenLabs Agent ID");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setTranscript([]);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-conversation-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ agentId: agentId.trim() }),
      });

      if (!resp.ok) throw new Error("Failed to get conversation token");
      const data = await resp.json();

      if (!data?.token) throw new Error("No token received");

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Failed to start voice agent:", err);
      setError(err.message || "Failed to start. Check your Agent ID.");
    } finally {
      setIsConnecting(false);
    }
  }, [agentId, conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === "connected";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="text-center">
          <h3 className="font-semibold text-foreground text-lg mb-1">🎙️ Voice Agent</h3>
          <p className="text-xs text-muted-foreground">
            Talk live with an ElevenLabs conversational AI agent
          </p>
        </div>

        {!isConnected && (
          <div className="space-y-3">
            <Input
              placeholder="Enter ElevenLabs Agent ID"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="bg-background/50 border-border text-sm"
            />
            <Button
              onClick={startConversation}
              disabled={isConnecting || !agentId.trim()}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Voice Chat
                </>
              )}
            </Button>
          </div>
        )}

        {isConnected && (
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  conversation.isSpeaking
                    ? "bg-primary/20 ring-4 ring-primary/30 animate-pulse-slow"
                    : "bg-secondary ring-2 ring-border"
                }`}
              >
                <Mic className={`w-8 h-8 ${conversation.isSpeaking ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="text-sm text-muted-foreground">
                {conversation.isSpeaking ? "Agent is speaking..." : "Listening..."}
              </p>
            </motion.div>

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg bg-background/50 p-3">
                <AnimatePresence>
                  {transcript.slice(-6).map((entry, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-xs ${
                        entry.role === "user" ? "text-muted-foreground" : "text-primary"
                      }`}
                    >
                      <span className="font-semibold">
                        {entry.role === "user" ? "You" : "Agent"}:
                      </span>{" "}
                      {entry.text}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <Button
              variant="destructive"
              onClick={stopConversation}
              className="w-full"
            >
              <MicOff className="w-4 h-4 mr-2" />
              End Conversation
            </Button>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
