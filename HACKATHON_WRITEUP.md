# clash of mAInds — Personality Arena

### AI-Powered Debate Platform with Real-Time Voice Synthesis

---

## Overview

**Personality Arena** (branded as *clash of mAInds*) is an AI-powered debate platform that lets users create two distinct AI personalities and watch them engage in multi-round, real-time debates on any topic. Each debater is given a name, a personality description, and a speaking style — and from there, the AI takes over, generating back-and-forth arguments that are streamed live to the user. Every response can be spoken aloud with distinct, high-fidelity voices powered by ElevenLabs, and the platform also features a live voice agent mode for bidirectional, real-time spoken conversations with an AI.

At its core, this project explores a fundamental question: **What happens when you give an AI a personality and let it argue?** The result is compelling, educational, often hilarious, and surprisingly insightful.

---

## The Problem

Public discourse is broken. People talk past each other, debate has been replaced by soundbites, and critical thinking is declining. Meanwhile, AI is often used passively — you ask it a question, it gives you one answer, and that's the end of the story. There is no tension, no opposing viewpoint, no dialectic.

**Personality Arena** flips the script. Instead of asking AI for *an* answer, we make AI argue with *itself* — from multiple perspectives, with different values, rhetorical styles, and philosophical frameworks. The user doesn't just consume information; they witness the collision of ideas in real time and draw their own conclusions.

---

## How It Works

### 1. Personality Creation

Users define two debaters, each with:

- **A name** — real or fictional (e.g., "Socrates", "Elon Musk", "A Pessimistic Philosopher", "Your Average Redditor")
- **A personality description** — beliefs, speaking style, values, rhetorical tendencies

Preset personalities are available for quick starts: **Socrates** (Socratic method, probing questions), **Elon Musk** (first-principles thinking, bold claims), **Marie Curie** (empirical, methodical), and **Oscar Wilde** (wit, paradox, epigrams).

### 2. Topic Selection

Users enter any debate topic, or pick from curated prompts:
- "Is AI a net positive for humanity?"
- "Should we colonize Mars or fix Earth first?"
- "Is free will an illusion?"
- "Is social media destroying society?"

### 3. The Debate

Once started, the AI conducts a **6-turn debate** (3 rounds per debater), automatically alternating between personalities. Each turn:

1. The frontend sends the full debate history plus personality context to a Supabase Edge Function.
2. The edge function constructs a system prompt that instructs the AI to stay in character, respond directly to the opponent's points, and use rhetorical techniques fitting the personality.
3. The AI model (Google Gemini 3 Flash) generates a response via streaming.
4. The response is streamed back to the browser via Server-Sent Events (SSE), rendering in real time with full Markdown support.
5. After a 1.5-second pause (for dramatic effect), the opponent takes their turn.

Users can **pause and resume** the debate at any time, and a round counter tracks progress.

### 4. Voice Synthesis

Every debate entry has a speaker button that converts the text to speech using **ElevenLabs TTS**. Each debater has a distinct voice:

- **Debater A** uses "Roger" — a deep, authoritative voice
- **Debater B** uses "Alice" — a clear, articulate voice

The voice synthesis uses ElevenLabs' `eleven_turbo_v2_5` model with tuned parameters for stability, similarity, and expressiveness — making each personality sound genuinely different.

### 5. Live Voice Agent

Beyond text debates, the platform includes a **live voice conversation mode** powered by ElevenLabs' Conversational AI. Users connect their microphone and have a real-time, bidirectional spoken conversation with an AI agent over WebRTC — with live transcript display.

---

## Technical Architecture

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| UI Components | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS with custom CSS variables |
| Animations | Framer Motion |
| State | React hooks + local state |
| Markdown | react-markdown |
| Voice SDK | @elevenlabs/react |

