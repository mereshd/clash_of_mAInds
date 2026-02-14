import { useState } from "react";
import { DebateSetup, Personality } from "@/components/DebateSetup";
import { DebateArena } from "@/components/DebateArena";
import { VoiceAgent } from "@/components/VoiceAgent";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppState =
  | { phase: "setup" }
  | { phase: "debate"; personalityA: Personality; personalityB: Personality; topic: string; responseLength: number }
  | { phase: "voice-agent" };

const Index = () => {
  const [state, setState] = useState<AppState>({ phase: "setup" });

  if (state.phase === "debate") {
    return (
      <div className="min-h-screen py-8">
        <DebateArena
          personalityA={state.personalityA}
          personalityB={state.personalityB}
          topic={state.topic}
          responseLength={state.responseLength}
          onBack={() => setState({ phase: "setup" })}
        />
      </div>
    );
  }

  if (state.phase === "voice-agent") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 gap-4">
        <VoiceAgent />
        <Button variant="ghost" className="text-muted-foreground" onClick={() => setState({ phase: "setup" })}>
          ← Back to Debate Setup
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12">
      <DebateSetup
        onStart={(personalityA, personalityB, topic, responseLength) =>
          setState({ phase: "debate", personalityA, personalityB, topic, responseLength })
        }
      />
      <div className="mt-8">
        <Button variant="outline" onClick={() => setState({ phase: "voice-agent" })} className="border-border">
          <Mic className="w-4 h-4 mr-2" />
          Live Voice Agent
        </Button>
      </div>
    </div>
  );
};

export default Index;
