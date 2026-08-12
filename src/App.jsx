import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import RaidPlanner, { RAID_CONFIG, emptyPlayer } from "./RaidPlanner";

const MAX_RAIDS = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function daysLeft(ts) {
  const left = Math.ceil((ts + MAX_AGE_MS - Date.now()) / (24 * 60 * 60 * 1000));
  return left > 0 ? left : 0;
}

// Rows come back from Postgres; the app works with plain objects.
function rowToSession(row) {
  return {
    id: row.id,
    raidName: row.raid_name,
    time: row.time || "",
    createdAt: new Date(row.created_at).getTime(),
    players: row.players || [],
  };
}

function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function signIn(provider) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Raid Team Planner</h1>
          <p className="text-slate-400 text-sm">
            Sign in to keep your raids on your account.
          </p>
        </header>

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => signIn("discord")}
            className="w-full bg-indigo-500/15 border border-indigo-500/60 text-indigo-200 rounded-xl px-4 py-3 text-sm font-medium hover:bg-indigo-500/25 transition disabled:opacity-50"
          >
            Continue with Discord
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => signIn("google")}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm font-medium hover:border-slate-500 transition disabled:opacity-50"
          >
            Continue with Google
          </button>
        </div>

        {error && (
          <p className="text-red-300 text-xs text-center break-words">{error}</p>
        )}

        <p className="text-right text-xs text-slate-600">By iallwaysmiss</p>
      </div>
    </div>
  );
}

function CreateRaidModal({ onCancel, onCreate, busy }) {
  const [raidName, setRaidName] = useState("Crusher");
  const [time, setTime] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
        <h2 className="text-lg font-bold">New raid</h2>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-400">Raid</label>
          <select
            value={raidName}
            onChange={(e) => setRaidName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.keys(RAID_CONFIG).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-400">Start time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCreate(raidName, time)}
            className="text-sm px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500 text-indigo-200 hover:bg-indigo-500/30 transition disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create raid"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [raids, setRaids] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- auth ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- load raids ---
  const loadRaids = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();

    // Anything older than 7 days is dropped for good.
    await supabase.from("raids").delete().lt("created_at", cutoff);

    const { data, error } = await supabase
      .from("raids")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_RAIDS);

    if (error) setError(error.message);
    else setRaids((data || []).map(rowToSession));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadRaids();
  }, [session, loadRaids]);

  async function createRaid(raidName, time) {
    setSaving(true);
    setError(null);

    // Keep at most MAX_RAIDS: drop the oldest before inserting a new one.
    if (raids.length >= MAX_RAIDS) {
      const doomed = raids.slice(MAX_RAIDS - 1).map((r) => r.id);
      if (doomed.length) await supabase.from("raids").delete().in("id", doomed);
    }

    const cfg = RAID_CONFIG[raidName];
    const { data, error } = await supabase
      .from("raids")
      .insert({
        user_id: session.user.id,
        raid_name: raidName,
        time,
        players: Array.from({ length: cfg.slots }, (_, i) => emptyPlayer(i)),
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    const created = rowToSession(data);
    setRaids((prev) => [created, ...prev].slice(0, MAX_RAIDS));
    setCreating(false);
    setActiveId(created.id);
  }

  async function updatePlayers(id, players) {
    setRaids((prev) =>
      prev.map((r) => (r.id === id ? { ...r, players } : r))
    );
    const { error } = await supabase
      .from("raids")
      .update({ players })
      .eq("id", id);
    if (error) setError(error.message);
  }

  async function deleteRaid(id) {
    setRaids((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from("raids").delete().eq("id", id);
    if (error) setError(error.message);
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-500 flex items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  const active = raids.find((r) => r.id === activeId);

  if (active) {
    return (
      <RaidPlanner
        key={active.id}
        session={active}
        onBack={() => setActiveId(null)}
        onUpdate={(players) => updatePlayers(active.id, players)}
      />
    );
  }

  const user = session.user;
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "Signed in";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col">
      <div className="max-w-3xl w-full mx-auto space-y-6 flex-1">
        <header className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              Raid Team Planner
            </h1>
            <p className="text-slate-400 text-sm">
              Your last {MAX_RAIDS} raids are kept here for 7 days.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 truncate max-w-[12rem]">
              {displayName}
            </div>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Sign out
            </button>
          </div>
        </header>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full bg-indigo-500/15 border border-indigo-500/60 text-indigo-200 rounded-xl px-4 py-3 text-sm font-medium hover:bg-indigo-500/25 transition"
        >
          + Make Raid
        </button>

        {error && (
          <p className="text-red-300 text-xs break-words">{error}</p>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading saved raids…</p>
        ) : raids.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">No raids yet.</p>
            <p className="text-slate-600 text-xs mt-1">
              Hit “Make Raid” to set one up.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {raids.map((r) => {
              const cfg = RAID_CONFIG[r.raidName];
              const filled = (r.players || []).filter((p) =>
                p.name.trim()
              ).length;
              return (
                <li
                  key={r.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 hover:border-slate-600 transition"
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-semibold truncate">
                      {r.raidName}
                      {r.time && (
                        <span className="text-slate-400 font-normal">
                          {" "}
                          · {r.time}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(r.createdAt)} · {filled}/
                      {cfg ? cfg.slots : "?"} filled · expires in{" "}
                      {daysLeft(r.createdAt)}d
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRaid(r.id)}
                    title="Delete raid"
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-red-300 hover:border-red-500/50 transition"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="max-w-3xl w-full mx-auto pt-8">
        <p className="text-right text-xs text-slate-600">By iallwaysmiss</p>
      </footer>

      {creating && (
        <CreateRaidModal
          busy={saving}
          onCancel={() => setCreating(false)}
          onCreate={createRaid}
        />
      )}
    </div>
  );
}