### Backend
| Layer | Technology |
|-------|-----------|
| Functions | Supabase Edge Functions (Deno runtime) |
| AI Model | Google Gemini 3 Flash Preview (via Lovable AI Gateway) |
| TTS | ElevenLabs Text-to-Speech API |
| Voice Agent | ElevenLabs Conversational AI (WebRTC) |
| Streaming | Server-Sent Events (SSE) |

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                   Browser (React)                │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Debate   │  │   TTS    │  │  Voice Agent  │  │
│  │  Setup    │  │  Button  │  │  (WebRTC)     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │           │
│  ┌────▼─────────────────────────┐    │           │
│  │      Debate Arena (SSE)      │    │           │
│  └────┬─────────────────────────┘    │           │
└───────┼──────────────┼───────────────┼───────────┘
        │              │               │
   ┌────▼────┐    ┌────▼────┐    ┌─────▼─────┐
   │ /debate │    │ /tts    │    │ /conv-    │
   │  Edge   │    │  Edge   │    │  token    │
   │  Func   │    │  Func   │    │  Edge Func│
   └────┬────┘    └────┬────┘    └─────┬─────┘
        │              │               │
   ┌────▼────┐    ┌────▼────┐    ┌─────▼─────┐
   │ Lovable │    │Eleven   │    │ ElevenLabs│
   │   AI    │    │Labs TTS │    │ ConvAI    │
   │ Gateway │    │  API    │    │   API     │
   │(Gemini) │    └─────────┘    └───────────┘
   └─────────┘
