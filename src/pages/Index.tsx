import { useState } from "react";
import { DebateSetup } from "@/components/DebateSetup";
import { DebateArena } from "@/components/DebateArena";

interface Debater {
  name: string;
  personality: string;
}

type AppState =
  | { phase: "setup" }
  | { phase: "debate"; debaterA: Debater; debaterB: Debater; topic: string };

const Index = () => {
  const [state, setState] = useState<AppState>({ phase: "setup" });

  if (state.phase === "debate") {
    return (
      <div className="min-h-screen py-8">
        <DebateArena
          debaterA={state.debaterA}
          debaterB={state.debaterB}
          topic={state.topic}
          onBack={() => setState({ phase: "setup" })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12">
      <DebateSetup
        onStart={(debaterA, debaterB, topic) =>
          setState({ phase: "debate", debaterA, debaterB, topic })
        }
      />
    </div>
  );
};

export default Index;
