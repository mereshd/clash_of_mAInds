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
    const { personalities, topic, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const participantList = personalities
      .map((p: any) => `"${p.name}"${p.description ? ` (${p.description})` : ""}`)
      .join(", ");

    const transcript = history
      .map((e: any) => (e.isMediator ? `[Mediator]: ${e.content}` : `[${e.debater}]: ${e.content}`))
      .join("\n\n");

    const systemPrompt = `You are an expert analyst producing a structured report on a multi-perspective conversation.

PARTICIPANTS: ${participantList}
TOPIC: "${topic}"

Analyze the following conversation transcript and produce a report in valid JSON matching this exact structure:

{
  "overview": "A concise 2-3 sentence summary of the entire conversation arc.",
  "keyInsights": ["insight1", "insight2", ...],
  "participants": [
    {
      "name": "Participant Name",
      "summary": "2-3 sentence summary of their overall position and approach.",
      "drivingPoints": ["point1", "point2", ...],
      "keyArguments": ["argument1", "argument2", ...],
      "sentiment": "One of: Strongly Supportive | Supportive | Neutral | Critical | Strongly Critical",
      "finalStance": "One sentence capturing their concluding position."
    }
  ],
  "keyTakeaways": ["takeaway1", "takeaway2", ...]
}

CRITICAL RULES:
- Do NOT repeat the same idea across different sections. Each section must provide unique value.
- "keyInsights" should capture cross-cutting themes or surprising convergences/divergences.
- "drivingPoints" are the core motivations/principles behind a participant's stance.
- "keyArguments" are specific examples, data, or reasoning used to support their position.
- "keyTakeaways" are actionable conclusions or open questions for the reader.
- Keep each array to 2-4 items maximum for conciseness.
- Return ONLY the JSON object, no markdown fences or extra text.`;

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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: transcript },
          ],
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response
    let report;
    try {
      // Try direct parse first
      report = JSON.parse(content);
    } catch {
      // Try extracting from markdown code fences
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        report = JSON.parse(match[1].trim());
      } else {
        throw new Error("Failed to parse report from AI response");
      }
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("debate-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
