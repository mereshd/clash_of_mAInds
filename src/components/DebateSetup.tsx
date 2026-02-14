import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Objective = "neutral" | "argumentative" | "affirmative";

export interface Personality {
  name: string;
  objective: Objective;
  description: string;
}

interface DebateSetupProps {
  onStart: (personalityA: Personality, personalityB: Personality, topic: string, responseLength: number) => void;
}

const PRESETS = [
  { name: "Socrates", objective: "neutral" as Objective },
  { name: "Elon Musk", objective: "argumentative" as Objective },
  { name: "Marie Curie", objective: "affirmative" as Objective },
  { name: "Oscar Wilde", objective: "argumentative" as Objective },
];

const TOPICS = [
  "Is AI a net positive for humanity?",
  "Should we colonize Mars or fix Earth first?",
  "Is free will an illusion?",
  "Is social media destroying society?",
];

const OBJECTIVE_LABELS: Record<Objective, { label: string; description: string }> = {
  neutral: { label: "Neutral", description: "Balanced, open-minded exploration" },
  argumentative: { label: "Argumentative", description: "Confrontational, challenging every point" },
  affirmative: { label: "Affirmative", description: "Supportive, building on ideas" },
};

export function DebateSetup({ onStart }: DebateSetupProps) {
  const [personalityA, setPersonalityA] = useState<Personality>({ name: "", objective: "neutral", description: "" });
  const [personalityB, setPersonalityB] = useState<Personality>({ name: "", objective: "argumentative", description: "" });
  const [topic, setTopic] = useState("");
  const [responseLength, setResponseLength] = useState(3);
  const canStart = personalityA.name && personalityB.name && topic;

  const applyPreset = (side: "a" | "b", preset: typeof PRESETS[0]) => {
    if (side === "a") setPersonalityA({ ...preset, description: personalityA.description });
    else setPersonalityB({ ...preset, description: personalityB.description });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-5xl mx-auto px-4"
    >
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-secondary border border-border"
        >
          <Swords className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">AI Debate Arena</span>
        </motion.div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
          clash of m<span className="text-gradient-gold">AI</span>nds
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Create two unique personalities and watch them debate any topic with AI-powered arguments.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Personality A */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border-2 debater-a-border debater-a-bg p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-debater-a" />
            <h2 className="font-semibold debater-a-text text-lg">Personality A</h2>
          </div>
          <Input
            placeholder="Name (e.g. Socrates)"
            value={personalityA.name}
            onChange={(e) => setPersonalityA({ ...personalityA, name: e.target.value })}
            className="bg-background/50 border-border"
          />
          <Input
            placeholder="Description (e.g. Ancient Greek philosopher known for the Socratic method)"
            value={personalityA.description}
            onChange={(e) => setPersonalityA({ ...personalityA, description: e.target.value })}
            className="bg-background/50 border-border text-sm"
          />
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Objective</Label>
            <Select
              value={personalityA.objective}
              onValueChange={(v) => setPersonalityA({ ...personalityA, objective: v as Objective })}
            >
              <SelectTrigger className="bg-background/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="font-medium">{OBJECTIVE_LABELS[key].label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">— {OBJECTIVE_LABELS[key].description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.slice(0, 2).map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset("a", p)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              >
                <Sparkles className="w-3 h-3 inline mr-1" />
                {p.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Personality B */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border-2 debater-b-border debater-b-bg p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-debater-b" />
            <h2 className="font-semibold debater-b-text text-lg">Personality B</h2>
          </div>
          <Input
            placeholder="Name (e.g. Elon Musk)"
            value={personalityB.name}
            onChange={(e) => setPersonalityB({ ...personalityB, name: e.target.value })}
            className="bg-background/50 border-border"
          />
          <Input
            placeholder="Description (e.g. Tech entrepreneur with bold visions for the future)"
            value={personalityB.description}
            onChange={(e) => setPersonalityB({ ...personalityB, description: e.target.value })}
            className="bg-background/50 border-border text-sm"
          />
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Objective</Label>
            <Select
              value={personalityB.objective}
              onValueChange={(v) => setPersonalityB({ ...personalityB, objective: v as Objective })}
            >
              <SelectTrigger className="bg-background/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="font-medium">{OBJECTIVE_LABELS[key].label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">— {OBJECTIVE_LABELS[key].description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.slice(2).map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset("b", p)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              >
                <Sparkles className="w-3 h-3 inline mr-1" />
                {p.name}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Topic */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-8"
      >
        <label className="block text-sm font-medium text-muted-foreground mb-3">Debate Topic</label>
        <Input
          placeholder="What should they debate?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="bg-card border-border text-lg py-6"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Response Length */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mb-8"
      >
        <Label className="block text-sm font-medium text-muted-foreground mb-3">Argument Length</Label>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Brief</span>
          <Slider
            value={[responseLength]}
            onValueChange={([v]) => setResponseLength(v)}
            min={1}
            max={5}
            step={1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Extensive</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {responseLength === 1 ? "1-2 sentences" : responseLength === 2 ? "1 short paragraph" : responseLength === 3 ? "2-3 paragraphs" : responseLength === 4 ? "3-5 paragraphs" : "5+ detailed paragraphs"}
        </p>
      </motion.div>

      {/* Start */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center"
      >
        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => canStart && onStart(personalityA, personalityB, topic, responseLength)}
          className="px-8 py-6 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
        >
          Start the Debate
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
