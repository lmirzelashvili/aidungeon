import { useState, useEffect } from "react";
import { Button, Card, Pill, Bar } from "./ui.jsx";
import Verdict from "./Verdict.jsx";

const PROP_LABEL = (p) => p.replace(/_/g, " ").replace("weak point:", "weak point —");

export default function Game({ game, playerId, submit, cont, newRun }) {
  const me = game.players.find((p) => p.id === playerId);
  const isHost = game.hostId === playerId;
  const isFinalRoom = game.roomIndex + 1 >= game.roomCount;

  if (game.phase === "won") return <EndScreen win isHost={isHost} game={game} onNewRun={newRun} />;
  if (game.phase === "lost") return <EndScreen win={false} isHost={isHost} game={game} onNewRun={newRun} />;

  return (
    <div className="min-h-full max-w-5xl mx-auto p-4 sm:p-6">
      <Header game={game} />

      {game.roomIndex === 0 && game.round === 1 && game.phase === "planning" && game.level?.intro && (
        <Card className="p-4 mt-4 border-violet-500/20 bg-violet-500/5">
          <p className="text-xs uppercase tracking-wide text-violet-300/80 font-bold">{game.level.subtitle}</p>
          <p className="text-sm text-white/60 mt-1 leading-relaxed">{game.level.intro}</p>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4 mt-4">
        {/* Left column: world + party */}
        <div className="space-y-4">
          <ObstacleCard obstacle={game.obstacle} />
          <InventoryCard inventory={game.inventory} />
          <PartyCard players={game.players} playerId={playerId} currentTurn={game.currentTurnPlayerId} />
        </div>

        {/* Right column: the action / verdict */}
        <div className="space-y-4">
          {game.phase === "planning" && (
            <PlanningPanel game={game} me={me} submit={submit} />
          )}
          {game.phase === "adjudicating" && <Deliberating />}
          {game.phase === "verdict" && game.verdict && (
            <Verdict
              verdict={game.verdict}
              players={game.players}
              isHost={isHost}
              isFinalRoom={isFinalRoom}
              onContinue={cont}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ game }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-black bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent leading-none">
            Prompt &amp; Circumstance
          </h1>
          {game.level?.name && <p className="text-xs text-white/40 mt-0.5">{game.level.name}</p>}
        </div>
        {game.mode === "coop" && <Pill className="bg-white/10 text-white/60 font-mono">{game.code}</Pill>}
      </div>
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Pill className="bg-violet-500/15 text-violet-200">Room {game.roomIndex + 1}/{game.roomCount}</Pill>
        <Pill className="bg-white/10 text-white/60">Round {game.round}</Pill>
      </div>
    </div>
  );
}

function ObstacleCard({ obstacle }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold">{obstacle.name}</h2>
      </div>
      <p className="text-white/60 text-sm mt-1.5 leading-relaxed">{obstacle.visible_description}</p>
      <div className="mt-4">
        <Bar value={obstacle.integrity} max={obstacle.integrityMax} color="rose" label="Integrity" />
      </div>
      {obstacle.revealed_properties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="text-xs text-white/40 mr-1 self-center">Discovered:</span>
          {obstacle.revealed_properties.map((p) => (
            <Pill key={p} className="bg-emerald-500/20 text-emerald-300">★ {PROP_LABEL(p)}</Pill>
          ))}
        </div>
      )}
    </Card>
  );
}

function InventoryCard({ inventory }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-white/70 mb-3 uppercase tracking-wide">Shared inventory</h3>
      <div className="space-y-2">
        {inventory.map((t) => (
          <div key={t.id} className="px-3 py-2 rounded-lg bg-black/30">
            <div className="font-semibold text-sm">{t.name}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {t.properties.map((p) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{p}</span>
              ))}
            </div>
          </div>
        ))}
        {inventory.length === 0 && <p className="text-white/30 text-sm">Nothing left. Improvise with your bare hands.</p>}
      </div>
    </Card>
  );
}

