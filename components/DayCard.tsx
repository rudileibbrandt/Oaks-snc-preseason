import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Flame, Share2, TrendingUp, Sparkles } from 'lucide-react';
import { TestResult, TestSession } from '../types';
import { LEVELS, PositionGroup, TESTS, groupLabel, levelIndex, levelName, formatValue } from '../services/standards';
import { fmtPct, shortDay } from '../services/teamProgress';
import type { DayTest } from '../services/dayResults';

// One testing day as a full-screen, screenshot-ready card (Rudi, 22 Nov 2026): every test the
// player did that day, its tier, PRs and the change since last time.

// Tile colors by tier, below Bronze to Elite.
const TILE: Record<number, string> = {
  [-1]: 'bg-neutral-900 border-neutral-800',
  0: 'bg-gradient-to-br from-orange-950/80 to-neutral-950 border-orange-800/60',
  1: 'bg-gradient-to-br from-slate-700/40 to-neutral-950 border-slate-500/50',
  2: 'bg-gradient-to-br from-amber-600/30 to-neutral-950 border-amber-500/60',
  3: 'bg-gradient-to-br from-amber-400/50 via-amber-600/20 to-neutral-950 border-amber-300',
};
const TIER_TEXT: Record<number, string> = {
  [-1]: 'text-neutral-400', 0: 'text-orange-300', 1: 'text-slate-200', 2: 'text-amber-400', 3: 'text-amber-300',
};
const MEDAL: Record<number, string> = {
  0: 'from-orange-300 to-orange-700', 1: 'from-slate-100 to-slate-500', 2: 'from-amber-200 to-amber-600', 3: 'from-yellow-100 via-amber-300 to-amber-500',
};

const DayCard: React.FC<{
  session: TestSession;
  result: TestResult;
  tests: Record<string, DayTest>;
  group: PositionGroup;
  playerName: string;
  onClose: () => void;
  onEdit?: () => void; // only when the player entered this day themselves
}> = ({ session, result, tests, group, playerName, onClose, onEdit }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const done = TESTS.filter(t => tests[t.key]);
  const tierOf = (key: string) => levelIndex(group, key as never, tests[key].value);
  const counts = [3, 2, 1, 0].map(i => ({ i, n: done.filter(t => tierOf(t.key) === i).length }));
  const prs = done.filter(t => tests[t.key].pr).length;
  const show = (key: string) => formatValue(key as never, {
    value: tests[key].value, sessionId: session.id, date: session.date, reps: result.chinupReps ?? undefined,
  });

  const shareText = () => [
    `${playerName} · ${session.name} · ${shortDay(session.date)}`,
    ...done.map(t => `${t.label}: ${show(t.key)} (${levelName(tierOf(t.key))})${tests[t.key].pr ? ' PR' : ''}`),
    'Danville Oaks S&C',
  ].join('\n');
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const handleShare = async () => {
    try { await navigator.share({ title: `${session.name} results`, text: shareText() }); }
    catch (e) { console.log('[DayCard] Share closed:', e); }
  };

  // Portalled to <body>: an animated ancestor would otherwise pin "fixed" to itself, not the screen.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${session.name} results`}>
      <div className="max-w-md mx-auto min-h-full px-4 pt-3 pb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button onClick={onClose} aria-label="Close" className="p-2 -ml-2 text-neutral-400 hover:text-white min-h-[44px] min-w-[44px]"><X size={22} /></button>
          {onEdit && (
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-xs font-bold text-amber-400 border border-amber-700/60 hover:bg-amber-500/10">
              <Pencil size={13} /> Change scores
            </button>
          )}
        </div>

        {/* The card: everything a screenshot needs, nothing else. */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-600/50 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(245,158,11,0.22),rgba(10,10,10,1)_60%)] p-5 space-y-4 shadow-[0_0_40px_rgba(245,158,11,0.12)]">
          <div className="text-center space-y-1">
            <p className="text-[10px] font-black tracking-[0.25em] text-amber-500">DANVILLE OAKS · S&amp;C TESTING</p>
            <h2 className="text-2xl font-black text-white leading-tight">{session.name}</h2>
            <p className="text-xs text-neutral-400">{shortDay(session.date)}</p>
          </div>

          <div className="text-center">
            <p className="text-xl font-black text-white">{playerName}</p>
            <p className="text-[11px] text-neutral-400">{groupLabel(group)}</p>
          </div>

          <div className="flex items-end justify-center gap-3">
            {counts.map(({ i, n }) => (
              <div key={i} className={`flex flex-col items-center gap-1 ${n ? '' : 'opacity-25'}`}>
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${MEDAL[i]} flex items-center justify-center shadow-lg ring-2 ring-black/40`}>
                  <span className="text-lg font-black text-black/80 tabular-nums">{n}</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${TIER_TEXT[i]}`}>{LEVELS[i]}</span>
              </div>
            ))}
            <div className={`flex flex-col items-center gap-1 pl-3 ml-1 border-l border-neutral-800 ${prs ? '' : 'opacity-25'}`}>
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg ring-2 ring-black/40">
                <span className="text-lg font-black text-black/80 tabular-nums">{prs}</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-0.5"><Flame size={9} />PRs</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {done.map(t => {
              const d = tests[t.key];
              const tier = tierOf(t.key);
              return (
                <div key={t.key} className={`relative rounded-2xl border p-3 ${TILE[tier]}`}>
                  {d.pr && <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black flex items-center gap-0.5"><Flame size={9} />PR</span>}
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 pr-8">{t.label}</p>
                  <p className="text-2xl font-black text-white tabular-nums leading-tight mt-0.5">{show(t.key)}</p>
                  <p className={`text-[11px] font-black uppercase tracking-wide ${TIER_TEXT[tier]}`}>{levelName(tier)}</p>
                  <p className="text-[10px] mt-0.5 flex items-center gap-1">
                    {d.first
                      ? <span className="text-neutral-500 flex items-center gap-0.5"><Sparkles size={10} />First test</span>
                      : d.deltaPct === 0
                        ? <span className="text-neutral-400">No change</span>
                        : <span className={`flex items-center gap-0.5 font-bold ${d.deltaPct! > 0 ? 'text-green-400' : 'text-sky-300'}`}>
                            <TrendingUp size={10} className={d.deltaPct! > 0 ? '' : 'rotate-180'} />{fmtPct(d.deltaPct!)} vs last</span>}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="text-center text-[9px] tracking-[0.2em] text-neutral-600 font-bold">OAKS-SNC.WEB.APP</p>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-neutral-500">
          <span>Screenshot to share</span>
          {canShare && (
            <button onClick={handleShare} className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg font-bold text-black bg-amber-500 hover:bg-amber-400">
              <Share2 size={13} /> Share
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DayCard;
