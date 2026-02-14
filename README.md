# clash of m**AI**nds

**A multi-agent conversational platform where AI personalities discuss, showdown, and explore any topic — in unison, in real time, in a vocal manner.**

**[Live Demo](https://persona-spark-debate.lovable.app/)** · **[Watch the Demo on YouTube](https://youtu.be/PflYH7n2X4E)**

---

## The Problem

Exploring a topic from a single angle gives you a single answer. Real understanding comes from hearing Socrates question Elon Musk while Marie Curie weighs in with empirical rigor — all in the same room, in real time, with voice.

**clash of mAInds** is a conversational platform where 2–5 AI personalities engage in free-form discussions, structured debates, or collaborative explorations on any topic. Responses stream live, each personality speaks aloud with a distinct voice, and the platform produces structured analytical reports when the conversation wraps up. All while you sit in the moderator's chair.

## Who Is It For

- **Educators & students** — explore topics through multi-perspective dialogue with historical and contemporary figures
- **Critical thinkers** — stress-test ideas by hearing the strongest case from multiple worldviews
- **Content creators** — generate multi-voice scripts, dialogues, panel discussions, and conversation transcripts
- **AI/LLM enthusiasts** — see multi-agent orchestration with streaming, TTS, and structured output in action

## Key Features

| Feature | Description |
|---|---|
| **Multi-Agent Conversations** | 2–5 AI personalities converse simultaneously — debates, discussions, roundtables, or collaborative explorations, each staying fully in character |
| **Real-Time Streaming** | Responses stream token-by-token via SSE — watch thoughts form in real time |
| **Personality-Adaptive Voice** | ElevenLabs TTS with voice parameters (stability, style, speed) auto-tuned to each personality's traits |
| **AI Personality Suggestions** | Enter a topic and let the AI suggest compelling participants via structured tool calls |
| **Human Moderator Mode** | Between rounds, interject as moderator — steer the conversation, ask pointed questions, or add context |
| **Conversation Reports** | Generate structured JSON reports with per-participant analysis, sentiment, key arguments, and takeaways |
| **Adjustable Response Length** | 5-level slider from "1–2 sentences" to "5+ detailed paragraphs" |
| **Smart Voice Assignment** | Gender-aware heuristic maps personalities to appropriate ElevenLabs voices from curated pools |
| **Preset Personalities & Topics** | Quick-start with Socrates, Elon Musk, Marie Curie, Oscar Wilde — or create your own |

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐
│  DebateSetup │────▶│   DebateArena    │────▶│    DebateReport       │
│  (configure) │     │ (live convo)     │     │  (structured summary) │
└─────────────┘     └──────────────────┘     └───────────────────────┘
       │                     │                          │
       ▼                     ▼                          ▼
 generate-personality   debate (SSE stream)      debate-summary
 Edge Function          Edge Function            Edge Function
       │                     │                          │
       └─────────┬───────────┘──────────────────────────┘
                 ▼
        Lovable AI Gateway  ←→  Gemini Flash
                 +
        ElevenLabs TTS API (voice synthesis)
```

1. **Setup** — Pick a topic (or use a preset), configure 2–5 personalities (manual or AI-generated), set response length
2. **Converse** — The arena orchestrates turn-by-turn conversation. Each personality receives the full history and responds in character — agreeing, challenging, building on ideas, or taking a new angle. Responses stream via Server-Sent Events
3. **Moderate** — After each full round, you can interject as a human moderator. Steer the conversation, ask follow-ups, introduce new angles, or challenge a claim. Your messages are injected into the context for all agents
4. **Listen** — Each response is spoken aloud via ElevenLabs with voice settings dynamically derived from the personality's traits (philosophers speak slowly and steadily; entrepreneurs speak fast with high expressiveness)
5. **Report** — At any point, generate a structured analytical report: overview, key insights, per-participant stance analysis, sentiment classification, and actionable takeaways

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project (for Edge Functions)
- A [Lovable](https://lovable.dev/) API key (AI gateway)
- An [ElevenLabs](https://elevenlabs.io/) API key (text-to-speech)

### Installation

```bash
git clone https://github.com/your-username/personality-arena.git
cd personality-arena
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

Set the following secrets in your Supabase project (Dashboard > Edge Functions > Secrets):

```
LOVABLE_API_KEY=your-lovable-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

### Run

```bash
npm run dev
```

The app opens at `http://localhost:8080`.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, shadcn/ui (Radix primitives), Framer Motion |
| **State** | TanStack React Query, React Hook Form + Zod |
| **Backend** | Supabase Edge Functions (Deno runtime) |
| **LLM** | Gemini Flash via Lovable AI Gateway |
| **Voice** | ElevenLabs TTS (`eleven_turbo_v2_5`) |
| **Streaming** | Server-Sent Events (SSE) for real-time token delivery |

## Core Concepts

### Multi-Agent Orchestration

Each conversation turn calls the `debate` Edge Function, which constructs a system prompt embedding the current personality's character, the other participants, and the full conversation history. The LLM generates in-character responses that engage with, build upon, or challenge prior points depending on the personality and topic.

### Personality-Adaptive Voice

The TTS pipeline doesn't just read text — it derives ElevenLabs voice settings from personality traits:

```
Philosophers  → high stability, low style, slower speed
Entrepreneurs → low stability, high style, faster speed
Comedians     → low stability, high style expressiveness
Academics     → moderate-high stability, slightly slower
```

Voice gender is inferred via keyword heuristics on the personality name and description, mapping to curated male/female voice pools with collision-free assignment.

### Human-in-the-Loop Mediation

Between rounds, the moderator panel lets you inject context, redirect the conversation, or challenge participants. Mediator messages are tagged in the conversation history and explicitly acknowledged by all agents in subsequent turns.

### Structured Report Generation

The `debate-summary` function sends the full transcript to the LLM with a structured JSON schema, producing:
- **Overview** — 2–3 sentence conversation arc summary
- **Key Insights** — cross-cutting themes and convergences
- **Per-Participant Analysis** — stance, driving points, key arguments, sentiment, final position
- **Key Takeaways** — actionable conclusions and open questions

## Folder Structure

```
personality-arena/
├── src/
│   ├── pages/
│   │   └── Index.tsx              # Main page — setup → conversation state machine
│   ├── components/
│   │   ├── DebateSetup.tsx        # Topic, personalities, response length config
│   │   ├── DebateArena.tsx        # Live conversation with streaming + moderator + TTS
│   │   ├── DebateReport.tsx       # Structured report generation + display
│   │   ├── TTSButton.tsx          # Per-message text-to-speech playback
│   │   ├── VoiceAgent.tsx         # ElevenLabs conversational voice agent
│   │   └── ui/                    # shadcn/ui component library
│   ├── lib/
│   │   ├── utils.ts               # Tailwind cn() helper
│   │   └── voiceSelection.ts      # Gender detection + voice pool assignment
│   └── integrations/
│       └── supabase/
│           ├── client.ts           # Supabase client init
│           └── types.ts            # Generated DB types
├── supabase/
│   └── functions/
│       ├── debate/                 # SSE streaming conversation response generation
│       ├── debate-summary/         # Structured JSON report generation
│       ├── generate-personality/   # AI personality suggestion (tool calling)
│       ├── elevenlabs-tts/         # Text-to-speech with adaptive voice settings
│       └── elevenlabs-conversation-token/  # Voice agent session tokens
├── .env                            # Frontend env vars (Supabase URL + key)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Safety & Guardrails

Multi-agent applications introduce unique risks. Here's how clash of mAInds addresses them:

| Concern | Mitigation |
|---|---|
| **Character breaking** | System prompts enforce strict in-character behavior; "never break character or mention that you are an AI" is an explicit instruction |
| **Harmful content** | All LLM calls route through the Lovable AI Gateway, which applies content filtering. ElevenLabs also enforces its own content policy on TTS input |
| **Prompt injection via mediator** | Mediator messages are tagged as `[MEDIATOR INTERJECTION]` in the conversation history, clearly delineated from agent outputs |
| **Runaway conversations** | Users can pause, stop, or end conversations at any time. The abort controller cancels in-flight requests immediately |
| **Rate limiting** | Edge Functions return structured 429 responses; the UI surfaces rate limit errors gracefully |
| **Cost control** | TTS input is truncated to 2,000 characters per message. Response length is user-configurable to manage token usage |
| **API key security** | LLM and TTS keys are stored as Supabase secrets (server-side only) — never exposed to the client |

## Roadmap

- [ ] Persistent conversation history (Supabase DB storage)
- [ ] Shareable conversation links and embeds
- [ ] Conversation mode presets (debate, roundtable, interview, Socratic dialogue)
- [ ] Custom voice cloning for personalities
- [ ] Plugin system for custom LLM providers (APIs, MCPs, etc)

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run linting and tests:
   ```bash
   npm run lint
   npm run test
   ```
5. Commit and open a pull request

Please open an issue first for large changes or new features to discuss the approach.

## License

This project is not yet licensed. All rights reserved by the author. If you'd like to use this code, please reach out.

---

<p align="center">
  <strong>clash of m<em>AI</em>nds</strong> — because the best ideas emerge when great minds collide.
</p>
