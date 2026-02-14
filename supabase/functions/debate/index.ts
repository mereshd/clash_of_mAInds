import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { debaterA, debaterB, topic, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Determine whose turn it is
    const turnIndex = history ? history.length : 0;
    const isDebaterA = turnIndex % 2 === 0;
    const currentDebater = isDebaterA ? debaterA : debaterB;
    const opponent = isDebaterA ? debaterB : debaterA;

    const systemPrompt = `You are roleplaying as "${currentDebater.name}" in a debate.

PERSONALITY: ${currentDebater.personality}

You are debating against "${opponent.name}" (${opponent.personality}) on the topic: "${topic}"

RULES:
- Stay completely in character as ${currentDebater.name}
- Be passionate, articulate, and persuasive
- Respond to your opponent's points directly when they've spoken
- Keep responses concise (2-4 paragraphs max)
- Use rhetorical techniques fitting your personality
- ${turnIndex === 0 ? "You are giving the OPENING STATEMENT. Set the stage for your position." : "Respond to your opponent's latest argument and advance your own position."}
- Never break character or mention that you are an AI`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add debate history as conversation context
    if (history && history.length > 0) {
      for (const entry of history) {
        const role = entry.debater === currentDebater.name ? "assistant" : "user";
        messages.push({ role, content: entry.content });
      }
    }

    // Add the prompt for next response
    if (turnIndex === 0) {
      messages.push({
        role: "user",
        content: `The debate topic is: "${topic}". Please give your opening statement.`,
      });
    } else {
      messages.push({
        role: "user",
        content: "Please respond to your opponent's argument and make your next point.",
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("debate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