```

### Key Technical Decisions

- **Stateless by design**: No database, no user accounts. Debate sessions live in browser memory. This keeps costs near zero and eliminates data privacy concerns — an important consideration when personalities might generate sensitive or controversial content.
- **Edge Functions as API proxy**: All API keys live server-side in Supabase Edge Functions. The frontend never touches secrets.
- **SSE over WebSockets**: Server-Sent Events provide a simpler, HTTP-native streaming mechanism that works well for the unidirectional flow of AI-generated text.
- **Manual SSE parsing**: Rather than using the browser's `EventSource` API (which doesn't support POST requests or custom headers), the app manually reads the response body stream and parses SSE frames — giving full control over authentication and error handling.

---

## Utility and Real-World Applications

### Education

- **Critical thinking tool**: Students watch AI argue both sides of historical, philosophical, or scientific debates, then analyze the arguments for logical fallacies, rhetorical strength, and evidence quality.
- **Debate preparation**: Debate team members can simulate opponents with specific argumentative styles and see how different personality types respond to their positions.
- **Philosophy education**: Recreate dialogues between historical philosophers (Socrates vs. Nietzsche, Kant vs. Mill) to bring abstract ideas to life.

### Content Creation

- **Podcast and video content**: Generate scripted debates between entertaining personalities with full voice synthesis — ready for content production.
- **Writing inspiration**: Authors and screenwriters can use personality clashes to develop character voices, explore ideological tensions, and prototype dialogue.

### Research and Analysis

- **Policy exploration**: Pit a libertarian against a socialist on universal basic income. Pit an environmentalist against an industrialist on nuclear power. Explore the full spectrum of a complex issue.
- **Bias detection**: Compare how the AI argues for the same position when given different personality frames — revealing how framing shapes argumentation.
- **Argument mapping**: Use generated debates as raw material for formal argument analysis.

### Entertainment

- **Historical "what if" debates**: What would Abraham Lincoln say to a modern tech CEO about freedom? What would Einstein and Shakespeare argue about the nature of beauty?
- **Character battles**: Pop culture characters debating each other — Tony Stark vs. Batman on the ethics of vigilantism.
- **Party game**: Let friends define absurd personalities and watch the AI try to make coherent arguments from ridiculous positions.

### Accessibility

- **Voice-first interaction**: The ElevenLabs voice synthesis makes debates accessible to visually impaired users and creates an experience closer to listening to a real debate or podcast.
- **Live voice agent**: The WebRTC voice conversation mode enables hands-free, spoken interaction for users who prefer or require audio interfaces.

---

## What Makes This Different

| Feature | Typical AI Chatbot | Personality Arena |
|---------|-------------------|-------------------|
| Perspectives | Single response | Two opposing viewpoints |
| Personality | Generic assistant | Fully customizable characters |
| Interaction | Q&A format | Autonomous debate format |
| Voice | Text only (usually) | Distinct voices per character |
| Critical thinking | Answers given | Arguments presented, user decides |
| Engagement | Passive | Active (watching a live debate unfold) |

---

## Current Limitations and Planned Improvements

### Short-Term Enhancements

- **Debate persistence**: Add Supabase database tables to save debate history, allow users to revisit and share past debates.
- **Audience voting**: Let users (or a crowd) vote on who won each round, creating a leaderboard of the most persuasive personality configurations.
- **Configurable round count**: Let users choose between quick 2-round exchanges and extended 10-round deep dives.
- **Auto-play TTS**: Automatically speak each debate entry as it completes, creating a fully hands-free "AI podcast" experience.
- **Shareable debate links**: Generate public URLs for completed debates so users can share them on social media.

### Medium-Term Features

- **Judge AI**: Introduce a third AI personality that acts as a judge — scoring arguments on logic, evidence, rhetoric, and persuasiveness after each round, then declaring a winner.
- **Multi-party debates**: Extend beyond 2 debaters to support panel discussions with 3-5 personalities.
- **Custom voice cloning**: Let users upload voice samples to create custom voices for their debaters using ElevenLabs voice cloning.
- **Debate templates**: Pre-built debate formats (Oxford style, Lincoln-Douglas, parliamentary) with structured turn-taking rules.
- **User authentication**: Add login and profiles so users can build a library of personalities and debate histories.

### Long-Term Vision

- **Real-time audience participation**: WebSocket-powered live events where audiences watch debates and influence them with live polls and questions.
- **Personality marketplace**: A community library of user-created personality presets that others can import and use.
- **Educational curriculum integration**: Packaged lesson plans for teachers, with debate assignments that students can run and analyze.
- **API for developers**: Expose the debate engine as an API so other apps can embed AI debates into their products.
- **Multi-language support**: Generate debates in different languages, making the platform accessible globally.
- **Fine-tuned debate models**: Train specialized models on high-quality debate transcripts to improve argument quality, coherence, and rhetorical sophistication.

---

## Possibilities and Broader Impact

**Personality Arena** sits at the intersection of several powerful trends:

1. **AI as a mirror for human thought**: By giving AI specific personalities and forcing it to argue, we create a tool that reflects human reasoning patterns back at us — making biases, logical structures, and rhetorical strategies visible and analyzable.

2. **The death of the single-answer paradigm**: Most AI tools give you one answer. But complex questions don't have one answer. This platform embraces plurality of thought and teaches users that intelligence isn't about having the right answer — it's about understanding the landscape of possible answers.

3. **Voice as the next interface**: With ElevenLabs' voice synthesis and conversational AI, we're moving beyond text-on-screen toward experiences that feel like listening to a real debate. As voice AI improves, the line between "AI-generated content" and "produced media" will blur — and platforms like this will be at the forefront.

4. **Democratizing rhetoric education**: Understanding how arguments are constructed, how rhetoric works, and how to identify fallacies is a skill traditionally taught in elite institutions. This platform makes that education accessible, interactive, and free.

5. **Human-AI collaboration in content creation**: Rather than replacing human creativity, Personality Arena augments it. A podcaster can generate a debate skeleton and then refine it. A teacher can create a Socratic dialogue as a starting point for classroom discussion. A writer can use character clashes to find their characters' voices.

---

## Tech Stack Summary

- **React 18** + **TypeScript** + **Vite** — Modern, fast frontend
- **Tailwind CSS** + **shadcn/ui** + **Framer Motion** — Beautiful, animated UI
- **Supabase Edge Functions** (Deno) — Serverless backend
- **Google Gemini 3 Flash** — Fast, capable AI model for debate generation
- **ElevenLabs** — Industry-leading voice synthesis and conversational AI
- **Server-Sent Events** — Real-time streaming without WebSocket complexity
- **WebRTC** — Low-latency bidirectional voice communication

---

## Running the Project

```bash
# Install dependencies
npm install

# Set environment variables
# VITE_SUPABASE_URL=<your-supabase-url>
# VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>

# Start development server
npm run dev
```

Supabase Edge Functions require:
- `LOVABLE_API_KEY` — for the AI gateway
- `ELEVENLABS_API_KEY` — for voice synthesis and conversational AI

---

## Conclusion

**Personality Arena** is more than a hackathon project — it's a proof of concept for a new category of AI application: **multi-perspective AI**. Instead of asking "What does AI think?", we ask "What would *these two minds* think — and how would they disagree?"

The result is a platform that is simultaneously entertaining, educational, and thought-provoking. It combines cutting-edge AI (Gemini 3 Flash), state-of-the-art voice synthesis (ElevenLabs), and modern web architecture (React + Supabase Edge Functions + SSE) into an experience that feels genuinely novel.

In a world drowning in AI-generated content, the value isn't in getting *more* answers — it's in getting *better questions*. Personality Arena gives you two minds, a topic, and a front-row seat to the clash. You decide who wins.

---

*Built for hackathon submission — February 2026*
