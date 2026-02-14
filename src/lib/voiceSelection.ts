// ElevenLabs voice pools by perceived gender
const MALE_VOICES = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
];

const FEMALE_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
];

const FEMALE_INDICATORS = [
  "she", "her", "woman", "female", "girl", "lady", "queen", "princess", "mother", "mom",
  "grandmother", "sister", "daughter", "aunt", "niece", "goddess", "empress", "baroness",
  "duchess", "countess", "miss", "mrs", "ms",
  "mary", "sarah", "jessica", "jennifer", "amanda", "elizabeth", "emily", "emma",
  "olivia", "sophia", "isabella", "mia", "charlotte", "amelia", "harper", "evelyn",
  "abigail", "ella", "scarlett", "grace", "lily", "aria", "zoey", "riley",
  "laura", "alice", "matilda", "victoria", "catherine", "margaret", "diana",
  "cleopatra", "marie", "rosa", "frida", "oprah", "beyonce", "taylor",
  "hillary", "kamala", "angela", "indira", "malala",
];

const MALE_INDICATORS = [
  "he", "him", "man", "male", "boy", "king", "prince", "father", "dad",
  "grandfather", "brother", "son", "uncle", "nephew", "god", "emperor", "baron",
  "duke", "count", "sir", "mr", "lord",
  "james", "john", "robert", "michael", "william", "david", "richard", "joseph",
  "thomas", "charles", "daniel", "matthew", "andrew", "george", "roger", "brian",
  "chris", "eric", "liam", "noah", "oliver", "benjamin", "lucas", "henry",
  "alexander", "jack", "donald", "barack", "elon", "mark", "jeff", "bill",
  "steve", "albert", "isaac", "nikola", "aristotle", "plato", "socrates",
  "gandhi", "napoleon", "lincoln", "churchill", "einstein", "tesla", "marx",
];

function detectGender(name: string, personality: string): "male" | "female" | "unknown" {
  const text = `${name} ${personality}`.toLowerCase();
  let maleScore = 0;
  let femaleScore = 0;
  for (const indicator of FEMALE_INDICATORS) {
    if (text.includes(indicator)) femaleScore++;
  }
  for (const indicator of MALE_INDICATORS) {
    if (text.includes(indicator)) maleScore++;
  }
  if (femaleScore > maleScore) return "female";
  if (maleScore > femaleScore) return "male";
  return "unknown";
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Select distinct voices for two debaters (legacy).
 */
export function selectVoices(
  debaterA: { name: string; personality: string },
  debaterB: { name: string; personality: string }
): [string, string] {
  const result = selectVoicesForMany([debaterA, debaterB]);
  return [result[0], result[1]];
}

/**
 * Select distinct voices for N personalities.
 */
export function selectVoicesForMany(
  participants: { name: string; personality: string }[]
): string[] {
  const usedIds = new Set<string>();
  const result: string[] = [];

  for (const p of participants) {
    const gender = detectGender(p.name, p.personality);
    const pool = gender === "female" ? FEMALE_VOICES : MALE_VOICES;
    const baseIdx = hashString(p.name + p.personality) % pool.length;

    let voice = pool[baseIdx];
    let offset = 0;
    while (usedIds.has(voice.id) && offset < pool.length) {
      offset++;
      voice = pool[(baseIdx + offset) % pool.length];
    }

    usedIds.add(voice.id);
    result.push(voice.id);
  }

  return result;
}
