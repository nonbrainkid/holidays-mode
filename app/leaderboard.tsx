'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, Trophy, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DESTINATIONS } from '@/lib/destinations';
import { shortAddress, RH_CHAIN } from '@/lib/chain';
import { useWallet } from './wallet';
type Entry = {
  rank: number;
  address: string;
  name: string;
  destination: string;
  score: number;
  lines: number;
};
export default function Leaderboard({ refresh = 0 }: { refresh?: number }) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'),
    [attempt, setAttempt] = useState(0);
  const [personal, setPersonal] = useState<Entry | null>(null),
    wallet = useWallet();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let live = true;
    fetch('/api/game', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.entries))
          throw new Error('Unavailable');
        if (live) {
          setEntries(data.entries);
          setPersonal(data.personal || null);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (live) setStatus('error');
      })
      .finally(() => clearTimeout(timer));
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, refresh, wallet.address]);
  return (
    <div className="leaderboard-content">
      <div className="leaderboard-label">
        <span>
          <span className="status-dot" /> WORLDWIDE · ALL TIME
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={status === 'loading'}
          onClick={() => setAttempt((v) => v + 1)}
          aria-label="Refresh leaderboard"
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {status === 'loading' ? (
        <div className="leaderboard-empty" aria-live="polite">
          <Plane size={30} />
          <p>Checking the departure board…</p>
        </div>
      ) : status === 'error' ? (
        <div className="leaderboard-empty" aria-live="polite">
          <Trophy size={30} />
          <p>The departure board is taking a small break.</p>
          <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
            TRY AGAIN
          </Button>
        </div>
      ) : !entries.length ? (
        <div className="leaderboard-empty">
          <Trophy size={38} />
          <h3>The first seat is yours.</h3>
          <p>
            Finish an endless run and save your score.
            <br />
            Your name could be the first on the board.
          </p>
        </div>
      ) : (
        <div className="leaderboard-scroll">
          <table className="leaderboard-table">
            <caption className="sr-only">
              Top 20 endless scores worldwide
            </caption>
            <thead>
              <tr>
                <th scope="col">RANK</th>
                <th scope="col">TRAVELER</th>
                <th scope="col">SCORE</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.rank}
                  className={entry.rank <= 3 ? 'podium-place' : ''}
                >
                  <td>
                    <span className="rank-number">
                      {entry.rank === 1 ? (
                        <Trophy size={18} />
                      ) : (
                        String(entry.rank).padStart(2, '0')
                      )}
                    </span>
                  </td>
                  <td>
                    <b>{entry.name}</b>
                    <a
                      className="leaderboard-address"
                      href={`${RH_CHAIN.blockExplorers.default.url}/address/${entry.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {shortAddress(entry.address)}
                    </a>
                    <small>
                      {DESTINATIONS.find((d) => d.id === entry.destination)
                        ?.code || 'HM'}{' '}
                      · {entry.lines} LINES
                    </small>
                  </td>
                  <td>{entry.score.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === 'ready' && personal && (
        <div className="leaderboard-personal">
          <span>
            YOUR SEAT <b>#{personal.rank}</b>
          </span>
          <span>
            {shortAddress(personal.address)}
            <strong>{personal.score.toLocaleString('en-US')} POINTS</strong>
          </span>
        </div>
      )}
      {!wallet.address && (
        <Button variant="outline" onClick={wallet.open}>
          LINK WALLET · FIND YOUR RECORD
        </Button>
      )}
      <p className="leaderboard-note">
        One personal best per verified wallet. Records stay with your address
        across devices. Endless scores only. Tap refresh for the latest
        standings.
      </p>
    </div>
  );
}
