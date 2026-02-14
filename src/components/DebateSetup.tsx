import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Swords, Sparkles, ArrowRight, Plus, X, ChevronLeft, ChevronRight, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface Personality {
  name: string;
  description: string;
}

interface DebateSetupProps {
  onStart: (personalities: Personality[], topic: string, responseLength: number) => void;
}

const PERSONALITY_COLORS = [
  { bg: "debater-a-bg", border: "debater-a-border", text: "debater-a-text", dot: "bg-debater-a" },
  { bg: "debater-b-bg", border: "debater-b-border", text: "debater-b-text", dot: "bg-debater-b" },
  { bg: "debater-c-bg", border: "debater-c-border", text: "debater-c-text", dot: "bg-debater-c" },
  { bg: "debater-d-bg", border: "debater-d-border", text: "debater-d-text", dot: "bg-debater-d" },
  { bg: "debater-e-bg", border: "debater-e-border", text: "debater-e-text", dot: "bg-debater-e" },
];

const PRESETS: Personality[] = [
  { name: "Socrates", description: "Ancient Greek philosopher known for the Socratic method of questioning" },
  { name: "Elon Musk", description: "Tech entrepreneur with bold visions for space, AI, and the future of humanity" },
  { name: "Marie Curie", description: "Pioneering physicist and chemist, first woman to win a Nobel Prize" },
  { name: "Oscar Wilde", description: "Irish poet and playwright famous for sharp wit and flamboyant style" },
];

const TOPICS = [
  "Is AI a net positive for humanity?",
  "Should we colonize Mars or fix Earth first?",
  "Is free will an illusion?",
  "Is social media destroying society?",
];

const DEFAULT_PERSONALITY: Personality = { name: "", description: "" };

function PersonalityCard({
  personality,
  index,
  colorIndex,
  onChange,
  onRemove,
  canRemove,
  onAutoGenerate,
  isGenerating,
  hasTopic,
}: {
  personality: Personality;
  index: number;
  colorIndex: number;
  onChange: (p: Personality) => void;
  onRemove: () => void;
  canRemove: boolean;
  onAutoGenerate: () => void;
  isGenerating: boolean;
  hasTopic: boolean;
}) {
  const colors = PERSONALITY_COLORS[colorIndex % PERSONALITY_COLORS.length];

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-5 space-y-3 min-w-[300px] w-[320px] flex-shrink-0`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
          <h2 className={`font-semibold ${colors.text} text-base`}>Personality {index + 1}</h2>
        </div>
        <div className="flex items-center gap-1">
          {hasTopic && (
            <button
              onClick={onAutoGenerate}
              disabled={isGenerating}
              className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              title="Auto-generate personality for this topic"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
            </button>
          )}
          {canRemove && (
            <button
              onClick={onRemove}
              className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Name</Label>
        <Input
          placeholder="e.g. Socrates"
          value={personality.name}
          onChange={(e) => onChange({ ...personality, name: e.target.value })}
          className="bg-background/50 border-border"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
        <Textarea
          placeholder="e.g. Ancient Greek philosopher known for the Socratic method"
          value={personality.description}
          onChange={(e) => onChange({ ...personality, description: e.target.value })}
          className="bg-background/50 border-border text-sm min-h-[4.5rem] max-h-[8rem] resize-none overflow-y-auto"
          rows={3}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = target.scrollHeight + "px";
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onChange(p)}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          >
            <Sparkles className="w-3 h-3 inline mr-1" />
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DebateSetup({ onStart }: DebateSetupProps) {
  const [personalities, setPersonalities] = useState<Personality[]>([
    { ...DEFAULT_PERSONALITY },
    { ...DEFAULT_PERSONALITY },
  ]);
  const [topic, setTopic] = useState("");
  const [responseLength, setResponseLength] = useState(3);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const canStart = personalities.filter((p) => p.name).length >= 2 && topic;

  const updateScrollState = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    updateScrollState();
    const el = carouselRef.current;
    if (el) el.addEventListener("scroll", updateScrollState);
    return () => el?.removeEventListener("scroll", updateScrollState);
  }, [personalities.length]);

  useEffect(() => {
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [personalities.length]);

  const scroll = (dir: "left" | "right") => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
  };

  const addPersonality = () => {
    if (personalities.length >= 5) return;
    setPersonalities([...personalities, { ...DEFAULT_PERSONALITY }]);
    setTimeout(() => {
      carouselRef.current?.scrollTo({ left: carouselRef.current.scrollWidth, behavior: "smooth" });
    }, 50);
  };

  const removePersonality = (i: number) => {
    setPersonalities(personalities.filter((_, idx) => idx !== i));
  };

  const updatePersonality = (i: number, p: Personality) => {
    setPersonalities(personalities.map((existing, idx) => (idx === i ? p : existing)));
  };

  const autoGeneratePersonality = async (index: number) => {
    if (!topic.trim()) {
      toast.error("Please enter a debate topic first");
      return;
    }
    setGeneratingIndex(index);
    try {
      const existingNames = personalities.map((p) => p.name).filter(Boolean);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-personality`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ topic, existingNames }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed to generate" }));
        throw new Error(err.error || "Failed to generate personality");
      }

      const generated: Personality = await resp.json();
      updatePersonality(index, generated);
      toast.success(`Generated: ${generated.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate personality");
    } finally {
      setGeneratingIndex(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-6xl mx-auto px-4"
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
          Create unique personalities and watch them debate any topic with AI-powered arguments.
        </p>
      </div>

      {/* Topic — now FIRST */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
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

      {/* Personality Carousel — now SECOND */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative mb-8"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-20 disabled:cursor-default flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2 px-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {personalities.map((p, i) => (
              <PersonalityCard
                key={i}
                personality={p}
                index={i}
                colorIndex={i}
                onChange={(updated) => updatePersonality(i, updated)}
                onRemove={() => removePersonality(i)}
                canRemove={personalities.length > 2}
                onAutoGenerate={() => autoGeneratePersonality(i)}
                isGenerating={generatingIndex === i}
                hasTopic={topic.trim().length > 0}
              />
            ))}

            {personalities.length < 5 && (
              <button
                onClick={addPersonality}
                className="min-w-[200px] flex-shrink-0 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 p-6 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-secondary group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Add Personality
                </span>
              </button>
            )}
          </div>

          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-20 disabled:cursor-default flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Response Length */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
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
          onClick={() => {
            const valid = personalities.filter((p) => p.name);
            if (valid.length >= 2) onStart(valid, topic, responseLength);
          }}
          className="px-8 py-6 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
        >
          Start the Debate
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
