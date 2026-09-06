'use client';
/* oxlint-disable react/react-compiler -- This client-only game bootstraps from browser storage and a server seed; effects synchronize those external systems. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Infinity as InfinityIcon,
  Plane,
  RotateCw,
  Save,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ENDLESS_COLORS,
  SHAPES,
  endlessCanPlace,
  newEndless,
  placeEndless,
  type EndlessMove,
  type EndlessState,
} from '@/lib/endless-engine';
import { rotate } from '@/lib/game-engine';
import { RunSync, type RunAck } from '@/lib/run-sync';
import { DESTINATIONS } from '@/lib/destinations';
import Leaderboard from './leaderboard';
import { useWallet } from './wallet';
import { shortAddress } from '@/lib/chain';
import { requestApi } from '@/lib/client-api';
const BEST_KEY = 'hm:endless:best:v1',
  NAME_KEY = 'hm:traveler:v1';
const number = (n: number) => n.toLocaleString('en-US');
const api = <T,>(body: unknown) => requestApi<T>('/api/game', body);
function MiniPiece({
  shape,
  rotation = 0,
}: {
  shape: number;
  rotation?: number;
}) {
  const cells = rotate(SHAPES[shape], rotation),
    width = Math.max(...cells.map((c) => c[0])) + 1,
    height = Math.max(...cells.map((c) => c[1])) + 1;
  return (
    <span
      className="endless-mini"
      aria-hidden="true"
      style={{
        gridTemplateColumns: `repeat(${width}, 1fr)`,
        gridTemplateRows: `repeat(${height}, 1fr)`,
        width: width * 20,
        height: height * 20,
      }}
    >
      {cells.map(([x, y]) => (
        <i
          key={`${x}-${y}`}
          style={{
            gridColumn: x + 1,
            gridRow: y + 1,
            background: ENDLESS_COLORS[shape % ENDLESS_COLORS.length],
          }}
        />
      ))}
    </span>
  );
}
export default function EndlessGame({
  destinationIndex,
  leaveRequest,
  onExit,
  onTop,
}: {
  destinationIndex: number;
  leaveRequest: number;
  onExit: () => void;
  onTop: () => void;
}) {
  const wallet = useWallet();
  const [finishRequested, setFinishRequested] = useState(false);
  const [state, setState] = useState<EndlessState | null>(null),
    stateRef = useRef<EndlessState | null>(null);
  const [destination, setDestination] = useState(destinationIndex),
    [selected, setSelected] = useState(0),
    [rotation, setRotation] = useState(0),
    [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<'starting' | 'ranked' | 'practice'>(
      'starting',
    ),
    [best, setBest] = useState(0),
    [name, setName] = useState('Traveler');
  const [notice, setNotice] = useState(''),
    [feedback, setFeedback] = useState(
      'Select a piece. Tap the grid. Find your flow.',
    ),
    [cleared, setCleared] = useState<number[]>([]);
  const [finishOpen, setFinishOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [syncError, setSyncError] = useState(''),
    [storageWarning, setStorageWarning] = useState(false);
  const sync = useRef<RunSync | null>(null),
    nameRef = useRef(name),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    lastLeave = useRef(leaveRequest),
    mounted = useRef(true);
  const destinationRef = useRef(destinationIndex),
    boardRef = useRef<HTMLFieldSetElement>(null),
    stop = DESTINATIONS[destination];
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  const begin = useCallback(async () => {
    const id = ++generation.current;
    sync.current = null;
    stateRef.current = null;
    setState(null);
    setMode('starting');
    setSaved(false);
    setSaving(false);
    setFinishRequested(false);
    setFinishOpen(false);
    setSyncError('');
    setNotice('');
    setSelected(0);
    setRotation(0);
    setHover(null);
    setCleared([]);
    setFeedback('Select a piece. Tap the grid. Find your flow.');
    let preferred = '';
    try {
      preferred = localStorage.getItem(NAME_KEY) || '';
    } catch {}
    try {
      const run = await api<{ sessionId: string; seed: number; name: string }>({
        action: 'start',
        destination: DESTINATIONS[destinationRef.current].id,
        nickname: preferred,
      });
      if (!mounted.current || id !== generation.current) return;
      const next = newEndless(run.seed);
      sync.current = new RunSync(run.sessionId, (batch) => api<RunAck>(batch));
      stateRef.current = next;
      setState(next);
      setName(run.name);
      setMode('ranked');
    } catch (error) {
      if (!mounted.current || id !== generation.current) return;
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1,
        next = newEndless(seed);
      stateRef.current = next;
      setState(next);
      setMode('practice');
      setNotice(
        error instanceof Error
          ? error.message
          : 'The leaderboard is unavailable.',
      );
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    try {
      const stored = Number(localStorage.getItem(BEST_KEY));
      if (Number.isSafeInteger(stored) && stored > 0) setBest(stored);
    } catch {
      setStorageWarning(true);
    }
    void begin();
    return () => {
      mounted.current = false;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the latest request, not a captured generation.
      generation.current++;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [begin]);
  useEffect(() => {
    if (leaveRequest !== lastLeave.current) {
      lastLeave.current = leaveRequest;
      setFinishOpen(true);
    }
  }, [leaveRequest]);
  const checkpoint = useCallback(async () => {
    const current = sync.current;
    if (!current || current.finished) return;
    try {
      await current.flush(false, nameRef.current);
      if (mounted.current && sync.current === current) setSyncError('');
    } catch (error) {
      if (mounted.current && sync.current === current)
        setSyncError(
          error instanceof Error
            ? error.message
            : 'Your score has not synced yet.',
        );
    }
  }, []);
  useEffect(() => {
    const tick = setInterval(() => {
      if (sync.current?.pending.length) void checkpoint();
    }, 30000);
    return () => clearInterval(tick);
  }, [checkpoint]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (stateRef.current?.turn && !sync.current?.finished) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  function play(index: number) {
    const current = stateRef.current;
    if (
      !current ||
      current.over ||
      finishOpen ||
      saved ||
      saving ||
      finishRequested
    )
      return;
    const move: EndlessMove = {
      slot: selected,
      x: index % 8,
      y: Math.floor(index / 8),
      rotation,
    };
    if (!endlessCanPlace(current, move)) {
      setFeedback('A little more room. Try another spot or rotate.');
      return;
    }
    const result = placeEndless(current, move);
    stateRef.current = result.state;
    setState(result.state);
    setCleared(result.cleared);
    setHover(null);
    setRotation(0);
    setSelected(result.state.hand.findIndex((value) => value !== null));
    setFeedback(
      result.linesCleared
        ? `${result.linesCleared > 1 ? 'DOUBLE ESCAPE.' : 'A LITTLE SPACE.'} +${result.points}${result.state.combo > 1 ? ` · COMBO ×${result.state.combo}` : ''}`
        : `+${result.points} · Looking good. Keep the holiday going.`,
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCleared([]), 600);
    let oldBest = 0;
    try {
      oldBest = Number(localStorage.getItem(BEST_KEY)) || 0;
      if (!Number.isSafeInteger(oldBest)) oldBest = 0;
      localStorage.setItem(
        BEST_KEY,
        String(Math.max(oldBest, result.state.score)),
      );
    } catch {
      setStorageWarning(true);
    }
    setBest((value) => Math.max(value, oldBest, result.state.score));
    if (sync.current) {
      sync.current.add(move);
      if (sync.current.pending.length >= 8) void checkpoint();
    }
    if (result.state.over) {
      setFeedback('OUT OF OFFICE. What a lovely run.');
      setFinishOpen(true);
    }
  }
  function boardKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -8,
      ArrowDown: 8,
    };
    if (event.key in steps) {
      event.preventDefault();
      const next = Math.max(0, Math.min(63, index + steps[event.key]));
      boardRef.current
        ?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)
        ?.focus();
      setHover(next);
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      setRotation((value) => (value + 1) % 4);
    }
  }
  async function save() {
    const current = sync.current;
    if (!current || saving || saved) return;
    if (!wallet.address) {
      wallet.open();
      return;
    }
    const clean = name.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (
      clean.length < 2 ||
      clean.length > 18 ||
      !/^[-\p{L}\p{N}_ ]+$/u.test(clean)
    ) {
      setSyncError('Use 2–18 letters, numbers, spaces, dashes or underscores.');
      return;
    }
    setSaving(true);
    setFinishRequested(true);
    setSyncError('');
    try {
      await current.flush(true, clean);
      if (!mounted.current) return;
      setSaved(true);
      try {
        localStorage.setItem(NAME_KEY, clean);
      } catch {
        setStorageWarning(true);
      }
    } catch (error) {
      if (mounted.current)
        setSyncError(
          error instanceof Error
            ? error.message
            : 'Could not save. Please retry.',
        );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  const shape = state?.hand[selected],
    cells =
      shape === null || shape === undefined
        ? []
        : rotate(SHAPES[shape], rotation),
    preview =
      hover === null
        ? []
        : cells.map(([dx, dy]) => [
            (hover % 8) + dx,
            Math.floor(hover / 8) + dy,
          ]);
  const validPreview =
    !!state &&
    hover !== null &&
    endlessCanPlace(state, {
      slot: selected,
      x: hover % 8,
      y: Math.floor(hover / 8),
      rotation,
    });
  return (
    <section
      className="endless-screen"
      style={{ '--destination': stop.color } as CSSProperties}
    >
      <div className="game-navigation">
        <Button
          variant="ghost"
          onClick={() => (state?.turn ? setFinishOpen(true) : onExit())}
        >
          <ArrowLeft size={17} /> DEPARTURES
        </Button>
        <span className="eyebrow">{stop.code} · ENDLESS ESCAPE</span>
        <Button variant="ghost" onClick={onTop}>
          <Trophy size={17} /> TOP 20
        </Button>
      </div>
      <div className="endless-heading">
        <div>
          <span className="eyebrow">
            ONE MORE PIECE. A LITTLE MORE HOLIDAY.
          </span>
          <h1>
            Stay a little longer<span>.</span>
          </h1>
        </div>
        <span className="endless-mode">
          <InfinityIcon size={20} />
          {mode === 'starting'
            ? 'BOARDING…'
            : mode === 'ranked'
              ? 'ENDLESS · LIVE'
              : 'ENDLESS · PRACTICE'}
        </span>
      </div>
      <div className="endless-layout">
        <div className="endless-main">
          <div className="endless-scoreboard">
            <div>
              <span>SCORE</span>
              <strong>{number(state?.score || 0)}</strong>
            </div>
            <div>
              <span>
                <Trophy size={12} /> YOUR BEST
              </span>
              <strong>{number(best)}</strong>
            </div>
            <div>
              <span>LINES</span>
              <strong>{state?.lines || 0}</strong>
            </div>
          </div>
          <div className="endless-board-wrap">
            <fieldset
              className="endless-board"
              ref={boardRef}
              aria-label="Eight by eight puzzle grid. Select a piece, then its top-left position. Arrow keys move; R rotates."
              aria-busy={mode === 'starting'}
            >
              {Array.from({ length: 64 }, (_, index) => {
                const occupied = state?.board[index] || 0,
                  isPreview = preview.some(
                    ([x, y]) => x === index % 8 && y === Math.floor(index / 8),
                  );
                return (
                  <button
                    key={index}
                    data-cell={index}
                    className={
                      'endless-cell ' +
                      (occupied ? 'occupied ' : '') +
                      (isPreview
                        ? validPreview
                          ? 'piece-preview '
                          : 'invalid-preview '
                        : '') +
                      (cleared.includes(index) ? 'line-cleared' : '')
                    }
                    style={
                      {
                        '--tile': occupied
                          ? ENDLESS_COLORS[occupied - 1]
                          : shape !== null && shape !== undefined
                            ? ENDLESS_COLORS[shape % ENDLESS_COLORS.length]
                            : 'transparent',
                      } as CSSProperties
                    }
                    disabled={!state || state.over || saved}
                    aria-label={`Row ${Math.floor(index / 8) + 1}, column ${(index % 8) + 1}, ${occupied ? 'filled' : 'empty'}`}
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(index)}
                    onKeyDown={(event) => boardKey(event, index)}
                    onClick={() => play(index)}
                  />
                );
              })}
            </fieldset>
            {mode === 'starting' && (
              <output className="endless-board-loading">
                <Plane size={34} />
                <b>Preparing your escape…</b>
              </output>
            )}
          </div>
          <output className="endless-feedback" aria-live="polite">
            {feedback}
          </output>
          <fieldset
            className="endless-hand"
            aria-label="Choose your next piece"
          >
            {[0, 1, 2].map((slot) => {
              const piece = state?.hand[slot];
              return (
                <button
                  key={slot}
                  className={
                    'endless-piece ' + (selected === slot ? 'selected' : '')
                  }
                  disabled={
                    piece === undefined ||
                    piece === null ||
                    state?.over ||
                    saved
                  }
                  aria-label={
                    piece === null
                      ? 'Piece placed'
                      : `Select piece ${slot + 1}, ${piece !== undefined ? SHAPES[piece].length : 0} squares`
                  }
                  aria-pressed={selected === slot}
                  onClick={() => {
                    setSelected(slot);
                    setRotation(0);
                  }}
                >
                  {piece !== null && piece !== undefined ? (
                    <MiniPiece
                      shape={piece}
                      rotation={selected === slot ? rotation : 0}
                    />
                  ) : (
                    <Check size={22} />
                  )}
                  <span>
                    {piece === null ? 'PACKED' : `PIECE 0${slot + 1}`}
                  </span>
                </button>
              );
            })}
          </fieldset>
          <div className="endless-controls">
            <Button
              variant="outline"
              disabled={!state || state.over || saved}
              onClick={() => setRotation((value) => (value + 1) % 4)}
            >
              <RotateCw size={16} /> ROTATE <kbd>R</kbd>
            </Button>
            <Button
              variant="ghost"
              disabled={!state?.turn}
              onClick={() => setFinishOpen(true)}
            >
              <Save size={16} />
              {saved ? 'RUN SAVED' : 'FINISH RUN'}
            </Button>
          </div>
          {syncError && !finishOpen && (
            <div className="endless-notice" aria-live="polite">
              {syncError}{' '}
              <button onClick={() => void checkpoint()}>RETRY SYNC</button>
            </div>
          )}
          {mode === 'practice' && (
            <p className="endless-notice">
              {notice} This run is practice only; it cannot enter the global
              TOP.{' '}
              <button
                onClick={() =>
                  state?.turn ? setFinishOpen(true) : void begin()
                }
              >
                START A NEW RUN
              </button>
            </p>
          )}
          {storageWarning && (
            <p className="endless-notice">
              Browser storage is unavailable. Your local best may not survive a
              refresh.
            </p>
          )}
        </div>
        <aside className="endless-aside">
          <div className="endless-postcard">
            <div
              className="destination-art"
              aria-hidden="true"

              style={{ backgroundPosition: stop.artPosition }}
            />
            <div>
              <span>YOU ARE HERE</span>
              <h2>{stop.name.toUpperCase()}</h2>
              <b>
                {stop.code} <Plane size={22} />
              </b>
            </div>
          </div>
          <div className="endless-instructions">
            <span className="eyebrow">NO TIMER. NO LAST LEVEL.</span>
            <h2>
              Make room
              <br />
              for good times.
            </h2>
            <ol>
              <li>
                <b>Place.</b> Pick a piece and tap its top-left position on the
                grid.
              </li>
              <li>
                <b>Clear.</b> Complete a row or column to free up space.
              </li>
              <li>
                <b>Repeat.</b> Three fresh pieces arrive when your tray is
                empty.
              </li>
            </ol>
            <p>
              Keep going until no piece fits. Rotate freely. Clear lines on
              consecutive moves for a combo bonus.
            </p>
            <div className="endless-points">
              <span>10 / SQUARE</span>
              <span>100 / LINE</span>
              <span>+50 / COMBO STEP</span>
            </div>
          </div>
          <div className="endless-route">
            <label htmlFor="endless-destination">YOUR VACATION BACKDROP</label>
            <select
              id="endless-destination"
              value={destination}
              disabled={!!state?.turn || mode === 'starting'}
              onChange={(event) => {
                const index = Number(event.target.value);
                destinationRef.current = index;
                setDestination(index);
                void begin();
              }}
            >
              {DESTINATIONS.map((d, index) => (
                <option key={d.id} value={index}>
                  {d.name.toUpperCase()} · {d.code}
                </option>
              ))}
            </select>
            <small>
              Every destination plays by the same rules. Collect passport stamps
              in Passport Quest.
            </small>
          </div>
        </aside>
      </div>
      <Dialog
        open={finishOpen}
        onOpenChange={(open) => {
          if (!saving && !saved && !state?.over && !finishRequested)
            setFinishOpen(open);
        }}
      >
        <DialogContent
          className="holiday-dialog endless-finish"
          showCloseButton={
            !saved && !state?.over && !saving && !finishRequested
          }
        >
          <DialogHeader>
            <DialogTitle>
              {saved
                ? 'A good time. On the record.'
                : state?.over
                  ? 'OUT OF OFFICE.'
                  : 'Ready to switch off?'}
            </DialogTitle>
            <DialogDescription>
              {saved
                ? 'Your best saved run joins the worldwide departure board.'
                : state?.over
                  ? 'No pieces fit. That was a lovely escape.'
                  : 'Save your score and finish this run, or stay a little longer.'}
            </DialogDescription>
          </DialogHeader>
          <div className="endless-result">
            <InfinityIcon size={28} />
            <strong>{number(state?.score || 0)}</strong>
            <span>
              {state?.lines || 0} LINES · {state?.turn || 0} PIECES ·{' '}
              {stop.code}
            </span>
          </div>
          {!saved && mode === 'ranked' && !!state?.turn && (
            <div className="traveler-field">
              <label htmlFor="traveler-name">
                YOUR NAME ON THE DEPARTURE BOARD
              </label>
              <Input
                id="traveler-name"
                value={name}
                maxLength={18}
                disabled={saving}
                autoComplete="nickname"
                onChange={(event) => setName(event.target.value)}
              />
              <small>Public name · 2–18 characters · one best per wallet</small>
              {wallet.address ? (
                <small>
                  Saved for {shortAddress(wallet.address)} · Robinhood Chain
                </small>
              ) : (
                <Button variant="outline" onClick={wallet.open}>
                  LINK WALLET TO SAVE YOUR RECORD
                </Button>
              )}
            </div>
          )}
          {syncError && (
            <p className="endless-notice" role="alert">
              {syncError}
            </p>
          )}
          {saved && <Leaderboard refresh={1} />}
          {mode === 'practice' && (
            <p className="endless-notice">
              Practice score saved on this device only. Start a new run to try
              connecting to the worldwide board.
            </p>
          )}
          <div className="endless-finish-actions">
            {!saved && mode === 'ranked' && !!state?.turn && (
              <Button
                className="primary-button"
                disabled={saving}
                onClick={() => void save()}
              >
                <Save size={17} />
                {saving
                  ? 'SAVING…'
                  : wallet.address
                    ? 'SAVE TO TOP & FINISH'
                    : 'CONNECT WALLET TO SAVE'}
              </Button>
            )}
            {!saved && !state?.over && !finishRequested && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setFinishOpen(false)}
              >
                KEEP PLAYING <ArrowRight size={17} />
              </Button>
            )}
            {(saved || state?.over || mode === 'practice') && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void begin()}
              >
                NEW ESCAPE <Plane size={17} />
              </Button>
            )}
            <Button variant="ghost" disabled={saving} onClick={onExit}>
              {saved
                ? 'DEPARTURES'
                : state?.turn
                  ? 'LEAVE WITHOUT SAVING TO TOP'
                  : 'DEPARTURES'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
