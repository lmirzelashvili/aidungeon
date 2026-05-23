import { useEffect } from "react";
import { useGame } from "./net.js";
import Home from "./components/Home.jsx";
import Lobby from "./components/Lobby.jsx";
import Game from "./components/Game.jsx";

export default function App() {
  const { status, playerId, game, error, createSession, joinSession, start, submit, cont, newRun, clearError } = useGame();

  // Auto-dismiss errors after a few seconds.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 4000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  const joined = !!game && !!playerId;

  return (
    <div className="min-h-full">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-medium shadow-lg max-w-[90vw]">
          {error}
        </div>
      )}

      {!joined && <Home onCreate={createSession} onJoin={joinSession} status={status} />}
      {joined && game.phase === "lobby" && <Lobby game={game} playerId={playerId} onStart={start} />}
      {joined && game.phase !== "lobby" && (
        <Game game={game} playerId={playerId} submit={submit} cont={cont} newRun={newRun} />
      )}
    </div>
  );
}
