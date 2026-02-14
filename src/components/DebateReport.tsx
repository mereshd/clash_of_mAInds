import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, X, Lightbulb, Target, MessageSquare, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { Personality } from "@/components/DebateSetup";

interface DebateEntry {
  debater: string;
  content: string;
  personalityIndex: number;
  isMediator?: boolean;
}

interface ParticipantReport {
  name: string;
  summary: string;
  drivingPoints: string[];
  keyArguments: string[];
  sentiment: string;
  finalStance: string;
}

interface ReportData {
  overview: string;
  keyInsights: string[];
  participants: ParticipantReport[];
  keyTakeaways: string[];
}

interface DebateReportProps {
  personalities: Personality[];
  topic: string;
  entries: DebateEntry[];
  disabled?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PERSONALITY_COLORS = [
  { text: "debater-a-text", bg: "debater-a-bg", border: "debater-a-border" },
  { text: "debater-b-text", bg: "debater-b-bg", border: "debater-b-border" },
  { text: "debater-c-text", bg: "debater-c-bg", border: "debater-c-border" },
  { text: "debater-d-text", bg: "debater-d-bg", border: "debater-d-border" },
  { text: "debater-e-text", bg: "debater-e-bg", border: "debater-e-border" },
];

const SENTIMENT_COLORS: Record<string, string> = {
  "Strongly Supportive": "text-green-400",
  "Supportive": "text-green-300",
  "Neutral": "text-muted-foreground",
  "Critical": "text-orange-400",
  "Strongly Critical": "text-red-400",
};

export function DebateReport({ personalities, topic, entries, disabled }: DebateReportProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [expandedParticipant, setExpandedParticipant] = useState<number | null>(null);

  const generateReport = async () => {
    if (report) return; // Already generated
    setLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/debate-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ personalities, topic, history: entries }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Network error" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data: ReportData = await resp.json();
      setReport(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const getParticipantColors = (name: string) => {
    const idx = personalities.findIndex((p) => p.name === name);
    return PERSONALITY_COLORS[idx >= 0 ? idx % PERSONALITY_COLORS.length : 0];
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) generateReport(); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-border gap-2"
        >
          <FileText className="w-4 h-4" />
          View Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 bg-card border-border">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Conversation Report
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1 truncate">{topic}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing conversation...</p>
            </div>
          )}

          {report && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6 pt-4"
            >
              {/* Overview */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Overview</h3>
                <p className="text-sm text-foreground leading-relaxed">{report.overview}</p>
              </section>

              {/* Key Insights */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  Key Insights
                </h3>
                <div className="space-y-2">
                  {report.keyInsights.map((insight, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-primary text-xs mt-1 font-mono">{String(i + 1).padStart(2, "0")}</span>
                      <p className="text-sm text-foreground">{insight}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Per-Participant Analysis */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Participant Analysis
                </h3>
                <div className="space-y-3">
                  {report.participants.map((p, i) => {
                    const colors = getParticipantColors(p.name);
                    const isExpanded = expandedParticipant === i;
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}
                      >
                        <button
                          onClick={() => setExpandedParticipant(isExpanded ? null : i)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`font-semibold text-sm ${colors.text}`}>{p.name}</span>
                            <span className={`text-xs ${SENTIMENT_COLORS[p.sentiment] || "text-muted-foreground"}`}>
                              {p.sentiment}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                                <p className="text-sm text-foreground">{p.summary}</p>

                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Target className="w-3 h-3" /> Driving Points
                                  </p>
                                  <ul className="space-y-1">
                                    {p.drivingPoints.map((pt, j) => (
                                      <li key={j} className="text-sm text-foreground flex gap-2 items-start">
                                        <span className="text-muted-foreground">•</span>
                                        {pt}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <TrendingUp className="w-3 h-3" /> Key Arguments
                                  </p>
                                  <ul className="space-y-1">
                                    {p.keyArguments.map((arg, j) => (
                                      <li key={j} className="text-sm text-foreground flex gap-2 items-start">
                                        <span className="text-muted-foreground">•</span>
                                        {arg}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="rounded-md bg-accent/40 p-2.5">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Final Stance</p>
                                  <p className="text-sm text-foreground italic">"{p.finalStance}"</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Key Takeaways */}
              <section className="rounded-lg bg-accent/30 border border-border p-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Key Takeaways
                </h3>
                <div className="space-y-2">
                  {report.keyTakeaways.map((takeaway, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-primary text-sm">✦</span>
                      <p className="text-sm text-foreground">{takeaway}</p>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
