import { useState } from "react";
import { DebateSetup, Personality } from "@/components/DebateSetup";
import { DebateArena } from "@/components/DebateArena";

type AppState =
  | { phase: "setup" }
  | { phase: "debate"; personalities: Personality[]; topic: string; responseLength: number };

const Index = () => {
  const [state, setState] = useState<AppState>({ phase: "setup" });

  if (state.phase === "debate") {
    return (
      <div className="min-h-screen py-8">
        <DebateArena
          personalities={state.personalities}
          topic={state.topic}
          responseLength={state.responseLength}
          onBack={() => setState({ phase: "setup" })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12">
      <DebateSetup
        onStart={(personalities, topic, responseLength) =>
          setState({ phase: "debate", personalities, topic, responseLength })
        }
      />
    </div>
  );
};

export default Index;
