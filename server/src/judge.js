// The AI world-judge (spec §5). Splits fuzzy (AI scores a rubric + narrates) from
// deterministic (game.js computes damage/backfire). When ANTHROPIC_API_KEY is set
// we call Claude with forced tool-use to guarantee the strict §5.2 schema; otherwise
// we fall back to a heuristic mock judge so the game is fully playable offline.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.JUDGE_MODEL || "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are the WORLD and the JUDGE of a co-op dungeon game. You are consistent, fair, and
have a dry, theatrical sense of humor. You are NOT out to get the players — you enforce
the world's logic.

You receive an obstacle (with hidden properties and integrity), the players' available
tools, and each player's written action for this round.

Your job:
1. Judge the COMBINED attempt against the world's physics and the obstacle's real
   properties. Players can only act through tools they actually have.
2. Reward SYNERGY: actions that set up and build on each other should score far higher
   than uncoordinated parallel actions.
3. Reward exploiting the obstacle's true weakness; ignore-the-weakness brute force does little.
4. Enforce CONSEQUENCES for overreach, not rejection. If an action ignores physics
   (e.g. superhuman feats, powers they don't have, ignoring gravity), it BACKFIRES in-fiction,
   scaled to how absurd it was. Prefer creating a bad STATE over instant death. Never punish
   reasonable creativity on a technicality. Punish arrogance with wit.
5. Players who anticipate and account for consequences in their action should NOT backfire.

Call the submit_verdict tool with your ruling. Keep "narration" to 1-2 punchy, dramatic,
slightly funny sentences — it will be shown as the spectacle moment.`;

// Tool schema mirrors the strict §5.2 output. Forcing this tool guarantees structure.
const VERDICT_TOOL = {
  name: "submit_verdict",
  description: "Submit your structured ruling for this round.",
  input_schema: {
    type: "object",
    properties: {
      scores: {
        type: "object",
        properties: {
          plausibility: { type: "integer", minimum: 0, maximum: 10, description: "Does it obey the world + use real tool properties?" },
          synergy: { type: "integer", minimum: 0, maximum: 10, description: "Do the actions build on each other into a combo?" },
          effectiveness: { type: "integer", minimum: 0, maximum: 10, description: "How well does it target the obstacle's actual weakness?" },
          creativity: { type: "integer", minimum: 0, maximum: 10, description: "Cleverness bonus (small weight)." },
        },
        required: ["plausibility", "synergy", "effectiveness", "creativity"],
      },
      exploited_property: { type: ["string", "null"], description: "Which hidden property they exploited, or null if missed." },
      backfire: {
        type: "object",
        properties: {
          triggered: { type: "boolean" },
          severity: { type: "integer", minimum: 0, maximum: 10 },
          effect: { type: ["string", "null"], description: "e.g. spoon_destroyed, p2_off_balance, wall_reinforced" },
          target: { type: ["string", "null"], description: "playerId or tool id affected, or null" },
        },
        required: ["triggered", "severity", "effect", "target"],
      },
      outcome: { type: "string", enum: ["success", "partial", "fail"] },
      narration: { type: "string", description: "1-2 punchy dramatic sentences, shown as the spectacle." },
    },
    required: ["scores", "exploited_property", "backfire", "outcome", "narration"],
  },
};

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function judgeMode() {
  return getClient() ? "live" : "mock";
}

// Build the §5.1 input payload the judge reasons over. Hidden properties ARE sent
// to the judge (it plays the world) but never to the client until revealed.
function buildJudgeInput({ obstacle, inventory, players, round }) {
  return {
    obstacle: {
      name: obstacle.name,
      visible_description: obstacle.visible_description,
      hidden_properties: obstacle.hidden_properties,
      integrity: obstacle.integrity,
    },
    inventory: inventory.map((t) => ({ id: t.id, name: t.name, properties: t.properties })),
    players: players.map((p) => ({ id: p.id, name: p.name, health: p.health, action: p.action })),
    round,
  };
}

export async function adjudicate(input) {
  const api = getClient();
  if (!api) return mockJudge(input);

  try {
    const payload = buildJudgeInput(input);
    const resp = await api.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.4, // low temp for fairness/consistency (spec §9, §14)
      system: SYSTEM_PROMPT,
      tools: [VERDICT_TOOL],
      tool_choice: { type: "tool", name: "submit_verdict" },
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const block = resp.content.find((c) => c.type === "tool_use" && c.name === "submit_verdict");
    if (!block) throw new Error("judge returned no tool_use block");
    return { ...normalizeVerdict(block.input), source: "live" };
  } catch (err) {
    console.error("[judge] live call failed, falling back to mock:", err.message);
    return { ...mockJudge(input), source: "mock-fallback" };
  }
}

// Clamp/sanitize whatever the model returned into the canonical shape.
function normalizeVerdict(v) {
  const clamp = (n) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  const s = v.scores || {};
  return {
    scores: {
      plausibility: clamp(s.plausibility),
      synergy: clamp(s.synergy),
      effectiveness: clamp(s.effectiveness),
      creativity: clamp(s.creativity),
    },
    exploited_property: v.exploited_property || null,
    backfire: {
      triggered: !!v.backfire?.triggered,
      severity: clamp(v.backfire?.severity),
      effect: v.backfire?.effect || null,
      target: v.backfire?.target || null,
    },
    outcome: ["success", "partial", "fail"].includes(v.outcome) ? v.outcome : "partial",
    narration: String(v.narration || "").trim() || "The dust settles. Something happened.",
  };
}

// ---------------------------------------------------------------------------
// Mock judge: heuristic stand-in so the game runs with no API key. It is not
// meant to be as good as Claude — just consistent and demonstrative.
// ---------------------------------------------------------------------------

const GODMODE_PATTERNS = [
  /\b\d{2,}\s?(m|meters|metres|feet|ft|miles|km)\b/i, // "leap 100 meters"
  /\b(fly|teleport|levitate|instantly|god|infinite|invincible|one[\s-]?shot|nuke|laser|explode the universe|summon)\b/i,
  /\bwith my (mind|powers|magic)\b/i,
];

function mentions(text, words) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

function mockJudge({ obstacle, inventory, players }) {
  const combined = players.map((p) => p.action || "").join(" \n ");
  const lc = combined.toLowerCase();

  // plausibility: penalize godmode language and using tools you don't have.
  let plausibility = 7;
  const overreach = GODMODE_PATTERNS.some((re) => re.test(combined));
  if (overreach) plausibility = 2;
  // reward referencing real tools
  const toolHits = inventory.filter((t) => mentions(lc, [t.name.toLowerCase(), t.id])).length;
  plausibility = Math.min(10, plausibility + Math.min(2, toolHits));
  // accounting for consequences avoids backfire
  const cautious = mentions(lc, ["brace", "careful", "roll", "kill momentum", "step back", "shield", "anchor", "slowly"]);
  if (overreach && cautious) plausibility = Math.min(10, plausibility + 3);

  // synergy: do later actions reference teammates or prior setup?
  let synergy = players.length > 1 ? 3 : 1;
  const names = players.map((p) => p.name.toLowerCase());
  const refsTeammate = players.some((p, i) =>
    names.some((n, j) => j !== i && p.action?.toLowerCase().includes(n))
  );
  const buildWords = mentions(lc, ["the spoon", "the stick", "wedged", "lever", "then", "now that", "while", "use it", "on top", "underneath", "ignite", "light the"]);
  if (refsTeammate) synergy += 4;
  if (buildWords) synergy += 3;
  synergy = Math.min(10, synergy);

  // effectiveness + exploited weakness: match action language to hidden props.
  const propKeywords = {
    brittle_base: ["base", "crack", "bottom", "foundation"],
    load_bearing: ["base", "support", "topple", "collapse"],
    rusted_joints: ["rust", "joint", "oil", "lubricat", "hinge"],
    spring_loaded: ["winch", "release", "spring", "cut the", "trigger"],
    "weak_point: winch": ["winch", "gear", "mechanism"],
    flammable: ["fire", "burn", "ignite", "light", "spark", "flame", "heat"],
    acidic: ["neutralize", "scoop", "avoid the", "from above"],
    slow: ["quick", "fast", "before it", "while it sleeps"],
    "weak_point: nucleus": ["nucleus", "core", "center", "centre", "heart"],
    ward_locked: ["ward", "rune", "magic", "dispel"],
    vain: ["flatter", "compliment", "praise", "beautiful", "handsome", "smart", "wonderful", "best"],
    heavy: ["leverage", "lever", "pry", "winch"],
    "weak_point: flattery": ["flatter", "compliment", "praise", "tell it", "say it"],
  };
  let exploited = null;
  for (const prop of obstacle.hidden_properties) {
    const kws = propKeywords[prop] || [];
    if (kws.length && mentions(lc, kws)) {
      exploited = prop;
      break;
    }
  }
  let effectiveness = 4;
  if (exploited) effectiveness += 4;
  if (toolHits > 0) effectiveness += 1;
  if (buildWords || refsTeammate) effectiveness += 1;
  effectiveness = Math.min(10, effectiveness);

  // creativity: reward variety/length lightly.
  const creativity = Math.min(10, 3 + Math.min(4, Math.round(combined.length / 60)) + (overreach ? 2 : 0));

  // backfire on overreach (unless they accounted for it).
  let backfire = { triggered: false, severity: 0, effect: null, target: null };
  if (plausibility < 3) {
    const victim = players[Math.floor(Math.random() * players.length)];
    backfire = {
      triggered: true,
      severity: 7,
      effect: `${victim.id}_off_balance`,
      target: victim.id,
    };
  }

  const outcome = effectiveness >= 7 && plausibility >= 4 ? "success" : plausibility < 3 ? "fail" : "partial";

  return {
    scores: { plausibility, synergy, effectiveness, creativity },
    exploited_property: exploited,
    backfire,
    outcome,
    narration: mockNarration({ obstacle, exploited, overreach, backfire, outcome, players }),
    source: "mock",
  };
}

function mockNarration({ obstacle, exploited, overreach, backfire, outcome, players }) {
  if (backfire.triggered) {
    const who = players.find((p) => p.id === backfire.target)?.name || "someone";
    return `Physics, ever the killjoy, declines the request — ${who} ends up sprawled and exposed while the ${obstacle.name} doesn't so much as flinch.`;
  }
  if (outcome === "success") {
    return exploited
      ? `A clean hit on its weak point — the ${obstacle.name} buckles with a deeply satisfying crunch.`
      : `Not elegant, but it works: the ${obstacle.name} gives ground under the assault.`;
  }
  if (outcome === "fail") {
    return `The plan fizzles. The ${obstacle.name} seems almost insulted on your behalf.`;
  }
  return overreach
    ? `It half-works through sheer audacity — the ${obstacle.name} is rattled but still standing.`
    : `A solid effort chips away at the ${obstacle.name}; it's hurting, but not done.`;
}
