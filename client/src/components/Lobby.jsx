import { Button, Card, Pill } from "./ui.jsx";

export default function Lobby({ game, playerId, onStart }) {
  const isHost = game.hostId === playerId;

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-6 text-center">
          <p className="text-white/50 text-sm">Lobby code — share it with friends</p>
          <div className="my-4 text-5xl font-black font-mono tracking-[0.4em] text-violet-300">{game.code}</div>

          <div className="space-y-2 my-6 text-left">
            {game.players.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-black/30">
                <span className="font-semibold">
                  {p.name}
                  {p.id === playerId && <span className="text-white/40 text-sm"> (you)</span>}
                </span>
                {p.id === game.hostId ? (
                  <Pill className="bg-amber-500/20 text-amber-300">Host</Pill>
                ) : (
                  <Pill className="bg-emerald-500/20 text-emerald-300">Ready</Pill>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - game.players.length) }).map((_, i) => (
              <div key={i} className="px-4 py-3 rounded-xl border border-dashed border-white/10 text-white/30 text-sm">
                Waiting for a player…
              </div>
            ))}
          </div>

          {isHost ? (
            <Button className="w-full" onClick={onStart}>
              Start run ({game.players.length} {game.players.length === 1 ? "player" : "players"})
            </Button>
          ) : (
            <p className="text-white/50 text-sm animate-pulse-glow">Waiting for the host to start…</p>
          )}
        </Card>
        <p className="text-center text-white/30 text-xs mt-4">
          Judge: {game.judgeMode === "live" ? "live AI (Claude)" : "offline mock judge"}
        </p>
      </div>
    </div>
  );
}
