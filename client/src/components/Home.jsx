import { useState } from "react";
import { Button, Card } from "./ui.jsx";

export default function Home({ onCreate, onJoin, status }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState("solo"); // solo | host | join

  const connecting = status !== "open";

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            Prompt &amp; Circumstance
          </h1>
          <p className="text-white/50 mt-2 text-sm">Talk your way out, or get talked into the ground.</p>
        </div>

        <Card className="p-6">
          <div className="flex gap-1 p-1 rounded-xl bg-black/30 mb-5 text-sm">
            {[
              ["solo", "Solo"],
              ["host", "Host co-op"],
              ["join", "Join co-op"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  tab === id ? "bg-violet-600 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block text-xs text-white/60 mb-1">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adventurer"
            maxLength={20}
            className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-violet-500 mb-4"
          />

          {tab === "join" && (
            <>
              <label className="block text-xs text-white/60 mb-1">Lobby code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 outline-none focus:border-violet-500 mb-4 font-mono tracking-[0.3em] text-center text-lg"
              />
            </>
          )}

          {tab === "solo" && (
            <Button className="w-full" disabled={connecting} onClick={() => onCreate("solo", name)}>
              {connecting ? "Connecting…" : "Start solo run"}
            </Button>
          )}
          {tab === "host" && (
            <Button className="w-full" disabled={connecting} onClick={() => onCreate("coop", name)}>
              {connecting ? "Connecting…" : "Create lobby"}
            </Button>
          )}
          {tab === "join" && (
            <Button
              className="w-full"
              disabled={connecting || code.length !== 4}
              onClick={() => onJoin(code, name)}
            >
              {connecting ? "Connecting…" : "Join lobby"}
            </Button>
          )}
        </Card>

        <p className="text-center text-white/30 text-xs mt-6">
          Co-op: 2–3 players · turn-order rounds · an AI judges your plan
        </p>
      </div>
    </div>
  );
}
