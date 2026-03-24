import { useState, useEffect } from 'react';
import { Save, Info } from 'lucide-react';
import { api } from '../../api/client';

type PropType = 'boolean' | 'number' | 'select' | 'text';

interface PropMeta {
  description: string;
  type: PropType;
  min?: number;
  max?: number;
  options?: string[];
}

const KNOWN: Record<string, PropMeta> = {
  'max-players':           { description: 'Maximum number of players allowed on the server at once.', type: 'number', min: 1, max: 10000 },
  'view-distance':         { description: 'Chunks sent to players in each direction. Higher = more RAM/CPU.', type: 'number', min: 2, max: 32 },
  'simulation-distance':   { description: 'Distance in chunks within which entities tick. Lower = better performance.', type: 'number', min: 2, max: 32 },
  'difficulty':            { description: 'Game difficulty.', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
  'gamemode':              { description: 'Default game mode for new players.', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
  'pvp':                   { description: 'Allow players to attack each other.', type: 'boolean' },
  'online-mode':           { description: 'Verify players against Mojang\'s auth servers. Disable for offline/LAN.', type: 'boolean' },
  'allow-flight':          { description: 'Allow players to use flight clients. Required for some mods.', type: 'boolean' },
  'allow-nether':          { description: 'Allow players to travel to the Nether dimension.', type: 'boolean' },
  'spawn-monsters':        { description: 'Enable hostile mob spawning.', type: 'boolean' },
  'spawn-animals':         { description: 'Enable passive mob spawning.', type: 'boolean' },
  'spawn-npcs':            { description: 'Enable NPC (villager) spawning.', type: 'boolean' },
  'spawn-protection':      { description: 'Radius of spawn area protected from non-ops. 0 = disabled.', type: 'number', min: 0, max: 256 },
  'enable-command-block':  { description: 'Enable command blocks. Required for many adventure maps.', type: 'boolean' },
  'force-gamemode':        { description: 'Force players into the default gamemode on join.', type: 'boolean' },
  'hardcore':              { description: 'Hardcore mode — players are banned on death.', type: 'boolean' },
  'white-list':            { description: 'Only allow players on the whitelist to join.', type: 'boolean' },
  'enforce-whitelist':     { description: 'Kick non-whitelisted players when whitelist is enabled.', type: 'boolean' },
  'motd':                  { description: 'Message shown in the server browser below the server name.', type: 'text' },
  'level-name':            { description: 'Name of the world folder.', type: 'text' },
  'level-seed':            { description: 'Seed used to generate the world. Empty = random.', type: 'text' },
  'level-type':            { description: 'World generator type.', type: 'select', options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified', 'minecraft:single_biome_surface'] },
  'max-world-size':        { description: 'Max radius of the world in blocks.', type: 'number', min: 1, max: 29999984 },
  'max-tick-time':         { description: 'Max ms a single tick may take before the server watchdog stops it. -1 = disabled.', type: 'number', min: -1 },
  'network-compression-threshold': { description: 'Compress packets larger than this (bytes). -1 = disable, 0 = all.', type: 'number', min: -1 },
  'op-permission-level':   { description: 'Permission level granted to operators (1–4).', type: 'number', min: 1, max: 4 },
  'function-permission-level': { description: 'Permission level for functions (1–4).', type: 'number', min: 1, max: 4 },
  'player-idle-timeout':   { description: 'Kick idle players after this many minutes. 0 = never.', type: 'number', min: 0 },
  'rate-limit':            { description: 'Max packets per second per player. 0 = no limit.', type: 'number', min: 0 },
  'server-port':           { description: 'TCP port the server listens on.', type: 'number', min: 1, max: 65535 },
  'server-ip':             { description: 'Bind the server to a specific IP address. Empty = all interfaces.', type: 'text' },
  'resource-pack':         { description: 'URL of a resource pack players are prompted to download.', type: 'text' },
  'resource-pack-prompt':  { description: 'Custom message shown in the resource pack prompt.', type: 'text' },
  'require-resource-pack': { description: 'Kick players who decline the resource pack.', type: 'boolean' },
  'sync-chunk-writes':     { description: 'Synchronously write chunk data to disk. Safer but slower on some systems.', type: 'boolean' },
  'use-native-transport':  { description: 'Use optimised native network transport on Linux (epoll).', type: 'boolean' },
  'enable-rcon':           { description: 'Enable remote console access (used by Spawnpoint — do not disable).', type: 'boolean' },
  'enable-jmx-monitoring': { description: 'Expose JMX metrics for monitoring tools.', type: 'boolean' },
  'enforce-secure-profile': { description: 'Require players to have a Mojang-signed public key.', type: 'boolean' },
  'log-ips':               { description: 'Log player IP addresses on connection.', type: 'boolean' },
  'generate-structures':   { description: 'Generate structures (villages, dungeons, etc.) in the world.', type: 'boolean' },
};

function validate(key: string, value: string): string {
  const meta = KNOWN[key];
  if (!meta) return '';
  if (meta.type === 'number') {
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n)) return 'Must be a whole number';
    if (meta.min !== undefined && n < meta.min) return `Minimum is ${meta.min}`;
    if (meta.max !== undefined && n > meta.max) return `Maximum is ${meta.max}`;
  }
  if (meta.type === 'boolean' && value !== 'true' && value !== 'false') return 'Must be true or false';
  if (meta.type === 'select' && meta.options && !meta.options.includes(value)) return `Must be one of: ${meta.options.join(', ')}`;
  return '';
}

function PropRow({ propKey, value, onChange }: {
  propKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const meta = KNOWN[propKey];
  const error = validate(propKey, value);

  return (
    <div className="flex items-start gap-3">
      <div className="w-60 flex-shrink-0 flex items-center gap-1 pt-1.5">
        <label className="text-xs text-gray-400 font-mono truncate" title={propKey}>{propKey}</label>
        {meta && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="text-mc-muted hover:text-mc-green"
            >
              <Info size={11} />
            </button>
            {showTip && (
              <div className="absolute left-5 top-0 z-20 w-64 bg-mc-panel border border-mc-border rounded px-2.5 py-2 text-xs text-gray-300 shadow-lg">
                {meta.description}
                {meta.type === 'number' && (meta.min !== undefined || meta.max !== undefined) && (
                  <div className="text-mc-muted mt-1">
                    Range: {meta.min ?? '–'} – {meta.max ?? '–'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {meta?.type === 'boolean' ? (
          <button
            type="button"
            onClick={() => onChange(value === 'true' ? 'false' : 'true')}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              value === 'true'
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            {value === 'true' ? 'true' : 'false'}
          </button>
        ) : meta?.type === 'select' ? (
          <select className="input text-xs py-1.5" value={value} onChange={e => onChange(e.target.value)}>
            {meta.options!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            className={`input w-full ${error ? 'border-red-700' : ''}`}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        )}
        {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
      </div>
    </div>
  );
}

export default function PropertiesTab({ serverId }: { serverId: string }) {
  const [props, setProps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>(`/servers/${serverId}/files/properties`)
      .then(setProps)
      .catch(() => setError('Could not load server.properties'))
      .finally(() => setLoading(false));
  }, [serverId]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/servers/${serverId}/files/properties`, props);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-mc-muted">Loading…</div>;

  if (Object.keys(props).length === 0) {
    return <div className="p-6 text-mc-muted">No server.properties found. Start the server once to generate it.</div>;
  }

  const knownEntries = Object.entries(props).filter(([k]) => k in KNOWN).sort(([a], [b]) => a.localeCompare(b));
  const unknownEntries = Object.entries(props).filter(([k]) => !(k in KNOWN)).sort(([a], [b]) => a.localeCompare(b));
  const hasErrors = Object.entries(props).some(([k, v]) => validate(k, v));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-mc-border">
        <span className="text-sm text-mc-muted">server.properties</span>
        <button onClick={save} className="btn-primary" disabled={saving || hasErrors}>
          <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2.5 max-w-2xl">
          {knownEntries.map(([key, value]) => (
            <PropRow
              key={key}
              propKey={key}
              value={value}
              onChange={(v) => setProps(p => ({ ...p, [key]: v }))}
            />
          ))}

          {unknownEntries.length > 0 && (
            <>
              <div className="pt-3 pb-1 text-xs text-mc-muted border-t border-mc-border">Other properties</div>
              {unknownEntries.map(([key, value]) => (
                <PropRow
                  key={key}
                  propKey={key}
                  value={value}
                  onChange={(v) => setProps(p => ({ ...p, [key]: v }))}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
