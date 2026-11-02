import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, GripVertical, Loader2 } from 'lucide-react';
import { RosterClass, RosterPlayer, TrainingGroup, TRAINING_GROUPS, POSITION_SHORT } from '../types';
import { GROUP_COLORS, GROUP_DESCRIPTIONS } from '../services/rosterData';
import { classKey, groupOf, invalidateRosterContext } from '../services/classYears';
import { db } from '../services/db';

interface Props {
  players: RosterPlayer[]; // current team (no alumni)
  rosterClasses: Record<string, RosterClass>;
  onClose: () => void;
  onDone: () => void; // reload overrides in the parent
}

const LANES = TRAINING_GROUPS;
const HOLD_MS = 300; // touch: hold this long to pick a player up, so a swipe still scrolls
const MOVE_PX = 6; // mouse: move this far to start a drag, so a click stays a click
const EDGE_PX = 70; // drag near the top or bottom of the screen to scroll

interface Press { name: string; x: number; y: number; touch: boolean; active: boolean; timer?: number }

// Coaches drag players between training groups (or tap a player, then tap a lane).
// Each move is saved straight away as a coach override on the player's roster record.
const GroupBoard: React.FC<Props> = ({ players, rosterClasses, onClose, onDone }) => {
  const [moved, setMoved] = useState<Record<string, TrainingGroup>>({}); // this visit's moves, shown before the save lands
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ name: string; x: number; y: number; over: TrainingGroup | null } | null>(null);
  const press = useRef<Press | null>(null);
  const justDropped = useRef(false); // the click that follows a drop must not count as a lane tap
  const lastY = useRef(0);

  const groupFor = (p: RosterPlayer) => moved[p.name] ?? groupOf(p, rosterClasses);

  const lanes = useMemo(() => {
    const byLane = Object.fromEntries(LANES.map(l => [l, [] as RosterPlayer[]])) as Record<TrainingGroup, RosterPlayer[]>;
    for (const p of players) byLane[moved[p.name] ?? groupOf(p, rosterClasses)].push(p);
    LANES.forEach(l => byLane[l].sort((a, b) => a.name.localeCompare(b.name)));
    return byLane;
  }, [players, rosterClasses, moved]);

  const handleMove = async (name: string, to: TrainingGroup) => {
    const player = players.find(p => p.name === name);
    if (!player || groupFor(player) === to) return;
    const before = moved[name];
    setMoved(m => ({ ...m, [name]: to }));
    setSaving(s => new Set(s).add(name));
    setError(null);
    try {
      await db.setRosterClass(classKey(name), name, { trainingGroup: to });
      invalidateRosterContext(); // other screens pick up the move next time they load
    } catch (e) {
      console.error('[GroupBoard] save failed', e);
      setMoved(m => {
        const next = { ...m };
        if (before) next[name] = before; else delete next[name];
        return next;
      });
      setError(`Couldn't move ${name}. Check your connection and try again.`);
    } finally {
      setSaving(s => { const next = new Set(s); next.delete(name); return next; });
    }
  };

  const laneAt = (x: number, y: number): TrainingGroup | null =>
    (document.elementFromPoint(x, y)?.closest('[data-lane]')?.getAttribute('data-lane') as TrainingGroup) ?? null;

  // Pointer tracking lives on window so a drag keeps working outside the card.
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!p.active) {
        if (p.touch) { if (dist > MOVE_PX * 2) { window.clearTimeout(p.timer); press.current = null; } return; } // a swipe: let it scroll
        if (dist < MOVE_PX) return;
        p.active = true;
      }
      lastY.current = e.clientY;
      setDrag({ name: p.name, x: e.clientX, y: e.clientY, over: laneAt(e.clientX, e.clientY) });
    };
    const handlePointerUp = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      window.clearTimeout(p.timer);
      if (p.active) {
        const to = laneAt(e.clientX, e.clientY);
        setDrag(null);
        justDropped.current = true;
        window.setTimeout(() => { justDropped.current = false; }, 0);
        if (to) handleMove(p.name, to);
        return;
      }
      // A tap. With a player already picked, tapping anyone in another lane moves them there
      // (lanes are mostly rows, so this is where a coach's finger lands). Otherwise it picks.
      const tapped = players.find(x => x.name === p.name);
      const picked = players.find(x => x.name === selected);
      if (picked && tapped && groupFor(tapped) !== groupFor(picked)) {
        handleMove(picked.name, groupFor(tapped));
        setSelected(null);
      } else {
        setSelected(s => (s === p.name ? null : p.name));
      }
    };
    const handleCancel = () => {
      if (press.current) window.clearTimeout(press.current.timer);
      press.current = null;
      setDrag(null);
    };
    // Once a player is picked up, stop the page scrolling under the finger.
    const handleTouchMove = (e: TouchEvent) => { if (press.current?.active) e.preventDefault(); };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  });

  // Scroll while dragging near the top or bottom edge (lanes stack on a phone).
  const scroller = useRef<HTMLDivElement>(null);
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const y = lastY.current;
      const el = scroller.current;
      if (el && y < EDGE_PX) el.scrollBy(0, -12);
      else if (el && y > window.innerHeight - EDGE_PX) el.scrollBy(0, 12);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);

  const handlePointerDown = (name: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    const p: Press = { name, x: e.clientX, y: e.clientY, touch, active: false };
    if (touch) {
      p.timer = window.setTimeout(() => {
        if (press.current !== p) return;
        p.active = true;
        navigator.vibrate?.(15);
        lastY.current = p.y;
        setDrag({ name, x: p.x, y: p.y, over: laneAt(p.x, p.y) });
      }, HOLD_MS);
    }
    press.current = p;
  };

  const handleClose = () => { onDone(); onClose(); };
  const selectedPlayer = players.find(p => p.name === selected);

  return (
    <div ref={scroller} className="fixed inset-0 z-50 bg-neutral-950 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <header className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur py-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Training groups</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {selectedPlayer
                ? <>Tap a lane to move <span className="text-amber-400 font-bold">{selectedPlayer.name}</span>, or tap them again to cancel.</>
                : 'Drag a player to another group. On a phone, hold then drag, or tap a player then tap a lane.'}
            </p>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg bg-neutral-900 text-neutral-300 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {LANES.map(lane => {
            const colors = GROUP_COLORS[lane];
            const isTarget = drag?.over === lane && groupFor(players.find(p => p.name === drag.name)!) !== lane;
            const canTapMove = selectedPlayer && groupFor(selectedPlayer) !== lane;
            return (
              <section
                key={lane}
                data-lane={lane}
                onClick={() => { if (canTapMove && !justDropped.current) { handleMove(selectedPlayer.name, lane); setSelected(null); } }}
                className={`rounded-xl border-2 transition-colors min-h-[120px] ${isTarget ? 'border-amber-400 bg-amber-500/10' : canTapMove ? 'border-dashed border-amber-500/60 bg-neutral-900 cursor-pointer' : 'border-neutral-800 bg-neutral-900'}`}
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${colors.bg} ${colors.text}`}>
                  <span className="font-bold text-sm">{lane}</span>
                  <span className="text-xs opacity-80">{GROUP_DESCRIPTIONS[lane]} · {lanes[lane].length}</span>
                </div>
                {canTapMove && <p className="px-3 pt-2 text-[11px] text-amber-400 font-medium">Tap to move here</p>}
                <ul className="p-2 space-y-1.5">
                  {lanes[lane].map(p => {
                    const isDragged = drag?.name === p.name;
                    const isSelected = selected === p.name;
                    return (
                      <li
                        key={p.name}
                        onPointerDown={handlePointerDown(p.name)}
                        onClick={e => e.stopPropagation()}
                        onContextMenu={e => e.preventDefault()}
                        style={{ WebkitTouchCallout: 'none' }}
                        className={`flex items-center gap-2 px-2 py-2 rounded-lg border select-none cursor-grab active:cursor-grabbing text-sm ${isDragged ? 'opacity-30' : ''} ${isSelected ? 'border-amber-400 bg-amber-500/15 text-white' : 'border-neutral-800 bg-neutral-950 text-neutral-200'}`}
                      >
                        <GripVertical size={14} className="text-neutral-600 shrink-0" />
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.bestPosition && <span className="text-[10px] text-neutral-500">{POSITION_SHORT[p.bestPosition]}</span>}
                        {saving.has(p.name) && <Loader2 size={12} className="animate-spin text-amber-500" />}
                      </li>
                    );
                  })}
                  {lanes[lane].length === 0 && <li className="text-xs text-neutral-600 px-2 py-3 text-center">No players</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {drag && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-amber-500 text-black text-sm font-bold shadow-xl -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.name}
        </div>
      )}
    </div>
  );
};

export default GroupBoard;
