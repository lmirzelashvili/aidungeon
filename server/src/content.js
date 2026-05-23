// Hardcoded game content for the MVP. Level 1 is a handcrafted, designed run:
// a loot chain (each room's loot is the key to a later room), archetype variety
// (barrier / mechanism / monster / hazard / trap / social boss), and weaknesses
// telegraphed in the visible_description so deduction is fair (glass-box, §6).
//
// Schemas follow spec §6. `hidden_properties` and `hazard` are NEVER sent to the
// client until exploited/revealed in a verdict — see GameSession.publicState.

// Tools the party starts the run with. Properties are loose, AI-interpretable
// tags (spec §4.1) that both the real judge and the mock judge reason over.
export const STARTER_TOOLS = [
  { id: "spoon", name: "metal spoon", properties: ["metal", "small", "conductive", "lever-ish", "scoop"] },
  { id: "stick", name: "sturdy stick", properties: ["rigid", "leverage", "flammable", "blunt", "long"] },
  { id: "duck", name: "rubber duck", properties: ["rubber", "buoyant", "squeaky", "absurd", "bouncy", "insulating"] },
];

// Rooms are resolved in order. `loot` is added to the shared inventory once the
// obstacle is broken. The final room (last index) ends the run on success.
//
// A room's loot is deliberately the setup for a LATER room:
//   flint (R1) → burns the cube (R3) and is a hazard in the gas gallery (R5)
//   oil   (R2) → fuel + lubricant for the cube/mechanisms
//   rope  (R3) → secures you against the drowned stair's current (R4)
//   diving helmet (R4) → lets you breathe through the gas gallery (R5)
//   silver platter (R5) → flatters the vain boss with its own reflection (R6)
export const ROOMS = [
  {
    id: "wall",
    obstacle: {
      id: "cracked-wall",
      name: "Cracked Stone Wall",
      visible_description:
        "A thick stone wall blocks the corridor. A hairline crack runs along its base, and the whole slab looks like it's holding up the ceiling.",
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
        "A heavy iron portcullis is jammed shut. The joints are caked in flaking orange rust, and the winch that raises it looks wound tight as a trap.",
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
        "A translucent cube of jelly fills the passage, quivering as it sleeps. Half-dissolved bones — and a tinker's tools — float inside it.",
      hidden_properties: ["flammable", "acidic", "slow", "weak_point: nucleus"],
      integrity: 140,
      // When it survives a round it lashes out (handled in game.js).
      counterattack: { chance: 0.7, damage: 18, narration: "The cube sloshes awake and slaps an acidic pseudopod across the party." },
    },
    loot: { id: "rope", name: "coil of rope", properties: ["rope", "long", "flexible", "tie", "flammable"] },
  },
  {
    id: "stair",
    obstacle: {
      id: "drowned-stair",
      name: "The Drowned Stair",
      visible_description:
        "The stair plunges into black floodwater that fills the chamber to the ceiling. A cold current tugs at everything, and a rusted valve wheel juts from the far wall, half-submerged.",
      hidden_properties: ["deep_water", "strong_current", "slippery", "weak_point: sluice_valve"],
      integrity: 130,
    },
    loot: { id: "helmet", name: "brass diving helmet", properties: ["airtight", "heavy", "glass-visor", "protective", "metal", "absurd"] },
  },
  {
    id: "gallery",
    obstacle: {
      id: "choking-gallery",
      name: "The Choking Gallery",
      visible_description:
        "A long gallery, its air shimmering a sickly green. Bubbles of marsh-gas rise from the flooded floor and a corroded vent-crank sits in an alcove. The haze stings your eyes — and your flint suddenly feels like a very bad idea.",
      hidden_properties: ["flammable_gas", "low_visibility", "weak_point: vent"],
      integrity: 90,
      // Trap: bringing an open flame into the gas ignites it. Handled by the live
      // judge via flammable_gas; the mock judge enforces it via this hazard block.
      hazard: {
        trigger_keywords: ["ignite", "light the", "light a", "set it alight", "set alight", "open flame", "strike a spark", "burn it", "burn the", "make a fire", "torch the", "flick the flint", "spark the flint"],
        severity: 6,
        effect: "gas_ignites",
        narration:
          "The flame meets the marsh-gas in a thunderclap of blue fire — the gallery becomes a furnace, and the party is flung back, singed and ears ringing.",
      },
    },
    loot: { id: "platter", name: "polished silver platter", properties: ["reflective", "shiny", "metal", "rigid", "absurd"] },
  },
  {
    id: "door",
    obstacle: {
      id: "ward-door",
      name: "The Ward-Locked Door",
      visible_description:
        "An immense iron door, humming with a faint blue ward. A carved face in its center wears a smug, expectant smirk — it clearly thinks very highly of itself.",
      hidden_properties: ["ward_locked", "vain", "heavy", "weak_point: flattery"],
      integrity: 160,
    },
    loot: null, // final room
  },
];

export const LEVEL = {
  id: "level-1",
  name: "The Drowned Keep",
  subtitle: "Level 1 — six rooms between you and daylight",
  intro:
    "A keep that sank into the mire, taking a tinker-king and his hoard of half-clever ideas with it. The water's risen, the locks have rusted, and something in the dark is still hungry. Talk your way down — and back up.",
  rooms: ROOMS,
};

export const ROOM_COUNT = ROOMS.length;
