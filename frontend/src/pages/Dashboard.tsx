import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Plus, MemoryStick, Users, Server, AlertTriangle, Search, Play, Square, RotateCw, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import StatusBadge from '../components/StatusBadge';

function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

const TAG_PALETTE = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#facc15','#f87171'];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

const STATUS_BORDER: Record<string, string> = {
  running:  'border-l-mc-green',
  starting: 'border-l-yellow-400',
  stopping: 'border-l-orange-400',
  stopped:  'border-l-mc-border',
  crashed:  'border-l-red-500',
};

export default function Dashboard() {
  const servers = useServersStore((s) => s.servers);
  const navigate = useNavigate();
  const [dockerAvailable, setDockerAvailable] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function bulkAction(action: 'start' | 'stop' | 'restart', targets: typeof servers) {
    setBulkLoading(action);
    await Promise.allSettled(targets.map((s) => api.post(`/servers/${s.id}/${action}`)));
    setBulkLoading(null);
  }

  const running = servers.filter(s => s.runtime.status === 'running').length;
  const stopped = servers.filter(s => s.runtime.status === 'stopped' || s.runtime.status === 'crashed');
  const allTags = [...new Set(servers.flatMap(s => s.tags ?? []))].sort();
  const visibleServers = servers.filter(s => {
    const matchesTag = !activeTag || (s.tags ?? []).includes(activeTag);
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.mcVersion.includes(q) ||
      (s.tags ?? []).some(t => t.toLowerCase().includes(q));
    return matchesTag && matchesSearch;
  });

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(json => setDockerAvailable(json.data?.dockerAvailable ?? true))
      .catch(() => {});
  }, []);

  const totalPlayers = servers.reduce((acc, s) => acc + s.runtime.metrics.playersOnline, 0);
  const totalRam = servers.reduce((acc, s) => acc + s.runtime.metrics.ramMb, 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {!dockerAvailable && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-800/60 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertTriangle size={15} className="flex-shrink-0" />
          Docker daemon is unreachable. Check that <code className="font-mono text-xs bg-red-900/30 px-1 rounded">/var/run/docker.sock</code> is mounted.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono tracking-widest uppercase text-mc-muted mb-0.5">spawnpoint</div>
          <h1 className="text-2xl font-bold text-gray-100 leading-tight">
            Dashboard
            {servers.length > 0 && (
              <span className="ml-3 text-sm font-mono font-normal text-mc-muted align-middle">
                {running}/{servers.length} running
              </span>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {servers.length > 0 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
              <input
                className="input pl-8 text-sm w-44"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          {stopped.length > 0 && (
            <button className="btn-ghost text-xs" onClick={() => bulkAction('start', stopped)} disabled={!!bulkLoading}>
              <Play size={12} /> Start all
            </button>
          )}
          {running > 0 && (
            <>
              <button className="btn-ghost text-xs" onClick={() => bulkAction('restart', servers.filter(s => s.runtime.status === 'running'))} disabled={!!bulkLoading}>
                <RotateCw size={12} /> Restart all
              </button>
              <button className="btn-ghost text-xs" onClick={() => bulkAction('stop', servers.filter(s => s.runtime.status === 'running'))} disabled={!!bulkLoading}>
                <Square size={12} /> Stop all
              </button>
            </>
          )}
          <button onClick={() => navigate('/servers/new')} className="btn-primary text-sm">
            <Plus size={14} /> Add Server
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {servers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Servers"
            value={servers.length}
            icon={<Server size={15} />}
            accent="green"
          />
          <StatCard
            label="Running"
            value={running}
            icon={<Server size={15} />}
            accent="green"
            sub={servers.length > 0 ? `${Math.round(running / servers.length * 100)}%` : undefined}
          />
          <StatCard
            label="Players online"
            value={totalPlayers}
            icon={<Users size={15} />}
            accent="blue"
          />
          <StatCard
            label="RAM used"
            value={`${totalRam >= 1024 ? `${(totalRam / 1024).toFixed(1)} GB` : `${totalRam} MB`}`}
            icon={<MemoryStick size={15} />}
            accent="purple"
          />
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-colors ${!activeTag ? 'border-mc-green text-mc-green bg-mc-green/10' : 'border-mc-border text-mc-muted hover:border-gray-500'}`}
          >
            all
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className="text-xs px-2.5 py-1 rounded-full border font-mono transition-colors"
              style={activeTag === tag
                ? { borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '22' }
                : { borderColor: '#333333', color: '#888888' }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Server cards / empty state */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-5 opacity-60">⛏</div>
          <div className="text-xs font-mono tracking-widest uppercase text-mc-muted mb-3">no servers yet</div>
          <h2 className="text-xl font-bold text-gray-200 mb-2">Nothing running here</h2>
          <p className="text-mc-muted text-sm mb-6 max-w-sm leading-relaxed">
            Create a new server from scratch, browse modpacks from Modrinth or CurseForge, or import a Prism Launcher export.
          </p>
          <button onClick={() => navigate('/servers/new')} className="btn-primary">
            <Plus size={15} /> Add your first server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleServers.map((sv) => {
            const isRunning = sv.runtime.status === 'running';
            const ramPct = isRunning ? sv.runtime.metrics.ramMb / sv.memoryMb : null;
            const cpuPct = isRunning ? sv.runtime.metrics.cpuPercent / 100 : null;

            return (
              <button
                key={sv.id}
                onClick={() => navigate(`/servers/${sv.id}`)}
                className={`card text-left group hover:border-mc-green/50 transition-all duration-200 border-l-2 overflow-hidden ${STATUS_BORDER[sv.runtime.status] ?? 'border-l-mc-border'}`}
              >
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-100 group-hover:text-mc-green transition-colors duration-200 truncate">
                      {sv.name}
                    </div>
                    <div className="text-xs text-mc-muted mt-0.5 font-mono">
                      {sv.type} · {sv.mcVersion} · :{sv.port}
                    </div>
                    {(sv.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(sv.tags ?? []).map(tag => (
                          <span key={tag} className="text-xs px-1.5 py-px rounded-full border font-mono"
                            style={{ borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '18' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusBadge status={sv.runtime.status} />
                    {isRunning && sv.runtime.startedAt && (
                      <span className="text-xs text-mc-muted font-mono">↑ {fmtDuration(now - sv.runtime.startedAt)}</span>
                    )}
                    {!isRunning && sv.runtime.stoppedAt && (
                      <span className="text-xs text-mc-muted font-mono">{fmtDuration(now - sv.runtime.stoppedAt)} ago</span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="px-4 pb-4 border-t border-mc-border/50 pt-3 grid grid-cols-3 gap-2">
                  <MiniMetric
                    label="CPU"
                    value={isRunning ? `${sv.runtime.metrics.cpuPercent.toFixed(1)}%` : '—'}
                    pct={cpuPct}
                    color={sv.runtime.metrics.cpuPercent > 80 ? 'red' : sv.runtime.metrics.cpuPercent > 50 ? 'yellow' : 'green'}
                  />
                  <MiniMetric
                    label="RAM"
                    value={isRunning ? `${sv.runtime.metrics.ramMb} MB` : '—'}
                    pct={ramPct}
                    color={ramPct != null && ramPct > 0.9 ? 'red' : ramPct != null && ramPct > 0.7 ? 'yellow' : 'green'}
                  />
                  <MiniMetric
                    label="Players"
                    value={isRunning ? `${sv.runtime.metrics.playersOnline}/${sv.runtime.metrics.playersMax}` : '—'}
                    pct={null}
                    color="green"
                    extra={sv.runtime.metrics.tps !== null && isRunning
                      ? <span className={`text-xs font-mono ${sv.runtime.metrics.tps >= 19 ? 'text-mc-green' : sv.runtime.metrics.tps >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {sv.runtime.metrics.tps.toFixed(1)} TPS
                        </span>
                      : undefined}
                  />
                </div>
              </button>
            );
          })}

          {/* Add Server ghost card */}
          <button
            onClick={() => navigate('/servers/new')}
            className="card p-5 text-left group hover:border-mc-green/40 transition-all duration-200 border-dashed flex items-center justify-center gap-3 min-h-[120px]"
          >
            <div className="p-2 rounded-lg bg-mc-green/10 text-mc-green group-hover:bg-mc-green/20 transition-colors duration-200">
              <Plus size={18} />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-400 group-hover:text-mc-green transition-colors duration-200">Add Server</div>
              <div className="text-xs text-mc-muted mt-0.5">New, import, or modpack</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ACCENT_STYLES = {
  green:  { icon: 'text-mc-green',   bg: 'bg-mc-green/10' },
  blue:   { icon: 'text-blue-400',   bg: 'bg-blue-500/10' },
  purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10' },
  orange: { icon: 'text-orange-400', bg: 'bg-orange-500/10' },
};

function StatCard({ label, value, icon, accent, sub }: {
  label: string; value: string | number;
  icon: React.ReactNode; accent: keyof typeof ACCENT_STYLES;
  sub?: string;
}) {
  const { icon: iconColor, bg } = ACCENT_STYLES[accent];
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bg} ${iconColor} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-mc-muted font-mono truncate">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <div className="text-xl font-bold text-gray-100 leading-tight">{value}</div>
          {sub && <div className="text-xs text-mc-muted font-mono">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const BAR_COLORS = {
  green:  'bg-mc-green',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
};

function MiniMetric({ label, value, pct, color, extra }: {
  label: string; value: string;
  pct: number | null; color: 'green' | 'yellow' | 'red';
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-mc-dark rounded p-2">
      <div className="text-xs text-mc-muted font-mono mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-200">{value}</div>
      {pct !== null ? (
        <div className="mt-1.5 h-0.5 rounded-full bg-mc-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[color]}`}
            style={{ width: `${Math.min(pct * 100, 100)}%` }}
          />
        </div>
      ) : extra ? (
        <div className="mt-1">{extra}</div>
      ) : null}
    </div>
  );
}
