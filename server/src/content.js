// Hardcoded game content for the MVP: a single run of handcrafted rooms.
// Schemas follow spec §6. Hidden properties are NEVER sent to the client until
// they are exploited/revealed in a verdict.

// Tools the party starts the run with. Properties are loose, AI-interpretable
// tags (spec §4.1) that both the real judge and the mock judge reason over.
export const STARTER_TOOLS = [
  { id: "spoon", name: "metal spoon", properties: ["metal", "small", "conductive", "lever-ish", "scoop"] },
  { id: "stick", name: "sturdy stick", properties: ["rigid", "leverage", "flammable", "blunt", "long"] },
  { id: "duck", name: "rubber duck", properties: ["rubber", "buoyant", "squeaky", "absurd", "bouncy", "insulating"] },
];

// Rooms are resolved in order. `loot` is added to the shared inventory once the
// obstacle is broken. Final room (last index) ends the run on success.
export const ROOMS = [
  {
    id: "wall",
    obstacle: {
      id: "cracked-wall",
      name: "Cracked Stone Wall",
      visible_description:
        "A thick stone wall blocks the corridor. A hairline crack runs along its base.",
      hidden_properties: ["brittle_base", "load_bearing"],
      integrity: 100,
    },
    loot: { id: "flint", name: "flint & steel", properties: ["spark", "fire-starter", "metal", "small"] },
  },
  {
    id: "portcullis",
    obstacle: {
      id: "rusted-portcullis",
      name: "Rusted Iron Portcullis",
      visible_description:
        "A heavy iron portcullis is jammed shut. The joints are caked in orange rust, and the winch looks wound tight.",
      hidden_properties: ["rusted_joints", "spring_loaded", "weak_point: winch"],
      integrity: 120,
    },
    loot: { id: "oil", name: "glass vial of oil", properties: ["oily", "flammable", "lubricant", "fragile", "liquid"] },
  },
  {
    id: "cube",
    obstacle: {
      id: "gelatinous-cube",
      name: "Sleeping Gelatinous Cube",
      visible_description:
        "A translucent cube of jelly fills the passage, quivering as it sleeps. Half-dissolved bones float inside it.",
      hidden_properties: ["flammable", "acidic", "slow", "weak_point: nucleus"],
      integrity: 140,
      // When it survives a round it lashes out (handled in game.js).
      counterattack: { chance: 0.7, damage: 18, narration: "The cube sloshes awake and slaps an acidic pseudopod across the party." },
    },
    loot: { id: "rope", name: "coil of rope", properties: ["rope", "long", "flexible", "tie", "flammable"] },
  },
  {
    id: "door",
    obstacle: {
      id: "ward-door",
      name: "The Ward-Locked Door",
      visible_description:
        "An immense iron door, humming with a faint blue ward. A carved face in its center wears a smug, expectant smirk.",
      hidden_properties: ["ward_locked", "vain", "heavy", "weak_point: flattery"],
      integrity: 130,
    },
    loot: null, // final room
  },
];

export const ROOM_COUNT = ROOMS.length;
