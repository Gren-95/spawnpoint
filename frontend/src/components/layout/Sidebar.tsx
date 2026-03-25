import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Server, Plus, LayoutDashboard, X, LogOut, Search, Github } from 'lucide-react';
import { useServersStore } from '../../stores/serversStore';
import StatusBadge from '../StatusBadge';

const SEARCH_THRESHOLD = 3;

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const servers = useServersStore((s) => s.servers);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(json => setVersion(json.data?.version ?? null))
      .catch(() => {});
  }, []);

  function nav(path: string) {
    navigate(path);
    onClose?.();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="w-56 h-full flex-shrink-0 bg-mc-panel border-r border-mc-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-mc-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Spawnpoint" className="w-7 h-7" />
          <span className="font-bold text-mc-green text-lg tracking-tight">Spawnpoint</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-mc-muted hover:text-gray-200 -mr-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-mc-green/20 text-mc-green' : 'text-gray-400 hover:text-gray-100 hover:bg-mc-border/40'}`
          }
        >
          <LayoutDashboard size={16} />
          Dashboard
        </NavLink>

        <div className="pt-2 pb-1 px-3 text-xs text-mc-muted uppercase tracking-wider">Servers</div>

        {servers.length > SEARCH_THRESHOLD && (
          <div className="px-2 pb-1">
            <div className="flex items-center gap-1.5 bg-mc-dark border border-mc-border rounded px-2 py-1">
              <Search size={11} className="text-mc-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter servers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-gray-300 placeholder-mc-muted outline-none flex-1 min-w-0"
              />
            </div>
          </div>
        )}

        {servers.filter(sv => {
          if (!search) return true;
          const q = search.toLowerCase();
          return sv.name.toLowerCase().includes(q) ||
            sv.type.toLowerCase().includes(q) ||
            sv.mcVersion.includes(q) ||
            (sv.tags ?? []).some(t => t.toLowerCase().includes(q));
        }).map((sv) => (
          <NavLink
            key={sv.id}
            to={`/servers/${sv.id}`}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-mc-green/20 text-mc-green' : 'text-gray-400 hover:text-gray-100 hover:bg-mc-border/40'}`
            }
          >
            <Server size={14} className="flex-shrink-0" />
            <span className="truncate flex-1" title={sv.name}>{sv.name}</span>
            <StatusBadge status={sv.runtime.status} dot />
          </NavLink>
        ))}

        {search && servers.filter(sv => {
          const q = search.toLowerCase();
          return sv.name.toLowerCase().includes(q) ||
            sv.type.toLowerCase().includes(q) ||
            sv.mcVersion.includes(q) ||
            (sv.tags ?? []).some(t => t.toLowerCase().includes(q));
        }).length === 0 && (
          <p className="px-3 py-2 text-xs text-mc-muted">No servers match "{search}"</p>
        )}
      </nav>

      {/* Actions */}
      <div className="p-2 border-t border-mc-border space-y-1">
        <button onClick={() => nav('/servers/new')} className="btn-ghost w-full justify-start text-xs">
          <Plus size={14} /> Add Server
        </button>
        <button onClick={logout} className="btn-ghost w-full justify-start text-xs text-mc-muted hover:text-red-400">
          <LogOut size={14} /> Sign out
        </button>
        <div className="px-3 pt-1 flex items-center justify-between">
          {version && <span className="text-xs text-mc-muted">{version}</span>}
          <div className="flex items-center gap-3 ml-auto">
            <a
              href="https://github.com/Gren-95/spawnpoint"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-mc-muted hover:text-gray-300 transition-colors"
            >
              <Github size={12} /> GitHub
            </a>
            <a
              href="https://hub.docker.com/r/fossfrog/spawnpoint"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-mc-muted hover:text-gray-300 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
              </svg>
              Docker Hub
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
