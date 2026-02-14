# Technical Documentation — clash of mAInds

This document provides an in-depth technical reference for every layer of the clash of mAInds platform: frontend architecture, component internals, edge function implementations, the voice pipeline, design system, and data flow.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Application Bootstrap & Routing](#application-bootstrap--routing)
3. [Frontend Components — Deep Dive](#frontend-components--deep-dive)
   - [Index Page (State Machine)](#index-page-state-machine)
   - [DebateSetup](#debatesetup)
   - [DebateArena](#debatearena)
   - [DebateReport](#debatereport)
   - [TTSButton](#ttsbutton)
   - [VoiceAgent](#voiceagent)
4. [Supabase Edge Functions](#supabase-edge-functions)
   - [debate](#debate)
   - [generate-personality](#generate-personality)
   - [debate-summary](#debate-summary)
   - [elevenlabs-tts](#elevenlabs-tts)
   - [elevenlabs-conversation-token](#elevenlabs-conversation-token)
5. [Voice Pipeline](#voice-pipeline)
   - [Voice Selection Algorithm](#voice-selection-algorithm)
   - [Personality-Adaptive Voice Settings](#personality-adaptive-voice-settings)
   - [TTS Playback Lifecycle](#tts-playback-lifecycle)
6. [SSE Streaming Protocol](#sse-streaming-protocol)
7. [Design System](#design-system)
   - [Color Architecture](#color-architecture)
   - [Typography](#typography)
   - [Spotlight & Glow Effects](#spotlight--glow-effects)
   - [Animation Strategy](#animation-strategy)
8. [Build & Development Toolchain](#build--development-toolchain)
9. [Environment & Configuration Reference](#environment--configuration-reference)
10. [Error Handling Patterns](#error-handling-patterns)
11. [Security Model](#security-model)

---

## Architecture Overview

```
                    ┌──────────────────────────────────────────────┐
                    │              CLIENT (Browser)                │
                    │                                              │
                    │  React 18 + TypeScript + Vite + Tailwind     │
                    │                                              │
                    │  ┌────────────┐ ┌───────────┐ ┌───────────┐ │
                    │  │DebateSetup │→│DebateArena│→│DebateReport│ │
                    │  └────────────┘ └─────┬─────┘ └─────┬─────┘ │
                    │                       │             │        │
                    │  ┌─────────┐  ┌───────┴──┐  ┌──────┴─────┐ │
                    │  │TTSButton│  │VoiceAgent│  │voiceSelect.│ │
                    │  └────┬────┘  └────┬─────┘  └────────────┘ │
                    └───────┼────────────┼────────────────────────┘
                            │            │
                   HTTPS    │            │  WebRTC
                   + SSE    │            │
                    ┌───────┼────────────┼────────────────────────┐
                    │       ▼            ▼                        │
                    │  SUPABASE EDGE FUNCTIONS (Deno)             │
                    │                                              │
                    │  ┌────────┐ ┌──────────────┐ ┌───────────┐ │
                    │  │ debate │ │gen-personality│ │debate-summ│ │
                    │  │ (SSE)  │ │ (tool call)  │ │  (JSON)   │ │
                    │  └───┬────┘ └──────┬───────┘ └─────┬─────┘ │
                    │      │             │               │        │
                    │  ┌───┴─────────────┴───────────────┴─────┐ │
                    │  │     Lovable AI Gateway (Gemini Flash)  │ │
                    │  └───────────────────────────────────────┘ │
                    │                                              │
                    │  ┌────────────────┐ ┌──────────────────┐   │
                    │  │ elevenlabs-tts │ │ elevenlabs-token │   │
                    │  └───────┬────────┘ └────────┬─────────┘   │
                    │          │                    │              │
                    │  ┌───────┴────────────────────┴───────────┐ │
                    │  │         ElevenLabs API                 │ │
                    │  │   TTS v1 + ConvAI Token Endpoint       │ │
                    │  └────────────────────────────────────────┘ │
                    └──────────────────────────────────────────────┘
```

The system follows a **client-heavy / functions-thin** pattern. The React frontend manages all UI state, conversation orchestration, and turn sequencing. Edge Functions are stateless proxies that enrich requests with system prompts and securely forward them to external APIs (Lovable AI Gateway, ElevenLabs).

There is **no database layer** — all conversation state lives in React component state within the browser session.

---

## Application Bootstrap & Routing

### Entry Point: `index.html` → `main.tsx` → `App.tsx`

```
index.html
  └─ <div id="root">
       └─ main.tsx: createRoot().render(<App />)
            └─ App.tsx
                 ├─ QueryClientProvider (TanStack React Query)
                 ├─ TooltipProvider (Radix)
                 ├─ Toaster (Radix toast) + Sonner (toast lib)
                 └─ BrowserRouter
                      ├─ Route "/" → <Index />
                      └─ Route "*" → <NotFound />
```

**Key decisions:**

- **No SSR** — pure client-side SPA via Vite. The `index.html` loads `main.tsx` as a module.
- **SWC compiler** — `@vitejs/plugin-react-swc` replaces Babel for faster HMR and builds.
- **Dual toast systems** — both Radix `<Toaster>` (for shadcn/ui compatibility) and Sonner (for programmatic `toast()` calls from components) are mounted at the app root.
- **QueryClient** — instantiated with default options. Currently used for infrastructure only (no `useQuery` calls in the codebase yet), but available for future data-fetching needs.
- **Path aliases** — `@/*` resolves to `./src/*` via both `vite.config.ts` (`resolve.alias`) and `tsconfig.app.json` (`paths`).
- **Dev server** — binds to `::` (all interfaces) on port 8080 with HMR overlay disabled.
- **Component tagger** — `lovable-tagger` plugin runs in dev mode only, injecting metadata attributes for the Lovable IDE.

---

## Frontend Components — Deep Dive

### Index Page (State Machine)

**File:** `src/pages/Index.tsx`

The root page implements a two-state finite state machine via a discriminated union:

```typescript
type AppState =
  | { phase: "setup" }
  | { phase: "debate"; personalities: Personality[]; topic: string; responseLength: number };
```

- **`setup`** — renders `<DebateSetup>`. The `onStart` callback transitions to the `debate` phase, passing the configured personalities, topic, and response length.
- **`debate`** — renders `<DebateArena>`. The `onBack` callback resets to `setup`.

There is no routing between phases — it's a single-page state swap. This avoids URL state management for ephemeral conversation sessions.

---

### DebateSetup

**File:** `src/components/DebateSetup.tsx`

#### Purpose
Configuration screen where users define the conversation topic, personality lineup (2–5), and response verbosity.

#### State Management

| State | Type | Purpose |
|---|---|---|
| `personalities` | `Personality[]` | Array of `{ name, description }` objects. Initialized with 2 empty entries |
| `topic` | `string` | The conversation topic |
| `responseLength` | `number` (1–5) | Controls LLM output length via system prompt instructions |
| `generatingIndex` | `number \| null` | Tracks which personality card is currently being AI-generated |
| `canScrollLeft/Right` | `boolean` | Carousel scroll state for arrow button visibility |

#### Personality Carousel

The personality cards are rendered inside a horizontally scrollable `<div>` with:
- `overflow-x: auto` with hidden scrollbars (`scrollbar-hide`, `-ms-overflow-style: none`)
- Programmatic scroll via `scrollBy({ left: ±340, behavior: "smooth" })`
- Scroll state detection via `scrollLeft` comparisons on `scroll` event + a 100ms debounced `useEffect`
- Each card is `min-w-[300px] w-[320px] flex-shrink-0` — fixed width, non-collapsible

#### Validation Gate

```typescript
const canStart = personalities.filter((p) => p.name).length >= 2 && topic;
```

At least 2 personalities must have a non-empty `name`, and a topic must be set. The start button is disabled otherwise.

#### AI Personality Generation

When the user clicks the wand icon on a personality card:
1. Validates that `topic` is non-empty
2. Sets `generatingIndex` to show a loading spinner on that specific card
3. Calls `POST /functions/v1/generate-personality` with `{ topic, existingNames }` 
4. `existingNames` prevents the AI from suggesting duplicate personalities
5. On success, the personality card is populated with the returned `{ name, description }`
6. Toast notification confirms the generation

#### Preset System

Four hardcoded `Personality` objects (Socrates, Elon Musk, Marie Curie, Oscar Wilde) and four debate topics are available as quick-select chips. Clicking a preset fills in the personality card or topic input immediately.

#### Color Assignment

Each personality card gets a deterministic color from `PERSONALITY_COLORS[index % 5]`:
- **A** (index 0): Red-orange — `hsl(8 78% 58%)`
- **B** (index 1): Cyan-blue — `hsl(199 89% 60%)`
- **C** (index 2): Green — `hsl(142 70% 50%)`
- **D** (index 3): Purple — `hsl(280 70% 60%)`
- **E** (index 4): Amber — `hsl(32 90% 55%)`

---

### DebateArena

**File:** `src/components/DebateArena.tsx`

This is the most complex component. It orchestrates the entire conversation lifecycle: turn sequencing, SSE streaming, TTS playback chaining, mediator interjection, and debate termination.

#### State

| State | Type | Purpose |
|---|---|---|
| `entries` | `DebateEntry[]` | Completed conversation messages |
| `streaming` | `boolean` | Whether an SSE stream is currently active |
| `paused` | `boolean` | User-toggled pause |
| `stopped` | `boolean` | Permanent end of conversation |
| `currentText` | `string` | Accumulated text from the active SSE stream (displayed as "typing") |
| `voiceEnabled` | `boolean` | Whether TTS auto-plays after each turn |
| `autoPlayIndex` | `number \| null` | Index of the entry currently being spoken |
| `waitingForTTS` | `boolean` | Whether we're waiting for TTS playback to complete before continuing |
| `mediatorInput` | `string` | Text in the mediator input field |
| `showMediator` | `boolean` | Whether the mediator panel is visible |
| `waitingForMediator` | `boolean` | Whether the system is waiting for mediator action before next round |

The `entriesRef` (`useRef`) mirrors `entries` state — this is critical because `useCallback` closures capture stale state. The ref is updated via a `useEffect` and used inside all async callbacks.

#### DebateEntry Type

```typescript
interface DebateEntry {
  debater: string;          // Personality name (or "Mediator")
  content: string;          // Full response text
  personalityIndex: number; // Index into the personalities array (-1 for mediator)
  isMediator?: boolean;     // true for mediator messages
}
```

#### Turn Sequencing Logic

The conversation proceeds in rounds. A round completes when every personality has spoken once:

```typescript
const isRoundComplete = (history: DebateEntry[]) => {
  const debateOnly = history.filter(e => !e.isMediator);
  return debateOnly.length >= personalities.length && 
         debateOnly.length % personalities.length === 0;
};

const getCurrentIndex = (history: DebateEntry[]) => {
  const debateOnly = history.filter(e => !e.isMediator);
  return debateOnly.length % personalities.length;
};
```

Mediator messages are **excluded** from turn counting — they don't consume a turn slot. The personality order is fixed (0, 1, 2, ..., N-1, 0, 1, ...).

#### Turn Execution Flow (`runTurn`)

```
runTurn(currentHistory)
  │
  ├─ Set streaming=true, currentText=""
  ├─ Compute currentIndex from history
  ├─ Create AbortController
  ├─ Call streamDebateTurn() with SSE
  │   ├─ Each delta → accumulated += chunk; setCurrentText(accumulated)
  │   └─ Done → create DebateEntry, append to history
  │
  ├─ If voiceEnabled:
  │   ├─ Set autoPlayIndex = new entry index
  │   └─ Set waitingForTTS = true (pause turn sequencing)
  │       └─ TTSButton.onPlaybackComplete → handleTTSComplete()
  │           ├─ If round complete → show mediator panel
  │           └─ Else → setTimeout(500ms) → runTurn(updatedHistory)
  │
  └─ If voice disabled:
      ├─ If round complete → show mediator panel
      └─ Else → setTimeout(1500ms) → runTurn(updatedHistory)
```

The delay between turns (500ms with voice, 1500ms without) provides visual breathing room.

#### Mediator Interjection

When a round completes, the mediator panel appears with a `<Textarea>` and two actions:

- **Submit** — creates a `DebateEntry` with `isMediator: true` and `personalityIndex: -1`, appends it to history, then resumes turns after 500ms
- **Skip** — closes the panel and resumes turns without adding a mediator message

Mediator messages in the UI are rendered centered (neither left nor right) with an `accent` background and a `MessageSquare` icon.

#### Conversation Controls

- **Pause/Play** — toggles `paused` state. When resuming, if not currently streaming or waiting for mediator, calls `runTurn` immediately
- **Stop** — sets `stopped=true`, aborts any in-flight request, hides mediator panel, displays "Debate Ended" message
- **Voice toggle** — if voice is disabled while `waitingForTTS` is true, immediately cancels the TTS wait and resumes turn sequencing

#### Message Layout

Messages alternate left/right alignment based on `personalityIndex % 2`:
- Even indices → `justify-start` (left)
- Odd indices → `justify-end` (right)
- Mediator messages → `justify-center`

Each message bubble includes:
- Personality color border, background (10% opacity), and glow effect
- A `TTSButton` (when voice is enabled) for manual replay
- Markdown rendering via `react-markdown` with `prose-invert` styling

#### Streaming Display

During active streaming, a separate bubble shows the in-progress text:
- Uses `currentText` (accumulated from SSE deltas)
- Rendered with the same color/layout as the current personality
- When no text has arrived yet, shows a `Loader2` spinner with "[name] is thinking..."

---

### DebateReport

**File:** `src/components/DebateReport.tsx`

#### Purpose
Generates and displays a structured analytical report of the conversation via the `debate-summary` Edge Function.

#### Trigger
Mounted inside `DebateArena`'s header. The "View Report" button is always visible (disabled during streaming). Opening the dialog immediately triggers `generateReport()`.

#### Report Schema

```typescript
interface ReportData {
  overview: string;
  keyInsights: string[];
  participants: ParticipantReport[];
  keyTakeaways: string[];
}

interface ParticipantReport {
  name: string;
  summary: string;
  drivingPoints: string[];
  keyArguments: string[];
  sentiment: "Strongly Supportive" | "Supportive" | "Neutral" | "Critical" | "Strongly Critical";
  finalStance: string;
}
```

#### UI Structure

The report is rendered inside a `<Dialog>` (Radix) with a `<ScrollArea>`:

1. **Overview** — plain text paragraph
2. **Key Insights** — numbered list with monospace indices (`01`, `02`, ...)
3. **Participant Analysis** — collapsible cards per participant
   - Click header to expand → summary, driving points (bulleted), key arguments (bulleted), final stance (italicized in a highlighted box)
   - Sentiment gets color-coded text: green for supportive, orange for critical, red for strongly critical
   - Card border/background uses the participant's assigned debater color
4. **Key Takeaways** — starred list in an accent-highlighted section

#### Sentiment Color Mapping

```typescript
const SENTIMENT_COLORS: Record<string, string> = {
  "Strongly Supportive": "text-green-400",
  "Supportive": "text-green-300",
  "Neutral": "text-muted-foreground",
  "Critical": "text-orange-400",
  "Strongly Critical": "text-red-400",
};
```

---

### TTSButton

**File:** `src/components/TTSButton.tsx`

#### Purpose
Per-message text-to-speech playback button. Can operate in two modes: manual click and auto-play.

#### Props

| Prop | Type | Purpose |
|---|---|---|
| `text` | `string` | The message content to synthesize |
| `isA` | `boolean` | Legacy prop — controls hover color (debater-a vs debater-b styling) |
| `voiceId` | `string` | ElevenLabs voice ID to use |
| `personalityName` | `string?` | Passed to TTS for voice parameter derivation |
| `personalityDescription` | `string?` | Passed to TTS for voice parameter derivation |
| `autoPlay` | `boolean` | If true, triggers playback immediately on mount |
| `onPlaybackComplete` | `() => void` | Callback when audio finishes — used by DebateArena to chain turns |

#### Playback Flow

```
playAudio()
  │
  ├─ If currently playing → pause, reset, return
  ├─ Set loading=true
  ├─ POST /functions/v1/elevenlabs-tts
  │   Body: { text: text.slice(0, 2000), voiceId, personalityName, personalityDescription }
  │   Response: audio/mpeg blob
  │
  ├─ Create blob URL → new Audio(url)
  ├─ audio.onended → setPlaying(false), revokeObjectURL, call onPlaybackComplete
  └─ audio.play() → setPlaying(true)
```

**Text truncation:** input is sliced to 2,000 characters to limit ElevenLabs API costs and latency.

#### Auto-Play Mechanism

```typescript
if (autoPlay && !hasAutoPlayed.current && !playing && !loading) {
  hasAutoPlayed.current = true;
  setTimeout(() => playAudio(), 300);
}
```

This runs synchronously during render (not in a `useEffect`). The `hasAutoPlayed` ref prevents re-triggering on re-renders. The 300ms delay gives the UI time to settle.

---

### VoiceAgent

**File:** `src/components/VoiceAgent.tsx`

#### Purpose
A standalone component for real-time voice conversations with an ElevenLabs Conversational AI agent. This uses the `@elevenlabs/react` SDK's `useConversation` hook for WebRTC-based bidirectional voice.

#### Flow

```
User enters Agent ID → Start Voice Chat
  │
  ├─ Request microphone permission (getUserMedia)
  ├─ POST /functions/v1/elevenlabs-conversation-token { agentId }
  │   Response: { token: "..." }
  │
  ├─ conversation.startSession({ conversationToken, connectionType: "webrtc" })
  │
  ├─ onMessage handlers:
  │   ├─ "user_transcript" → append to transcript
  │   └─ "agent_response" → append to transcript
  │
  └─ End Conversation → conversation.endSession()
```

#### Transcript Display
Shows the last 6 messages in a scrollable box. User messages are muted, agent messages are primary-colored. Uses `AnimatePresence` for entry animations.

#### Status Indicator
A pulsing circle (`animate-pulse-slow`, 3s cubic-bezier) with a microphone icon. The ring and color change when `conversation.isSpeaking` is true.

---

## Supabase Edge Functions

All Edge Functions run on Deno and share a common pattern:

1. CORS preflight handling (`OPTIONS` → 204 with headers)
2. Parse JSON body
3. Validate required environment variables
4. Call external API
5. Return response (streaming or JSON)
6. Structured error responses with status codes (400, 402, 429, 500)

### CORS Headers

All functions use an identical `corsHeaders` object:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

The wide `Allow-Headers` set accommodates Supabase client SDK headers. `Allow-Origin: *` is permissive — in production this should be restricted to the app's domain.

---

### debate

**File:** `supabase/functions/debate/index.ts`

#### Input

```json
{
  "personalities": [{ "name": "Socrates", "description": "..." }, ...],
  "currentIndex": 0,
  "topic": "Is free will an illusion?",
  "history": [{ "debater": "...", "content": "...", "isMediator": false }, ...],
  "responseLength": 3
}
```

#### System Prompt Construction

The system prompt is dynamically assembled with:

1. **Character identity:** `You are roleplaying as "${current.name}" in a conversation.`
2. **Description clause:** conditional — only included if `current.description` is non-empty
3. **Other participants:** names and descriptions of all other personalities, comma-separated
4. **Topic:** embedded in the prompt
5. **Length instruction:** mapped from `responseLength` (1–5) to explicit word-count guidance

```typescript
const lengthInstructions: Record<number, string> = {
  1: "Keep your response to 1-2 sentences only. Be extremely concise.",
  2: "Keep your response to 1 short paragraph.",
  3: "Keep your response to 2-3 paragraphs.",
  4: "Write a thorough response of 3-5 paragraphs.",
  5: "Write an extensive, detailed response of 5+ paragraphs with deep analysis.",
};
```

6. **Turn-specific instruction:** opening statement (`turnIndex === 0`) vs. response to prior points
7. **Mediator acknowledgment:** explicit instruction to incorporate mediator interjections
8. **Anti-breaking rule:** "Never break character or mention that you are an AI"

#### Message History Construction

The full conversation history is transformed into chat messages:

```typescript
for (const entry of history) {
  if (entry.isMediator) {
    messages.push({ role: "user", content: `[MEDIATOR INTERJECTION]: ${entry.content}` });
  } else {
    const role = entry.debater === current.name ? "assistant" : "user";
    const prefix = entry.debater !== current.name ? `[${entry.debater}]: ` : "";
    messages.push({ role, content: `${prefix}${entry.content}` });
  }
}
```

Key design decisions:
- **Own messages → `assistant` role**, others' messages → `user` role. This makes the LLM "remember" what it said previously
- **Speaker prefix** (`[Name]: `) is prepended to other participants' messages for attribution
- **Mediator messages** always use `user` role with `[MEDIATOR INTERJECTION]:` prefix
- A final `user` message prompts the response ("Please give your opening statement" or "Please respond...")

#### LLM Call

```typescript
fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages,
    stream: true,
  }),
})
```

- **Model:** `google/gemini-3-flash-preview` via the Lovable AI Gateway (OpenAI-compatible API)
- **Streaming:** enabled — the response body is an SSE stream

#### Response Passthrough

The Edge Function returns the raw SSE stream directly to the client:

```typescript
return new Response(response.body, {
  headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
});
```

No buffering, no transformation — the Deno runtime pipes the upstream response body as a `ReadableStream`.

#### Supabase Config

```toml
[functions.debate]
verify_jwt = false
```

JWT verification is disabled for this function, allowing calls with just the anon key in the `Authorization` header.

---

### generate-personality

**File:** `supabase/functions/generate-personality/index.ts`

#### Input

```json
{
  "topic": "Is AI a net positive for humanity?",
  "existingNames": ["Socrates", "Elon Musk"]
}
```

#### Approach: Structured Tool Calling

This function uses the OpenAI-compatible **tool calling** API rather than raw text generation:

```typescript
tools: [{
  type: "function",
  function: {
    name: "suggest_personality",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
      },
      required: ["name", "description"],
      additionalProperties: false,
    },
  },
}],
tool_choice: { type: "function", function: { name: "suggest_personality" } },
```

**Why tool calling over plain JSON?** Tool calling provides schema-enforced structured output. The model is forced to call `suggest_personality` with exactly the right fields, eliminating JSON parsing failures.

#### Deduplication

The system prompt includes: `Do NOT suggest any of these already-chosen personalities: ${existingNames.join(", ")}` — preventing the AI from re-suggesting personalities already in the lineup.

#### Response Extraction

```typescript
const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
const personality = JSON.parse(toolCall.function.arguments);
```

---

### debate-summary

**File:** `supabase/functions/debate-summary/index.ts`

#### Input

```json
{
  "personalities": [...],
  "topic": "...",
  "history": [{ "debater": "...", "content": "...", "isMediator": false }, ...]
}
```

#### Transcript Assembly

```typescript
const transcript = history
  .map((e) => (e.isMediator ? `[Mediator]: ${e.content}` : `[${e.debater}]: ${e.content}`))
  .join("\n\n");
```

The full conversation is flattened into a labeled transcript with double-newline separators.

#### System Prompt

The system prompt defines the exact JSON schema the LLM must return, including:
- Field descriptions and expected types
- Semantic guidelines ("drivingPoints are core motivations, keyArguments are specific examples")
- Array length limits ("2–4 items maximum for conciseness")
- Anti-repetition instruction ("Do NOT repeat the same idea across different sections")
- Output format ("Return ONLY the JSON object, no markdown fences")

#### JSON Parsing (Dual Strategy)

```typescript
try {
  report = JSON.parse(content);
} catch {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    report = JSON.parse(match[1].trim());
  }
}
```

First attempts direct `JSON.parse`. If the LLM wraps the response in markdown code fences (which happens despite instructions), extracts the content between ``` fences and reparses.

#### Non-Streaming

Unlike `debate`, this function uses a **non-streaming** call (`stream: false` / omitted) because the entire JSON response must be received before parsing.

---

### elevenlabs-tts

**File:** `supabase/functions/elevenlabs-tts/index.ts`

#### Input

```json
{
  "text": "To be, or not to be...",
  "voiceId": "CwhRBWXzGAHq8TQ4Fs17",
  "personalityName": "Shakespeare",
  "personalityDescription": "English playwright known for dramatic monologues"
}
```

#### Personality-Adaptive Voice Settings

The `deriveVoiceSettings()` function dynamically tunes ElevenLabs voice parameters based on keyword analysis of the personality's name and description. It scans for trait indicators across five categories:

**1. Calm / Philosophical**
- Keywords: `philosopher`, `wise`, `calm`, `stoic`, `thoughtful`, `measured`, `monk`, `sage`, `meditat`, `contemplat`, `serene`, `patient`, `rational`, `logical`, `analytic`
- Effect: ↑ stability (up to 0.85), ↓ style (down to 0.1), ↓ speed (down to 0.85)

**2. Energetic / Passionate**
- Keywords: `entrepreneur`, `bold`, `energetic`, `passionate`, `revolutionary`, `fiery`, `intense`, `radical`, `visionary`, `disrupt`, `innovator`, `maverick`, `rebel`, `provocat`
- Effect: ↓ stability (down to 0.2), ↑ style (up to 0.9), ↑ speed (up to 1.15)

**3. Authoritative / Commanding**
- Keywords: `leader`, `president`, `general`, `commander`, `king`, `queen`, `emperor`, `authorit`, `powerful`, `commanding`, `military`, `dictator`
- Effect: ↑ stability (up to 0.8), ↑ similarity_boost (up to 0.95), ↓ speed (down to 0.9)

**4. Humorous / Comedic**
- Keywords: `comedian`, `funny`, `humorous`, `satirist`, `witty`, `sarcastic`, `comic`, `jest`, `playful`, `whimsical`
- Effect: ↓ stability (down to 0.2), ↑ style (up to 0.85)

**5. Academic / Scientific**
- Keywords: `scientist`, `professor`, `researcher`, `academic`, `scholar`, `physicist`, `mathematician`, `biologist`, `engineer`, `doctor`, `intellectual`
- Effect: ↑ stability (up to 0.75), ↓ speed (down to 0.9)

**Scoring:** each matched keyword adds to a category score. Adjustments are cumulative — a personality described as "a calm, wise philosopher" would score 3 on calm, pushing stability to `0.45 + 0.3 = 0.75`. All values are clamped to their min/max bounds.

**Defaults:** `stability: 0.45`, `similarity_boost: 0.75`, `style: 0.45`, `speed: 1.0`, `use_speaker_boost: true`.

#### ElevenLabs API Call

```typescript
fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`, {
  body: JSON.stringify({
    text,
    model_id: "eleven_turbo_v2_5",
    voice_settings: voiceSettings,
  }),
})
```

- **Model:** `eleven_turbo_v2_5` — ElevenLabs' low-latency streaming model
- **Format:** MP3 at 44.1kHz, 128kbps
- **Response:** audio stream passed through directly to the client

---

### elevenlabs-conversation-token

**File:** `supabase/functions/elevenlabs-conversation-token/index.ts`

A thin proxy that fetches a short-lived conversation token from ElevenLabs' ConvAI API:

```typescript
fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`, {
  headers: { "xi-api-key": ELEVENLABS_API_KEY },
})
```

This token is used by the `VoiceAgent` component to establish a WebRTC session without exposing the API key to the client.

---

## Voice Pipeline

### Voice Selection Algorithm

**File:** `src/lib/voiceSelection.ts`

#### Voice Pools

- **Male voices:** 9 curated ElevenLabs voices (Roger, Charlie, George, Callum, Liam, Eric, Chris, Brian, Daniel)
- **Female voices:** 6 curated voices (Sarah, Laura, Alice, Matilda, Jessica, Lily)

#### Gender Detection

```typescript
function detectGender(name: string, personality: string): "male" | "female" | "unknown"
```

Computes a score by matching the combined `name + personality` text against two keyword lists:

- **Female indicators** (63 keywords): pronouns (`she`, `her`), titles (`queen`, `princess`), relationship terms (`mother`, `sister`), and 40+ common female names (historical and contemporary)
- **Male indicators** (60+ keywords): pronouns (`he`, `him`), titles (`king`, `prince`), and common male names

If female score > male → female. If male > female → male. Tie → `"unknown"` (defaults to male voice pool).

#### Collision-Free Assignment

```typescript
export function selectVoicesForMany(participants: { name: string; personality: string }[]): string[]
```

For each participant:
1. Detect gender → select pool (male or female)
2. Compute a deterministic hash of `name + personality` → base index into pool
3. If that voice ID is already used by a prior participant → increment offset until a free voice is found
4. Mark voice ID as used via `Set<string>`

This guarantees every participant gets a unique voice, even with 5 participants. The hash ensures the same personality always gets the same voice across sessions.

### TTS Playback Lifecycle

```
DebateArena completes a turn
  │
  ├─ voiceEnabled? → set autoPlayIndex = entry index
  │                    set waitingForTTS = true
  │
  └─ TTSButton renders with autoPlay=true
       │
       ├─ 300ms delay → playAudio()
       ├─ POST to elevenlabs-tts Edge Function
       │   ├─ deriveVoiceSettings() from personality traits
       │   └─ ElevenLabs API → audio/mpeg stream
       ├─ Create blob URL → Audio element → play()
       │
       └─ audio.onended
            └─ onPlaybackComplete callback
                 └─ DebateArena.handleTTSComplete()
                      ├─ Clear autoPlayIndex, waitingForTTS
                      ├─ If round complete → show mediator panel
                      └─ Else → setTimeout(500ms) → runTurn()
```

This creates a **sequential chain**: generate → stream → speak → (wait for audio end) → next turn. The conversation only advances after the audio finishes playing.

---

## SSE Streaming Protocol

### Client-Side Parser (`streamDebateTurn`)

The `DebateArena` component parses SSE manually (no `EventSource` API — it uses `fetch` for POST support):

```typescript
const reader = resp.body.getReader();
const decoder = new TextDecoder();
```

**Line-by-line parsing:**
1. Read chunks from the `ReadableStream`
2. Accumulate into a text buffer
3. Split on `\n`, process each line:
   - Skip lines starting with `:` (SSE comments)
   - Skip empty lines
   - Skip lines not starting with `data: `
   - Strip `data: ` prefix
   - If payload is `[DONE]` → end stream
   - Otherwise, `JSON.parse` → extract `choices[0].delta.content`
4. If JSON parse fails, put the line back into the buffer (partial line)

**Flush logic:** after the stream ends, any remaining buffer content is processed line-by-line with the same logic.

**Abort support:** an `AbortController` signal is passed to `fetch`, enabling immediate cancellation when the user clicks Stop or navigates away.

---

## Design System

### Color Architecture

The design system is built on CSS custom properties (HSL format) defined in `src/index.css` and consumed via Tailwind in `tailwind.config.ts`.

#### Base Palette

| Token | HSL | Role |
|---|---|---|
| `--background` | `220 20% 7%` | Page background (near-black blue) |
| `--foreground` | `210 20% 92%` | Primary text (near-white) |
| `--card` | `220 18% 11%` | Card/panel surfaces |
| `--primary` | `38 92% 55%` | Gold accent (buttons, highlights, brand) |
| `--secondary` | `220 16% 16%` | Subtle surface elevation |
| `--muted` | `220 14% 14%` | Disabled/background elements |
| `--destructive` | `0 84% 60%` | Error/danger states |
| `--border` | `220 14% 18%` | All borders |

#### Participant Colors

Five distinct hues ensure up to 5 participants are visually differentiated:

| Slot | Token | HSL | Visual |
|---|---|---|---|
| A | `--debater-a` | `8 78% 58%` | Red-coral |
| B | `--debater-b` | `199 89% 60%` | Sky blue |
| C | `--debater-c` | `142 70% 50%` | Emerald green |
| D | `--debater-d` | `280 70% 60%` | Violet purple |
| E | `--debater-e` | `32 90% 55%` | Warm amber |

Each has three derived utility classes:
- `.debater-X-border` — full-saturation border
- `.debater-X-bg` — 10% opacity background
- `.debater-X-glow` — `box-shadow` with 25% opacity + inner highlight

### Typography

| Role | Font | Weight Range |
|---|---|---|
| Body / Headings | Space Grotesk | 300–700 |
| Monospace / Code | JetBrains Mono | 400–600 |

Loaded via Google Fonts CDN import in `index.css`. Applied globally via `:root { font-family: 'Space Grotesk' }` and the Tailwind `fontFamily.sans/mono` extension.

### Spotlight & Glow Effects

The arena area uses a **multi-layer radial gradient** background:

```css
.spotlight-arena {
  background: 
    radial-gradient(ellipse at 20% 50%, hsl(var(--debater-a-glow)) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 50%, hsl(var(--debater-b-glow)) 0%, transparent 60%),
    var(--stage-gradient);
}
```

This creates two colored "spotlights" positioned at 20% and 80% horizontal, simulating a stage lighting effect behind the conversation messages.

Individual message glow effects use `box-shadow`:

```css
.debater-a-glow {
  box-shadow: 0 0 30px hsl(var(--debater-a-glow)), 
              inset 0 1px 0 hsl(var(--debater-a) / 0.15);
}
```

### Animation Strategy

All animations use Framer Motion:

| Element | Animation | Config |
|---|---|---|
| Setup sections | Fade-in + slide up | `opacity: 0→1`, `y: 30→0`, staggered delays (0.3–0.6s) |
| Message bubbles | Fade-in + horizontal slide | `opacity: 0→1`, `x: ±20→0`, 0.4s duration |
| Streaming bubble | Fade-in only | `opacity: 0→1` |
| Mediator panel | Fade-in + scale | `opacity: 0→1`, `scale: 0.95→1` |
| Report sections | Fade-in | `opacity: 0→1` |
| Report participant expand | Height + opacity | `height: 0→auto`, `opacity: 0→1`, 0.2s |
| VoiceAgent mic | Scale + fade | `scale: 0.8→1`, `opacity: 0→1` |

`AnimatePresence` wraps the message list and transcript entries for exit animations.

The title features a gold gradient text effect:

```css
.text-gradient-gold {
  background: linear-gradient(135deg, hsl(38 92% 55%), hsl(45 100% 70%));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Build & Development Toolchain

| Tool | Version | Purpose |
|---|---|---|
| Vite | 5.4.19 | Dev server, HMR, production bundler |
| @vitejs/plugin-react-swc | 3.11.0 | React Fast Refresh via SWC (not Babel) |
| TypeScript | 5.8.3 | Type checking (strict mode disabled for app code) |
| ESLint | 9.32.0 | Linting with `react-hooks` and `react-refresh` plugins |
| Tailwind CSS | 3.4.17 | Utility-first CSS with `tailwindcss-animate` plugin |
| PostCSS | 8.5.6 | CSS processing pipeline (autoprefixer + Tailwind) |
| Vitest | 3.2.4 | Unit testing (jsdom environment) |
| @testing-library/react | 16.0.0 | Component testing utilities |
| lovable-tagger | 1.1.13 | Dev-only component metadata injection |

### Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start Vite dev server on `:8080` |
| `npm run build` | Production build (minified, tree-shaken) |
| `npm run build:dev` | Development build (source maps, no minification) |
| `npm run preview` | Serve production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest (single run) |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Environment & Configuration Reference

### Frontend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Full Supabase project URL (e.g., `https://xyz.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anonymous/public key |

These are embedded into the client bundle at build time via Vite's `import.meta.env` mechanism. The `VITE_` prefix is required for client exposure.

### Supabase Secrets (Server-Side)

| Variable | Required | Used By |
|---|---|---|
| `LOVABLE_API_KEY` | Yes | `debate`, `generate-personality`, `debate-summary` |
| `ELEVENLABS_API_KEY` | Yes | `elevenlabs-tts`, `elevenlabs-conversation-token` |

Set via Supabase Dashboard (Settings > Edge Functions > Secrets) or `supabase secrets set`. These are **never** exposed to the client.

### Supabase Config (`supabase/config.toml`)

```toml
project_id = "huqpsxtteztcrhjdsavw"

[functions.debate]
verify_jwt = false
```

Only the `debate` function has explicit config — JWT verification is disabled. All other functions use default settings (JWT verification enabled, but calls with the anon key in the `Authorization` header pass through).

---

## Error Handling Patterns

### Edge Function Error Responses

All functions return structured JSON errors with appropriate HTTP status codes:

| Status | Meaning | Example |
|---|---|---|
| 400 | Invalid input | `{ "error": "text and voiceId are required" }` |
| 402 | Payment required | `{ "error": "Usage credits exhausted. Please add credits." }` |
| 429 | Rate limited | `{ "error": "Rate limit exceeded. Please wait a moment." }` |
| 500 | Server error | `{ "error": "AI service error" }` |

### Client Error Handling

- **DebateArena:** SSE errors (non-abort) are caught and displayed as a red error message with a "Retry" button that re-calls `runTurn()` with the current history
- **DebateSetup:** personality generation errors surface via `toast.error()`
- **DebateReport:** report generation errors surface via `toast.error()`
- **TTSButton:** playback errors are logged to console (silent failure — doesn't block conversation flow)

### Abort Handling

The `AbortController` pattern is used in `DebateArena`:
- Created fresh for each `runTurn()` call
- Stored in `abortRef` for access from event handlers
- Aborted on: Stop button, Back navigation, component unmount
- `AbortError` is explicitly caught and suppressed (not treated as an error)

---

## Security Model

| Layer | Mechanism |
|---|---|
| **API key isolation** | `LOVABLE_API_KEY` and `ELEVENLABS_API_KEY` are server-side Supabase secrets, inaccessible from the client |
| **Client authentication** | Supabase anon key is used for Edge Function authorization. No user auth — the platform is session-based and anonymous |
| **CORS** | All Edge Functions allow `*` origin (should be restricted in production) |
| **Input validation** | Required fields checked at the Edge Function level; missing fields return 400 |
| **Content filtering** | LLM calls go through the Lovable AI Gateway, which applies upstream content policies. ElevenLabs enforces its own TTS content policy |
| **Prompt integrity** | Mediator messages are prefixed with `[MEDIATOR INTERJECTION]:` to distinguish them from agent outputs. System prompts instruct agents never to break character |
| **Cost control** | TTS text is truncated to 2,000 chars. Response length is user-configurable (1–5). Rate limit errors from upstream APIs are passed through to the UI |
| **Request cancellation** | `AbortController` ensures abandoned requests don't continue consuming resources |

---

*This document reflects the codebase as of the current commit. Component names reference internal file paths — see the [folder structure](README.md#folder-structure) in the README for navigation.*
