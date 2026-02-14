import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Derive voice settings from personality traits
function deriveVoiceSettings(name?: string, description?: string) {
  const text = `${name || ""} ${description || ""}`.toLowerCase();

  // Defaults
  let stability = 0.45;
  let similarityBoost = 0.75;
  let style = 0.45;
  let speed = 1.0;

  // Calm, philosophical, measured characters → higher stability, lower style
  const calmIndicators = ["philosopher", "wise", "calm", "stoic", "thoughtful", "measured", "monk", "sage", "meditat", "contemplat", "serene", "patient", "rational", "logical", "analytic"];
  const calmScore = calmIndicators.filter(w => text.includes(w)).length;
  if (calmScore > 0) {
    stability = Math.min(0.85, stability + calmScore * 0.1);
    style = Math.max(0.1, style - calmScore * 0.08);
    speed = Math.max(0.85, speed - calmScore * 0.03);
  }

  // Energetic, passionate, bold characters → lower stability, higher style
  const energeticIndicators = ["entrepreneur", "bold", "energetic", "passionate", "revolutionary", "fiery", "intense", "radical", "visionary", "disrupt", "innovator", "maverick", "rebel", "provocat"];
  const energeticScore = energeticIndicators.filter(w => text.includes(w)).length;
  if (energeticScore > 0) {
    stability = Math.max(0.2, stability - energeticScore * 0.08);
    style = Math.min(0.9, style + energeticScore * 0.1);
    speed = Math.min(1.15, speed + energeticScore * 0.03);
  }

  // Authoritative, commanding characters → high stability, high similarity
  const authorityIndicators = ["leader", "president", "general", "commander", "king", "queen", "emperor", "authorit", "powerful", "commanding", "military", "dictator"];
  const authorityScore = authorityIndicators.filter(w => text.includes(w)).length;
  if (authorityScore > 0) {
    stability = Math.min(0.8, stability + authorityScore * 0.08);
    similarityBoost = Math.min(0.95, similarityBoost + authorityScore * 0.05);
    speed = Math.max(0.9, speed - authorityScore * 0.02);
  }

  // Humorous, comedic characters → low stability, high style
  const humorIndicators = ["comedian", "funny", "humorous", "satirist", "witty", "sarcastic", "comic", "jest", "playful", "whimsical"];
  const humorScore = humorIndicators.filter(w => text.includes(w)).length;
  if (humorScore > 0) {
    stability = Math.max(0.2, stability - humorScore * 0.1);
    style = Math.min(0.85, style + humorScore * 0.12);
  }

  // Academic, scientific characters → moderate-high stability
  const academicIndicators = ["scientist", "professor", "researcher", "academic", "scholar", "physicist", "mathematician", "biologist", "engineer", "doctor", "intellectual"];
  const academicScore = academicIndicators.filter(w => text.includes(w)).length;
  if (academicScore > 0) {
    stability = Math.min(0.75, stability + academicScore * 0.06);
    speed = Math.max(0.9, speed - academicScore * 0.02);
  }

  return {
    stability: Math.round(stability * 100) / 100,
    similarity_boost: Math.round(similarityBoost * 100) / 100,
    style: Math.round(style * 100) / 100,
    use_speaker_boost: true,
    speed: Math.round(speed * 100) / 100,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, personalityName, personalityDescription } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    if (!text || !voiceId) {
      return new Response(
        JSON.stringify({ error: "text and voiceId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const voiceSettings = deriveVoiceSettings(personalityName, personalityDescription);
    console.log(`TTS for "${personalityName}": stability=${voiceSettings.stability}, style=${voiceSettings.style}, speed=${voiceSettings.speed}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `TTS failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
