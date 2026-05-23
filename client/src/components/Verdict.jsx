import { useEffect, useState } from "react";
import { Button, Card, Pill, ScoreMeter } from "./ui.jsx";

const PROP_LABEL = (p) => p.replace(/_/g, " ").replace("weak point:", "weak point —");

// Type-on narration for the streamed-verdict feel (spec §8: verdict-as-spectacle).
function useTypeOn(text, speed = 18) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return shown;
}

export default function Verdict({ verdict, players, isHost, isFinalRoom, onContinue }) {
  const narration = useTypeOn(verdict.narration);
  const { scores, backfire, exploited_property, outcome, final_damage, counter } = verdict;

  const outcomeStyle = {
    success: "from-emerald-500/30 to-emerald-500/5 text-emerald-300",
    partial: "from-amber-500/30 to-amber-500/5 text-amber-300",
    fail: "from-rose-500/30 to-rose-500/5 text-rose-300",
  }[outcome];

  const hurt = (verdict.applied_effects || []).filter((e) => e.type === "player_hurt");
  const toolLost = (verdict.applied_effects || []).find((e) => e.type === "tool_lost");
  const reinforced = (verdict.applied_effects || []).find((e) => e.type === "obstacle_reinforced");

  return (
    <Card className={`p-6 bg-gradient-to-b ${backfire.triggered ? "animate-shake" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full bg-gradient-to-r ${outcomeStyle}`}>
          {outcome}
        </span>
        <span className="text-xs text-white/40">Judge: {verdict.source === "live" ? "live AI" : "mock"}</span>
      </div>

      <p className="text-lg leading-relaxed min-h-[3.5rem]">
        {narration}
        <span className="inline-block w-2 h-5 bg-violet-400 ml-0.5 animate-pulse-glow align-middle" />
      </p>

      <div className="flex flex-wrap gap-2 my-4">
        {exploited_property ? (
          <Pill className="bg-emerald-500/20 text-emerald-300">★ Exploited: {PROP_LABEL(exploited_property)}</Pill>
        ) : (
          <Pill className="bg-white/10 text-white/50">No weakness exploited</Pill>
        )}
        {final_damage > 0 && (
          <Pill className="bg-rose-500/20 text-rose-300">−{final_damage} integrity</Pill>
        )}
        {backfire.triggered && <Pill className="bg-rose-600/30 text-rose-200 animate-pulse-glow">⚠ BACKFIRE (sev {backfire.severity})</Pill>}
        {toolLost && <Pill className="bg-amber-500/20 text-amber-300">Lost: {toolLost.value}</Pill>}
        {reinforced && <Pill className="bg-amber-500/20 text-amber-300">Wall reinforced +{reinforced.value}</Pill>}
      </div>

      {(backfire.triggered && hurt.length > 0) && (
        <div className="text-sm text-rose-300/90 mb-3">
          {hurt.map((h, i) => (
            <div key={i}>💥 {h.playerName} took {h.value} damage from the backfire.</div>
          ))}
        </div>
      )}
      {counter && (
        <div className="text-sm text-rose-300/90 mb-3">↩ {counter.narration} (−{counter.damage} to all)</div>
      )}

      {/* Glass-box scores (spec §5.3 — always surface the why). */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 p-4 rounded-xl bg-black/30">
        <ScoreMeter label="Plausibility" value={scores.plausibility} accent="sky" />
        <ScoreMeter label="Synergy" value={scores.synergy} accent="violet" />
        <ScoreMeter label="Effectiveness" value={scores.effectiveness} accent="emerald" />
        <ScoreMeter label="Creativity" value={scores.creativity} accent="amber" />
      </div>

      {isHost ? (
        <Button className="w-full mt-5" onClick={onContinue}>
          {verdict.obstacle_broken ? (isFinalRoom ? "Claim victory →" : "Advance to next room →") : "Next round →"}
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm mt-5 animate-pulse-glow">Waiting for the host to continue…</p>
      )}
    </Card>
  );
}