function PartyCard({ players, playerId, currentTurn }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-white/70 mb-3 uppercase tracking-wide">Party</h3>
      <div className="space-y-3">
        {players.map((p) => (
          <div key={p.id}>
            <div className="flex justify-between text-sm mb-1">
              <span className={`font-semibold ${p.health <= 0 ? "line-through text-white/30" : ""}`}>
                {p.name}
                {p.id === playerId && <span className="text-white/40"> (you)</span>}
                {p.id === currentTurn && <span className="ml-2 text-violet-300 text-xs animate-pulse-glow">● acting</span>}
              </span>
            </div>
            <Bar value={p.health} max={100} color={p.health > 30 ? "emerald" : "rose"} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlanningPanel({ game, me, submit }) {
  const [text, setText] = useState("");
  const myTurn = game.currentTurnPlayerId === me?.id;
  const meDead = me && me.health <= 0;
  const submitted = game.players.filter((p) => p.submitted);
  const current = game.players.find((p) => p.id === game.currentTurnPlayerId);

  useEffect(() => {
    setText("");
  }, [game.round, game.roomIndex, game.currentTurnPlayerId]);

  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-white/70 mb-1 uppercase tracking-wide">Plan your move</h3>
      <p className="text-xs text-white/40 mb-4">
        Turn order — build on your teammates' setups. Use the tools you actually have. Overreach has consequences.
      </p>

      {submitted.length > 0 && (
        <div className="space-y-2 mb-4">
          {submitted.map((p) => (
            <div key={p.id} className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <span className="text-violet-300 text-xs font-semibold">{p.name} did:</span>
              <p className="text-sm text-white/80 mt-0.5">{p.action}</p>
            </div>
          ))}
        </div>
      )}

      {myTurn && !meDead ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. I jam the stick under the spoon Jack wedged and lever down hard…"
            maxLength={600}
            rows={4}
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-violet-500 resize-none text-sm leading-relaxed"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-white/30">{text.length}/600</span>
            <Button disabled={!text.trim()} onClick={() => submit(text)}>
              Lock in action
            </Button>
          </div>
        </>
      ) : meDead ? (
        <p className="text-rose-300/70 text-sm">You're down. Your teammates carry the round.</p>
      ) : (
        <p className="text-white/50 text-sm animate-pulse-glow">
          Waiting for <span className="text-violet-300 font-semibold">{current?.name}</span> to act…
        </p>
      )}
    </Card>
  );
}

function Deliberating() {
  return (
    <Card className="p-10 text-center">
      <div className="text-4xl animate-pulse-glow">⚖️</div>
      <p className="mt-4 text-white/70 font-semibold">The world deliberates…</p>
      <p className="text-white/40 text-sm mt-1">Weighing physics, hubris, and dumb luck.</p>
    </Card>
  );
}

function EndScreen({ win, isHost, game, onNewRun }) {
  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <Card className="p-8 text-center max-w-md w-full">
        <div className="text-6xl mb-4">{win ? "🏆" : "💀"}</div>
        <h2 className={`text-3xl font-black ${win ? "text-emerald-300" : "text-rose-300"}`}>
          {win ? "Run complete!" : "Party wiped"}
        </h2>
        <p className="text-white/60 mt-2">
          {win
            ? "You talked your way through the whole dungeon. The bards will sing of this nonsense."
            : "The dungeon wins this round. The bards will sing of this nonsense too — less flatteringly."}
        </p>
        <p className="text-white/40 text-sm mt-4">Rooms cleared: {win ? game.roomCount : game.roomIndex} / {game.roomCount}</p>
        {isHost ? (
          <Button className="w-full mt-6" onClick={onNewRun}>Start a new run</Button>
        ) : (
          <p className="text-white/40 text-sm mt-6 animate-pulse-glow">Waiting for the host to start a new run…</p>
        )}
      </Card>
    </div>
  );
}
