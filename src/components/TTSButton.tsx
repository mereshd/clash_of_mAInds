import { useState, useRef, useCallback } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TTSButtonProps {
  text: string;
  isA: boolean;
  voiceId: string;
  autoPlay?: boolean;
  onPlaybackComplete?: () => void;
}

export function TTSButton({ text, isA, voiceId, autoPlay = false, onPlaybackComplete }: TTSButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoPlayed = useRef(false);

  const playAudio = useCallback(async () => {
    if (playing) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            text: text.slice(0, 2000),
            voiceId,
          }),
        }
      );

      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
        onPlaybackComplete?.();
      };

      audioRef.current = audio;
      await audio.play();
      setPlaying(true);
    } catch (err) {
      console.error("TTS playback error:", err);
    } finally {
      setLoading(false);
    }
  }, [text, isA, playing, onPlaybackComplete]);

  // Auto-play on mount if requested
  if (autoPlay && !hasAutoPlayed.current && !playing && !loading) {
    hasAutoPlayed.current = true;
    setTimeout(() => playAudio(), 300);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={playAudio}
      disabled={loading}
      className={`h-7 w-7 p-0 rounded-full ${
        isA
          ? "hover:bg-[hsl(var(--debater-a)/0.2)] text-[hsl(var(--debater-a))]"
          : "hover:bg-[hsl(var(--debater-b)/0.2)] text-[hsl(var(--debater-b))]"
      }`}
      title={playing ? "Stop" : "Listen"}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : playing ? (
        <VolumeX className="w-3.5 h-3.5" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
