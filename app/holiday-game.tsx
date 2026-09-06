'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Luggage,
  MapPin,
  Plane,
  RotateCw,
  Share2,
  Stamp,
  Sun,
  Undo2,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  boardFor,
  canPlace,
  dailyBlocks,
  PIECES,
  rotate,
  scoreFor,
  SIZE,
  type Placement,
} from '@/lib/game-engine';
import { DESTINATIONS, type Destination } from '@/lib/destinations';
import {
  completionScore,
  destinationStats,
  formatTime,
  PASSPORT_KEY,
  parsePassport,
  mergePassports,
  saveCompletion,
  unlockedThrough,
  validDay,
  type PassportRecord,
} from '@/lib/passport';
import { TOKEN } from '@/lib/token-config';
import world from '@/lib/world-map.json';

const today = () => new Date().toISOString().slice(0, 10);
const theme = (d: Destination) =>
  ({ '--destination': d.color, '--destination-ink': d.ink }) as CSSProperties;
type Phase = 'home' | 'playing' | 'finished';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

function ModeBadge() {
  return (
    <span className="mode-badge">
      MODE: ON <span />
    </span>
  );
}
function Brand() {
  return (
    <span className="brand">
      <img
        src="/brand/holidays-mode-icon.png"
        alt=""
        width="400"
        height="400"
      />
      <span>
        HOLIDAYS
        <br />
        MODE
      </span>
    </span>
  );
}
function DestinationArt({ destination }: { destination: Destination }) {
  return (
    <div
      className="destination-art"
      role="img"
      aria-label={`Retro travel illustration of ${destination.name}`}
      style={{ backgroundPosition: destination.artPosition }}
    />
  );
}
function PassportStamp({
  destination,
  earned = false,
}: {
  destination: Destination;
  earned?: boolean;
}) {
  return (
    <div
      className={'passport-stamp ' + (earned ? 'is-earned' : '')}
      style={theme(destination)}
    >
      <span>{destination.stamp}</span>
      {destination.id === 'tokyo' ? (
        <Globe2 size={33} />
      ) : destination.id === 'ibiza' ? (
        <Sun size={35} />
      ) : destination.id === 'rio' ? (
        <Waves size={35} />
      ) : (
        <Plane size={35} />
      )}
      <strong>{destination.code}</strong>
      <span>{destination.name.toUpperCase()} · HOLIDAYS MODE</span>
    </div>
  );
}
function TileMotif() {
  return (
    <div className="tile-motif" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className={`motif-${i}`}>
          {i === 3 ? (
            <Sun />
          ) : i === 8 ? (
            <Plane />
          ) : i === 9 || i === 10 ? (
            <Waves />
          ) : i === 14 ? (
            <span className="motif-on">
              ON <i />
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
function TokenCard({ openNotes }: { openNotes: () => void }) {
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(TOKEN.address!);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <section className="token-section" id="token">
      <div>
        <p className="eyebrow">A LITTLE MORE HOLIDAYS</p>
        <h2>
          Good times.
          <br />
          Onchain.
        </h2>
        <p>The game comes first. Our next departure is on Robinhood Chain.</p>
        <a
          className="text-link"
          href={TOKEN.socialUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Follow the departure updates <ArrowRight size={17} />
        </a>
      </div>
      <div className="token-card">
        <div className="token-card-top">
          <Brand />
          <span className="launch-badge">
            {TOKEN.address ? 'LIVE ON PONS' : 'PRE-LAUNCH'}
          </span>
        </div>
        <dl>
          <div>
            <dt>NETWORK</dt>
            <dd>
              Robinhood Chain <span className="network-dot" />
            </dd>
          </div>
          <div>
            <dt>LAUNCH PLATFORM</dt>
            <dd>
              <a
                href={TOKEN.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                pons <ExternalLink size={14} />
              </a>
            </dd>
          </div>
          <div>
            <dt>TOKEN SYMBOL</dt>
            <dd>{TOKEN.symbol ? `$${TOKEN.symbol}` : 'To be announced'}</dd>
          </div>
        </dl>
        <div className="contract-field">
          <span className="eyebrow">CONTRACT ADDRESS</span>
          {TOKEN.address ? (
            <div className="contract-value">
              <code>{TOKEN.address}</code>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy contract address"
                onClick={copy}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          ) : (
            <p>Not deployed yet. The verified address will appear here.</p>
          )}
          {copyError ? (
            <Input
              value={TOKEN.address || ''}
              readOnly
              aria-label="Select and copy the contract address"
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
        </div>
        <div className="token-links">
          <button className="text-link" onClick={openNotes}>
            Tokenomics & launch notes <ArrowRight size={15} />
          </button>
          {TOKEN.address ? (
            <a
              className="text-link"
              href={TOKEN.explorerBase + TOKEN.address}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explorer <ExternalLink size={15} />
            </a>
          ) : null}
          {TOKEN.tradeUrl ? (
            <a
              className="text-link"
              href={TOKEN.tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on pons <ExternalLink size={15} />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function HolidayGame() {
  const [day, setDay] = useState(''),
    [selectedStop, setSelectedStop] = useState(0);
  const [phase, setPhase] = useState<Phase>('home');
  const [placements, setPlacements] = useState<Placement[]>([]),
    placementsRef = useRef<Placement[]>([]);
  const [selected, setSelected] = useState(PIECES[0].id),
    [rotation, setRotation] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [hover, setHover] = useState<number | null>(null);
  const startedAt = useRef(0),
    running = useRef(false);
  const [records, setRecords] = useState<PassportRecord[]>([]),
    [ready, setReady] = useState(false);
  const [storageNote, setStorageNote] = useState(
      'Your passport is saved in this browser.',
    ),
    [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<
      'rules' | 'passport' | 'postcard' | 'tokenomics' | null
    >(null),
    [postcard, setPostcard] = useState(0);
  const [shared, setShared] = useState(false),
    [shareFallback, setShareFallback] = useState('');
  const [resultScore, setResultScore] = useState(0),
    [newBest, setNewBest] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const stop = DESTINATIONS[selectedStop],
    blocks = useMemo(() => dailyBlocks(day, selectedStop), [day, selectedStop]);
  const board = useMemo(
    () => boardFor(placements, blocks),
    [placements, blocks],
  );
  const stats = destinationStats(records, stop.id),
    unlocked = unlockedThrough(records);
  const stamps = DESTINATIONS.filter((d) =>
    records.some((r) => r.stop === d.id),
  ).length;
  const chosen = PIECES.find((p) => p.id === selected)!;
  const currentScore =
    phase === 'finished' ? resultScore : scoreFor(placements, blocks);
  const preview =
    hover === null
      ? []
      : rotate(chosen.cells, rotation).map(([x, y]) => [
          (hover % SIZE) + x,
          Math.floor(hover / SIZE) + y,
        ]);
  const fits =
    hover !== null &&
    canPlace(
      placements,
      selected,
      hover % SIZE,
      Math.floor(hover / SIZE),
      rotation,
      blocks,
    );

  useEffect(() => {
    const params = new URLSearchParams(location.search),
      requested = params.get('date');
    const date =
      validDay(requested) && requested <= today() ? requested : today();
    let loaded: PassportRecord[] = [];
    try {
      loaded = parsePassport(localStorage.getItem(PASSPORT_KEY));
    } catch {
      setStorageNote(
        'Browser storage is unavailable. Keep this tab open to keep your passport.',
      );
    }
    setRecords(loaded);
    setDay(date);
    const index = DESTINATIONS.findIndex((s) => s.id === params.get('stop'));
    if (index >= 0 && index <= unlockedThrough(loaded)) setSelectedStop(index);
    else if (index > 0)
      setMessage(
        `Complete the earlier destinations to unlock ${DESTINATIONS[index].name}.`,
      );
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const persist = () => {
      try {
        const saved = parsePassport(localStorage.getItem(PASSPORT_KEY)),
          merged = mergePassports(saved, records),
          serialized = JSON.stringify(merged);
        if (serialized !== JSON.stringify(saved))
          localStorage.setItem(PASSPORT_KEY, serialized);
        setRecords((previous) => {
          const next = mergePassports(previous, merged);
          return JSON.stringify(previous) === JSON.stringify(next)
            ? previous
            : next;
        });
      } catch {
        setStorageNote(
          'Browser storage is unavailable. Keep this tab open to keep your passport.',
        );
      }
    };
    if (navigator.locks?.request)
      void navigator.locks
        .request('holidays-mode-passport', persist)
        .catch(persist);
    else persist();
  }, [records, ready]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === PASSPORT_KEY && event.newValue)
        setRecords((previous) =>
          mergePassports(previous, parsePassport(event.newValue)),
        );
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)),
      );
    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== 'home') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [phase]);

  const finish = useCallback(
    (next: Placement[]) => {
      if (!running.current || next.length !== PIECES.length) return;
      const seconds = Math.max(
          0,
          Math.floor((Date.now() - startedAt.current) / 1000),
        ),
        earned = completionScore(seconds);
      if (scoreFor(next, blocks) !== 1000) return;
      running.current = false;
      setElapsed(seconds);
      setResultScore(earned);
      setNewBest(earned > stats.best);
      setHover(null);
      setMessage('');
      setPhase('finished');
      setRecords((old) =>
        saveCompletion(old, { day, stop: stop.id, score: earned, seconds }),
      );
    },
    [blocks, day, stop.id, stats.best],
  );
  function start() {
    if (!ready || selectedStop > unlocked) return;
    const requested = new URLSearchParams(location.search).get('date');
    setDay(validDay(requested) && requested <= today() ? requested : today());
    placementsRef.current = [];
    setPlacements([]);
    setSelected(PIECES[0].id);
    setRotation(0);
    setElapsed(0);
    setHover(null);
    setShared(false);
    setShareFallback('');
    setMessage('');
    startedAt.current = Date.now();
    running.current = true;
    setPhase('playing');
  }
  function goHome() {
    running.current = false;
    placementsRef.current = [];
    setPlacements([]);
    setHover(null);
    setMessage('');
    setPhase('home');
  }
  function chooseDestination(index: number) {
    if (phase === 'playing') return;
    if (index > unlocked) {
      setMessage(
        `Stamp your ${DESTINATIONS[index - 1].name} page to unlock ${DESTINATIONS[index].name}.`,
      );
      return;
    }
    placementsRef.current = [];
    setPlacements([]);
    setSelectedStop(index);
    setMessage('');
    setPhase('home');
  }
  function unpack(id: string) {
    if (!running.current) return;
    const next = placementsRef.current.filter((p) => p.id !== id);
    placementsRef.current = next;
    setPlacements(next);
    setSelected(id);
    setRotation(0);
    setMessage('A little rearranging. You’ve got this.');
  }
  function tryPlace(id: string, x: number, y: number, turns: number) {
    if (!running.current) return false;
    if (!canPlace(placementsRef.current, id, x, y, turns, blocks)) {
      setMessage('Not quite. Rotate the piece or try another square.');
      return false;
    }
    const next = [...placementsRef.current, { id, x, y, rotation: turns }];
    placementsRef.current = next;
    setPlacements(next);
    setRotation(0);
    setHover(null);
    setMessage('');
    const nextPiece = PIECES.find((p) => !next.some((v) => v.id === p.id));
    if (nextPiece) setSelected(nextPiece.id);
    else finish(next);
    return true;
  }
  function place(index: number) {
    const x = index % SIZE,
      y = Math.floor(index / SIZE);
    if (canPlace(placementsRef.current, selected, x, y, rotation, blocks)) {
      tryPlace(selected, x, y, rotation);
      return;
    }
    if (board[index] && board[index] !== '#') unpack(board[index]!);
    else tryPlace(selected, x, y, rotation);
  }
  function boardKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const directions: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -SIZE,
      ArrowDown: SIZE,
    };
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      setRotation((r) => (r + 1) % 4);
      return;
    }
    if (event.key in directions) {
      event.preventDefault();
      const next = Math.min(35, Math.max(0, index + directions[event.key]));
      boardRef.current
        ?.querySelectorAll<HTMLButtonElement>('.bag-cell')
        [next]?.focus();
    }
  }
  async function share() {
    const url = new URL(location.origin);
    url.searchParams.set('stop', stop.id);
    url.searchParams.set('date', day);
    const text = `OUT OF OFFICE. ${resultScore.toLocaleString()} points in ${stop.name}. Your turn. Holidays Mode.`;
    try {
      if (navigator.share)
        await navigator.share({
          title: 'Holidays Mode',
          text,
          url: url.toString(),
        });
      else await navigator.clipboard.writeText(text + ' ' + url);
      setShared(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setShareFallback(url.toString());
    }
  }
  const api = useRef<{
    state: () => unknown;
    start: () => unknown;
    place: (input: unknown) => unknown;
  } | null>(null);
  api.current = {
    state: () => ({
      phase,
      day,
      destination: stop.id,
      elapsed,
      score: currentScore,
      board,
      placements,
      unlocked: DESTINATIONS.slice(0, unlocked + 1).map((d) => d.id),
      items: PIECES.map((p) => ({ id: p.id, cells: p.cells })),
    }),
    start: () => {
      if (!ready || phase === 'playing' || selectedStop > unlocked)
        throw new Error('Round cannot start');
      flushSync(start);
      return { status: 'started' };
    },
    place: (input: unknown) => {
      const value = input as Record<string, unknown>;
      if (
        !value ||
        typeof value.pieceId !== 'string' ||
        ![value.x, value.y, value.rotation].every(Number.isInteger) ||
        (value.rotation as number) < 0 ||
        (value.rotation as number) > 3
      )
        throw new Error('Invalid move input');
      let ok = false;
      flushSync(() => {
        ok = tryPlace(
          value.pieceId as string,
          value.x as number,
          value.y as number,
          value.rotation as number,
        );
      });
      if (!ok) throw new Error('Invalid move');
      return { status: 'placed' };
    },
  };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const tools: Tool[] = [
      {
        name: 'get_escape_state',
        description:
          'Read the current Holidays Mode puzzle, destination and passport unlocks.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => api.current?.state(),
      },
      {
        name: 'start_packing_round',
        description:
          'Start the currently selected unlocked destination puzzle.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: () => api.current?.start(),
      },
      {
        name: 'place_packing_item',
        description:
          'Place a puzzle piece using the same game rules as the interface. Coordinates are zero based.',
        inputSchema: {
          type: 'object',
          properties: {
            pieceId: { type: 'string', enum: PIECES.map((p) => p.id) },
            x: { type: 'integer', minimum: 0, maximum: 5 },
            y: { type: 'integer', minimum: 0, maximum: 5 },
            rotation: { type: 'integer', minimum: 0, maximum: 3 },
          },
          required: ['pieceId', 'x', 'y', 'rotation'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input) => api.current?.place(input),
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, []);

  return (
    <div className="holidays-app">
      <header className="site-header">
        <a
          href="/"
          aria-label="Holidays Mode home"
          onClick={(event) => {
            event.preventDefault();
            goHome();
          }}
        >
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a
            href="#destinations"
            onClick={(event) => {
              if (phase !== 'home') {
                event.preventDefault();
                goHome();
              }
            }}
          >
            DESTINATIONS
          </a>
          <button onClick={() => setDialog('rules')}>HOW TO PLAY</button>
          <a
            href={TOKEN.socialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Holidays Mode on X"
            className="social-link"
          >
            𝕏 <ExternalLink size={12} />
          </a>
        </nav>
        <Button
          className="passport-button"
          variant="outline"
          onClick={() => setDialog('passport')}
        >
          <BookOpen size={16} />
          MY PASSPORT <span>{stamps}/4</span>
        </Button>
      </header>
      <main>
        {phase === 'home' ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="hero-topline">
                  <span className="eyebrow">YOUR NEXT LITTLE ESCAPE</span>
                  <ModeBadge />
                </div>
                <h1>
                  HOLIDAYS
                  <br />
                  MODE
                  <span className="headline-sun">
                    <Sun strokeWidth={1.7} />
                  </span>
                </h1>
                <p className="hero-tagline">A small break goes a long way.</p>
                <p className="hero-description">
                  Pick a destination, beat your best
                  <br className="desktop-break" /> and fill your passport.
                </p>
                <div className="hero-actions">
                  <Button
                    className="primary-button"
                    disabled={!ready}
                    onClick={start}
                  >
                    PLAY <ArrowRight size={21} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="secondary-button"
                    onClick={() => setDialog('passport')}
                  >
                    VIEW PASSPORT <BookOpen size={17} />
                  </Button>
                </div>
                <div className="hero-footnote">
                  <span className="status-dot" /> FREE TO PLAY <span>·</span> NO
                  WALLET NEEDED
                </div>
              </div>
              <div className="hero-visual">
                <div className="visual-eyebrow">
                  <span>ONE LAST PUZZLE.</span>
                  <ArrowDown size={17} />
                  <span>THEN YOU’RE OFF.</span>
                </div>
                <button
                  className="hero-puzzle"
                  onClick={start}
                  disabled={!ready}
                  aria-label={`Play the ${stop.name} puzzle`}
                >
                  <TileMotif />
                  <span className="puzzle-callout">
                    <Plane size={19} /> READY FOR TAKE-OFF{' '}
                    <ArrowRight size={17} />
                  </span>
                </button>
                <div className="good-times-stamp">
                  <Sun size={26} />
                  <span>GOOD TIMES</span>
                  <small>ANYWHERE</small>
                </div>
                <div className="hero-ticket">
                  <span className="ticket-icon">
                    <Plane size={22} />
                  </span>
                  <span>
                    <small>NEXT DESTINATION</small>
                    <b>{stop.name.toUpperCase()}</b>
                  </span>
                  <span className="ticket-code">{stop.code}</span>
                  <span className="barcode" aria-hidden="true" />
                </div>
              </div>
            </section>
            <div className="travel-marquee" aria-hidden="true">
              <span>TRAVEL</span>
              <Sun />
              <span>PLAY</span>
              <Plane />
              <span>COLLECT</span>
              <Stamp />
              <span>REPEAT</span>
              <Waves />
              <span>TRAVEL</span>
              <Sun />
              <span>PLAY</span>
              <Plane />
              <span>COLLECT</span>
            </div>
            <section className="destination-section" id="destinations">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">DEPARTURES · FIRST SEASON</p>
                  <h2>Where to?</h2>
                </div>
                <p>
                  Four destinations. One holiday state of mind.
                  <br />
                  Complete a puzzle to open your next departure.
                </p>
              </div>
              <div className="destination-grid">
                {DESTINATIONS.map((d, index) => {
                  const data = destinationStats(records, d.id),
                    locked = index > unlocked;
                  return (
                    <button
                      key={d.id}
                      className={
                        'boarding-card ' +
                        (selectedStop === index ? 'boarding-selected ' : '') +
                        (locked ? 'boarding-locked' : '')
                      }
                      style={theme(d)}
                      onClick={() => chooseDestination(index)}
                      aria-pressed={selectedStop === index}
                      aria-label={`${d.name}, ${locked ? 'locked. Complete ' + DESTINATIONS[index - 1].name : data.completed ? 'stamped, select destination' : 'ready to play'}`}
                    >
                      <div className="boarding-title">
                        <Plane size={21} />
                        <h3>{d.name.toUpperCase()}</h3>
                        <span>{d.code}</span>
                      </div>
                      <div className="boarding-picture">
                        <DestinationArt destination={d} />
                        <span
                          className={
                            'boarding-status ' +
                            (data.completed ? 'status-stamped' : '')
                          }
                        >
                          {locked ? (
                            <LockKeyhole size={12} />
                          ) : data.completed ? (
                            <CheckCheck size={13} />
                          ) : (
                            <span className="status-dot" />
                          )}
                          {locked
                            ? 'NEXT DEPARTURE'
                            : data.completed
                              ? 'PASSPORT STAMPED'
                              : 'READY TO BOARD'}
                        </span>
                      </div>
                      <div className="boarding-info">
                        <p>{d.mood}</p>
                        <div>
                          <span>
                            BEST SCORE
                            <b>
                              {data.best ? data.best.toLocaleString() : '—'}
                            </b>
                          </span>
                          <span>
                            PUZZLES
                            <b>{data.completed.toString().padStart(2, '0')}</b>
                          </span>
                          <span className="boarding-go">
                            {locked ? (
                              <LockKeyhole size={18} />
                            ) : (
                              <ArrowRight size={21} />
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="boarding-tear">
                        <span className="barcode" aria-hidden="true" />
                        <span>
                          {locked
                            ? `STAMP ${DESTINATIONS[index - 1].code} TO UNLOCK`
                            : `HM-${(index + 1).toString().padStart(3, '0')} · ${d.country.toUpperCase()}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="selection-message" role="status">
                {message ||
                  `${stop.name} is your next stop. Your suitcase is waiting.`}
              </p>
              <div className="destination-bottom">
                <span>
                  <MapPin size={15} /> {stop.name.toUpperCase()} ·{' '}
                  {stop.country.toUpperCase()}
                </span>
                <Button
                  className="primary-button compact-button"
                  onClick={start}
                  disabled={!ready}
                >
                  PLAY {stop.code} <ArrowRight size={17} />
                </Button>
              </div>
            </section>
            <section className="passport-teaser">
              <div className="passport-teaser-copy">
                <p className="eyebrow">LESS SCREEN TIME. MORE STAMP TIME.</p>
                <h2>
                  Your passport.
                  <br />
                  Your little
                  <br />
                  <em>getaway collection.</em>
                </h2>
                <p>
                  Finish the grid. Earn your stamp.
                  <br />
                  Collect a postcard from every stop.
                </p>
                <Button
                  variant="outline"
                  className="secondary-button"
                  onClick={() => setDialog('passport')}
                >
                  OPEN MY PASSPORT <BookOpen size={17} />
                </Button>
                <span className="storage-note">{storageNote}</span>
              </div>
              <div className="passport-display">
                <div className="passport-cover">
                  <Globe2 size={44} strokeWidth={1} />
                  <span>
                    HOLIDAYS
                    <br />
                    MODE
                  </span>
                  <small>WORLDWIDE · GOOD TIMES</small>
                  <b>PASSPORT</b>
                  <Plane size={25} />
                </div>
                <div className="passport-page">
                  <div className="passport-page-header">
                    DEPARTURE MEMORIES <span>{stamps}/4</span>
                  </div>
                  <div className="passport-preview-stamps">
                    {DESTINATIONS.map((d) => (
                      <PassportStamp
                        key={d.id}
                        destination={d}
                        earned={records.some((r) => r.stop === d.id)}
                      />
                    ))}
                  </div>
                  <span className="passport-page-number">
                    KEEP GOING. THE WORLD IS WAITING. · 01
                  </span>
                </div>
              </div>
            </section>
            <section className="route-section">
              <div>
                <p className="eyebrow">SAME PLANET. MORE HOLIDAYS.</p>
                <h2>
                  A world worth
                  <br />
                  switching off for.
                </h2>
                <p>
                  Bali → Tokyo → Ibiza → Rio.
                  <br />
                  Your first season of small escapes.
                </p>
              </div>
              <div className="route-map">
                <svg viewBox="0 0 960 500" aria-hidden="true">
                  <path d={world.outline} fill="currentColor" />
                </svg>
                {DESTINATIONS.map((d, index) => (
                  <button
                    key={d.id}
                    className={
                      'route-pin ' + (index > unlocked ? 'pin-locked' : '')
                    }
                    style={{
                      left:
                        ((480 + (d.lon * 146 * Math.PI) / 180) / 960) * 100 +
                        '%',
                      top:
                        ((255 - (d.lat * 146 * Math.PI) / 180) / 500) * 100 +
                        '%',
                      ...theme(d),
                    }}
                    onClick={() => {
                      chooseDestination(index);
                      document
                        .getElementById('destinations')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    aria-label={`Select ${d.name}`}
                  >
                    <span>
                      {index > unlocked ? (
                        <LockKeyhole size={13} />
                      ) : (
                        <Plane size={16} />
                      )}
                    </span>
                    <b>{d.code}</b>
                  </button>
                ))}
              </div>
            </section>
            <TokenCard openNotes={() => setDialog('tokenomics')} />
            <section className="signoff">
              <span className="eyebrow">YOUR INBOX CAN WAIT.</span>
              <h2>
                More holidays,
                <br />
                <em>please.</em>
              </h2>
              <ModeBadge />
              <Button
                className="primary-button"
                onClick={start}
                disabled={!ready}
              >
                ONE LITTLE PUZZLE <ArrowRight size={18} />
              </Button>
            </section>
          </>
        ) : (
          <section className="game-screen" style={theme(stop)}>
            <div className="game-navigation">
              <Button variant="ghost" onClick={goHome}>
                <ArrowLeft size={17} />
                {phase === 'playing' ? 'LEAVE PUZZLE' : 'DEPARTURES'}
              </Button>
              <span className="eyebrow">
                HM-00{selectedStop + 1} · {stop.code} · {day}
              </span>
              <ModeBadge />
            </div>
            {phase === 'finished' ? (
              <div className="completion-heading">
                <span className="eyebrow">
                  <Plane size={16} /> YOU’VE ARRIVED
                </span>
                <h1>OUT OF OFFICE.</h1>
                <p>Passport stamped. {stop.caption}</p>
              </div>
            ) : (
              <div className="game-heading">
                <div>
                  <p className="eyebrow">ONE LAST THING BEFORE YOU GO.</p>
                  <h1>Pack for {stop.name}.</h1>
                </div>
                <button
                  className="text-link"
                  onClick={() => setDialog('rules')}
                >
                  HOW TO PLAY <ChevronRight size={16} />
                </button>
              </div>
            )}
            <div
              className={
                'game-layout ' + (phase === 'finished' ? 'game-completed' : '')
              }
            >
              <div className="suitcase-panel">
                <div className="scoreboard">
                  <div>
                    <span>CURRENT SCORE</span>
                    <b>{currentScore.toLocaleString()}</b>
                  </div>
                  <div>
                    <span>PERSONAL BEST</span>
                    <b>
                      {Math.max(
                        stats.best,
                        phase === 'finished' ? resultScore : 0,
                      ).toLocaleString()}
                    </b>
                  </div>
                  <div>
                    <span>
                      <Clock size={12} /> YOUR TIME
                    </span>
                    <b>{formatTime(elapsed)}</b>
                  </div>
                </div>
                <div className="suitcase">
                  <div className="suitcase-label">
                    <Luggage size={16} />
                    <b>{stop.code}</b>
                    <span>HAVE A GOOD TRIP.</span>
                  </div>
                  <div
                    className="suitcase-grid"
                    ref={boardRef}
                    role="group"
                    aria-label="6 by 6 packing puzzle"
                  >
                    {board.map((value, index) => {
                      const piece = PIECES.find((p) => p.id === value),
                        reserved = value === '#',
                        highlight = preview.some(
                          ([x, y]) =>
                            x === index % SIZE &&
                            y === Math.floor(index / SIZE),
                        );
                      return (
                        <button
                          key={index}
                          className={
                            'bag-cell ' +
                            (reserved
                              ? 'cell-reserved '
                              : piece
                                ? 'cell-packed '
                                : '') +
                            (highlight && phase === 'playing'
                              ? fits
                                ? 'cell-preview'
                                : 'cell-invalid'
                              : '')
                          }
                          style={
                            piece ? { backgroundColor: piece.color } : undefined
                          }
                          disabled={phase !== 'playing'}
                          onClick={() => place(index)}
                          onMouseEnter={() => setHover(index)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(index)}
                          onBlur={() => setHover(null)}
                          onKeyDown={(event) => boardKey(event, index)}
                          aria-label={`Row ${Math.floor(index / SIZE) + 1}, column ${(index % SIZE) + 1}: ${reserved ? 'souvenir space' : piece ? piece.name : 'empty'}`}
                        >
                          {reserved ? (
                            <Sun size={18} />
                          ) : piece ? (
                            <span className="placed-tile-label">
                              {piece.short}
                            </span>
                          ) : (
                            <span className="cell-dot" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="suitcase-bottom">
                    <span>{placements.length} / 8 ESSENTIALS</span>
                    <Plane size={16} />
                    <span>{stop.name.toUpperCase()}</span>
                  </div>
                </div>
                <div className="mobile-board-controls">
                  <span>
                    {chosen.name}
                    <small>SELECTED PIECE</small>
                  </span>
                  <Button
                    variant="outline"
                    disabled={phase !== 'playing'}
                    onClick={() => setRotation((r) => (r + 1) % 4)}
                    aria-label="Rotate selected piece"
                  >
                    <RotateCw size={17} />
                  </Button>
                  <Button
                    variant="outline"
                    disabled={phase !== 'playing' || !placements.length}
                    onClick={() => {
                      const last = placementsRef.current.at(-1);
                      if (last) unpack(last.id);
                    }}
                    aria-label="Undo last piece"
                  >
                    <Undo2 size={17} />
                  </Button>
                </div>
                <div className="progress-line">
                  <Stamp size={16} />
                  <span>PASSPORT PROGRESS</span>
                  <b>{stamps}/4</b>
                </div>
                <Progress
                  value={(stamps / 4) * 100}
                  aria-label={`${stamps} of 4 passport stamps`}
                />
                <p className="game-message" role="status">
                  {message ||
                    (phase === 'playing'
                      ? 'Four sun squares stay free. Room for a little sunshine.'
                      : 'A well-packed suitcase. A well-earned break.')}
                </p>
              </div>
              <aside className="packing-panel">
                {phase === 'playing' ? (
                  <>
                    <span className="eyebrow">YOUR CARRY-ON</span>
                    <h2>Make a little room.</h2>
                    <p>Pick a piece. Rotate. Find its place.</p>
                    <div className="pieces-grid">
                      {PIECES.map((piece) => {
                        const packed = placements.some(
                            (p) => p.id === piece.id,
                          ),
                          cells = rotate(
                            piece.cells,
                            piece.id === selected ? rotation : 0,
                          );
                        return (
                          <button
                            key={piece.id}
                            className={
                              'piece-button ' +
                              (selected === piece.id && !packed
                                ? 'piece-selected '
                                : '') +
                              (packed ? 'piece-packed' : '')
                            }
                            onClick={() => {
                              if (packed) unpack(piece.id);
                              else {
                                setSelected(piece.id);
                                setRotation(0);
                                setMessage('');
                              }
                            }}
                            aria-pressed={selected === piece.id && !packed}
                            aria-label={`${piece.name}, ${packed ? 'packed. Tap to unpack' : 'select piece'}`}
                          >
                            <span className="piece-preview" aria-hidden="true">
                              {Array.from({ length: 9 }, (_, i) => (
                                <span
                                  key={i}
                                  style={
                                    cells.some(
                                      ([x, y]) =>
                                        x === i % 3 && y === Math.floor(i / 3),
                                    )
                                      ? { backgroundColor: piece.color }
                                      : undefined
                                  }
                                />
                              ))}
                            </span>
                            <span>{piece.name}</span>
                            {packed ? <Check size={14} /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="piece-actions">
                      <Button
                        variant="outline"
                        onClick={() => setRotation((r) => (r + 1) % 4)}
                      >
                        <RotateCw size={17} />
                        ROTATE <kbd>R</kbd>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!placements.length}
                        onClick={() => {
                          const last = placementsRef.current.at(-1);
                          if (last) unpack(last.id);
                        }}
                      >
                        <Undo2 size={17} />
                        UNDO
                      </Button>
                    </div>
                    <div className="game-tip">
                      <Sun size={21} />
                      <p>
                        No countdown. Take your time.
                        <br />
                        <span>
                          Feeling quick? Finish in under two minutes for bonus
                          points.
                        </span>
                      </p>
                    </div>
                    <span className="keyboard-note">
                      Tap a square to place. Arrow keys to move. R to rotate.
                    </span>
                  </>
                ) : (
                  <div className="arrival-card">
                    <span className="eyebrow">
                      {newBest
                        ? 'A NEW PERSONAL BEST'
                        : 'ANOTHER LITTLE ESCAPE'}
                    </span>
                    <PassportStamp destination={stop} earned />
                    <h2>
                      {resultScore.toLocaleString()}
                      <small>POINTS</small>
                    </h2>
                    <p>
                      Eight essentials. Everything fits.
                      <br />A little break, well deserved.
                    </p>
                    <div className="arrival-details">
                      <span>
                        <Clock size={15} />
                        {formatTime(elapsed)}
                      </span>
                      <span>
                        <Stamp size={15} />
                        {stamps}/4 STAMPS
                      </span>
                    </div>
                    <Button
                      className="primary-button"
                      onClick={() => {
                        setPostcard(selectedStop);
                        setDialog('postcard');
                      }}
                    >
                      VIEW YOUR POSTCARD <ArrowRight size={17} />
                    </Button>
                    <div className="arrival-actions">
                      <Button variant="outline" onClick={start}>
                        <RotateCw size={15} />
                        BEAT YOUR BEST
                      </Button>
                      <Button
                        variant="outline"
                        onClick={share}
                        aria-label="Share your result"
                      >
                        {shared ? <Check size={17} /> : <Share2 size={17} />}
                      </Button>
                    </div>
                    {shareFallback ? (
                      <Input
                        readOnly
                        value={shareFallback}
                        aria-label="Copy your challenge link"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    ) : null}
                    {selectedStop < 3 && unlocked > selectedStop ? (
                      <button
                        className="text-link next-stop-link"
                        onClick={() => {
                          chooseDestination(selectedStop + 1);
                        }}
                      >
                        NEXT STOP:{' '}
                        {DESTINATIONS[selectedStop + 1].name.toUpperCase()}{' '}
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="text-link next-stop-link"
                        onClick={() => setDialog('passport')}
                      >
                        OPEN YOUR PASSPORT <BookOpen size={16} />
                      </button>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <Brand />
        <span>TRAVEL LIGHT. PLAY MORE.</span>
        <div>
          <a href={TOKEN.socialUrl} target="_blank" rel="noopener noreferrer">
            𝕏 / HOLIDAYSMODE <ExternalLink size={13} />
          </a>
          <button onClick={() => setDialog('rules')}>HOW IT WORKS</button>
          <a href="/brand-kit">BRAND KIT</a>
        </div>
        <p>
          © {new Date().getFullYear()} Holidays Mode. An independent project.
          <br />
          Game points, postcards and passport stamps have no cash value.
        </p>
      </footer>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          className={
            'holiday-dialog ' +
            (dialog === 'passport'
              ? 'passport-dialog'
              : dialog === 'postcard'
                ? 'postcard-dialog'
                : '')
          }
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === 'rules'
                ? 'One last puzzle. Then you’re off.'
                : dialog === 'passport'
                  ? 'Your little book of good times.'
                  : dialog === 'postcard'
                    ? `Greetings from ${DESTINATIONS[postcard].name}.`
                    : 'The next departure: onchain.'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'rules'
                ? 'Eight essentials. One suitcase. A little holiday state of mind.'
                : dialog === 'passport'
                  ? storageNote
                  : dialog === 'postcard'
                    ? 'A little memory from a puzzle well packed.'
                    : 'Holidays Mode · Robinhood Chain · pons'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'rules' ? (
            <div className="rules-content">
              <ol>
                <li>
                  <b>Pick your destination.</b> Start in Bali. Complete its
                  puzzle to unlock Tokyo, then Ibiza and Rio.
                </li>
                <li>
                  <b>Make everything fit.</b> Select a piece, rotate it and tap
                  the top-left corner of its bounding box on the grid. The four
                  sun squares stay free. Tap a packed piece’s card or Undo to
                  move it.
                </li>
                <li>
                  <b>Take a little break.</b> There is no time limit. Each
                  packed square scores 25 points; finishing all eight adds 200.
                  Finish under two minutes for up to 600 extra points.
                </li>
                <li>
                  <b>Fill your passport.</b> A complete puzzle earns its
                  destination stamp and postcard. Each destination has one
                  puzzle per UTC day. Replays improve your best; they don’t add
                  duplicate completions.
                </li>
              </ol>
              <p>
                Your timer keeps running when this tab is in the background.
                Leaving a puzzle resets the unfinished round. Your passport is
                stored on this device; clearing browser data removes it.
              </p>
              <p>
                Travel artwork is illustrative. Destinations are game locations.
                Hotel bookings, discounts and NFT benefits are not available.
              </p>
            </div>
          ) : dialog === 'passport' ? (
            <div className="passport-collection">
              <div className="passport-summary">
                <Globe2 size={28} />
                <span>
                  HOLIDAYS MODE
                  <br />
                  <b>WORLDWIDE GOOD TIMES</b>
                </span>
                <strong>
                  {stamps}
                  <small>/4 STAMPS</small>
                </strong>
              </div>
              <div className="passport-collection-grid">
                {DESTINATIONS.map((d, index) => {
                  const data = destinationStats(records, d.id);
                  return (
                    <button
                      key={d.id}
                      disabled={!data.completed}
                      onClick={() => {
                        setPostcard(index);
                        setDialog('postcard');
                      }}
                    >
                      <PassportStamp
                        destination={d}
                        earned={data.completed > 0}
                      />
                      <span className="stamp-destination">
                        {d.name.toUpperCase()}
                      </span>
                      <small>
                        {data.completed
                          ? `${data.best.toLocaleString()} BEST · ${data.completed} PUZZLE${data.completed > 1 ? 'S' : ''}`
                          : 'YOUR NEXT MEMORY'}
                      </small>
                      {data.completed ? (
                        <span className="postcard-link">
                          VIEW POSTCARD <ArrowRight size={13} />
                        </span>
                      ) : (
                        <LockKeyhole size={14} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="passport-disclaimer">
                No visa required. Just one last puzzle.
              </p>
            </div>
          ) : dialog === 'postcard' ? (
            <div
              className="collectible-postcard"
              style={theme(DESTINATIONS[postcard])}
            >
              <div className="postcard-image">
                <DestinationArt destination={DESTINATIONS[postcard]} />
                <span>GREETINGS FROM</span>
                <h2>{DESTINATIONS[postcard].name.toUpperCase()}</h2>
              </div>
              <div className="postcard-back">
                <div>
                  <span className="eyebrow">
                    A SMALL BREAK GOES A LONG WAY.
                  </span>
                  <p>{DESTINATIONS[postcard].caption}</p>
                  <small>Collected in your Holidays Mode passport.</small>
                </div>
                <PassportStamp destination={DESTINATIONS[postcard]} earned />
              </div>
              <Button variant="outline" onClick={() => setDialog('passport')}>
                <ArrowLeft size={16} />
                BACK TO PASSPORT
              </Button>
            </div>
          ) : dialog === 'tokenomics' ? (
            <div className="launch-notes">
              <ModeBadge />
              <h3>More holidays. One step at a time.</h3>
              <p>
                The token is planned to launch on pons, on Robinhood Chain
                (chain ID 4663). It has not been deployed yet.
              </p>
              <dl>
                <div>
                  <dt>Token symbol & contract</dt>
                  <dd>Will be published after deployment.</dd>
                </div>
                <div>
                  <dt>Supply, distribution & fees</dt>
                  <dd>Final launch parameters have not been announced.</dd>
                </div>
                <div>
                  <dt>Game access</dt>
                  <dd>The puzzle is free to play. A wallet is not required.</dd>
                </div>
                <div>
                  <dt>Holder features</dt>
                  <dd>
                    To be announced separately. No hotel discount, NFT benefit
                    or yield is currently offered.
                  </dd>
                </div>
              </dl>
              <a
                className="text-link"
                href={TOKEN.socialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Official updates on X <ExternalLink size={16} />
              </a>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
