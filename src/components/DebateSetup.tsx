import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Debater {
  name: string;
  personality: string;
}

interface DebateSetupProps {
  onStart: (debaterA: Debater, debaterB: Debater, topic: string) => void;
}

const PRESETS = [
{ name: "Socrates", personality: "Ancient Greek philosopher who questions everything through the Socratic method. Humble, probing, uses analogies." },
{ name: "Elon Musk", personality: "Tech visionary, bold and sometimes provocative. Thinks in first principles, loves sci-fi references." },
{ name: "Marie Curie", personality: "Brilliant scientist, methodical and evidence-driven. Quiet determination, values empirical truth." },
{ name: "Oscar Wilde", personality: "Witty Irish playwright. Master of epigrams, sardonic humor, and paradoxes. Values art and beauty above all." }];


const TOPICS = [
"Is AI a net positive for humanity?",
"Should we colonize Mars or fix Earth first?",
"Is free will an illusion?",
"Is social media destroying society?"];


export function DebateSetup({ onStart }: DebateSetupProps) {
  const [debaterA, setDebaterA] = useState<Debater>({ name: "", personality: "" });
  const [debaterB, setDebaterB] = useState<Debater>({ name: "", personality: "" });
  const [topic, setTopic] = useState("");

  const canStart = debaterA.name && debaterA.personality && debaterB.name && debaterB.personality && topic;

  const applyPreset = (debater: "a" | "b", preset: typeof PRESETS[0]) => {
    if (debater === "a") setDebaterA(preset);else
    setDebaterB(preset);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-5xl mx-auto px-4">

      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-secondary border border-border">

          <Swords className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">AI Debate Arena</span>
        </motion.div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">clash of mAInds
          <span className="text-gradient-gold">clash</span> of Minds
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Create two unique personalities and watch them debate any topic with AI-powered arguments.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Debater A */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border-2 debater-a-border debater-a-bg p-6 space-y-4">

          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-debater-a" />
            <h2 className="font-semibold debater-a-text text-lg">Debater A</h2>
          </div>
          <Input
            placeholder="Name (e.g. Socrates)"
            value={debaterA.name}
            onChange={(e) => setDebaterA({ ...debaterA, name: e.target.value })}
            className="bg-background/50 border-border" />

          <Textarea
            placeholder="Describe their personality, beliefs, speaking style..."
            value={debaterA.personality}
            onChange={(e) => setDebaterA({ ...debaterA, personality: e.target.value })}
            className="bg-background/50 border-border min-h-[100px] resize-none" />

          <div className="flex flex-wrap gap-2">
            {PRESETS.slice(0, 2).map((p) =>
            <button
              key={p.name}
              onClick={() => applyPreset("a", p)}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors">

                <Sparkles className="w-3 h-3 inline mr-1" />
                {p.name}
              </button>
            )}
          </div>
        </motion.div>

        {/* Debater B */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border-2 debater-b-border debater-b-bg p-6 space-y-4">

          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-debater-b" />
            <h2 className="font-semibold debater-b-text text-lg">Debater B</h2>
          </div>
          <Input
            placeholder="Name (e.g. Elon Musk)"
            value={debaterB.name}
            onChange={(e) => setDebaterB({ ...debaterB, name: e.target.value })}
            className="bg-background/50 border-border" />

          <Textarea
            placeholder="Describe their personality, beliefs, speaking style..."
            value={debaterB.personality}
            onChange={(e) => setDebaterB({ ...debaterB, personality: e.target.value })}
            className="bg-background/50 border-border min-h-[100px] resize-none" />

          <div className="flex flex-wrap gap-2">
            {PRESETS.slice(2).map((p) =>
            <button
              key={p.name}
              onClick={() => applyPreset("b", p)}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors">

                <Sparkles className="w-3 h-3 inline mr-1" />
                {p.name}
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Topic */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-8">

        <label className="block text-sm font-medium text-muted-foreground mb-3">Debate Topic</label>
        <Input
          placeholder="What should they debate?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="bg-card border-border text-lg py-6" />

        <div className="flex flex-wrap gap-2 mt-3">
          {TOPICS.map((t) =>
          <button
            key={t}
            onClick={() => setTopic(t)}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors">

              {t}
            </button>
          )}
        </div>
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center">

        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => canStart && onStart(debaterA, debaterB, topic)}
          className="px-8 py-6 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30">

          Start the Debate
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </motion.div>
    </motion.div>);

}