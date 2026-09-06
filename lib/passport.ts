import { DESTINATIONS } from './destinations.ts';

export type PassportRecord = {
  day: string;
  stop: string;
  score: number;
  seconds: number;
};
export const PASSPORT_KEY = 'holidays-mode.passport.v2';
export const MAX_RECORDS = 1460;
export function validDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function completionScore(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error('Invalid completion time');
  return 1000 + Math.max(0, 120 - Math.floor(seconds)) * 5;
}
export function readPassport(raw: unknown): PassportRecord[] {
  if (!Array.isArray(raw)) return [];
  let result: PassportRecord[] = [];
  for (const value of raw.slice(-MAX_RECORDS * 2)) {
    if (
      !value ||
      !validDay(value.day) ||
      !DESTINATIONS.some((d) => d.id === value.stop) ||
      !Number.isInteger(value.seconds) ||
      value.seconds < 0 ||
      value.seconds > 31536000 ||
      value.score !== completionScore(value.seconds)
    )
      continue;
    result = saveCompletion(result, {
      day: value.day,
      stop: value.stop,
      score: value.score,
      seconds: value.seconds,
    });
  }
  return result;
}
export function saveCompletion(
  records: PassportRecord[],
  entry: PassportRecord,
): PassportRecord[] {
  const previous = records.find(
    (r) => r.day === entry.day && r.stop === entry.stop,
  );
  if (previous && previous.seconds <= entry.seconds) return records;
  return [
    ...records.filter((r) => r.day !== entry.day || r.stop !== entry.stop),
    entry,
  ].slice(-MAX_RECORDS);
}
export function parsePassport(value: string | null): PassportRecord[] {
  try {
    return readPassport(JSON.parse(value || '[]'));
  } catch {
    return [];
  }
}
export function mergePassports(
  ...sources: PassportRecord[][]
): PassportRecord[] {
  return readPassport(sources.flat()).sort(
    (a, b) => a.day.localeCompare(b.day) || a.stop.localeCompare(b.stop),
  );
}
export function unlockedThrough(records: PassportRecord[]): number {
  let index = 0;
  while (
    index < DESTINATIONS.length - 1 &&
    records.some((r) => r.stop === DESTINATIONS[index].id)
  )
    index++;
  return index;
}
export function destinationStats(records: PassportRecord[], id: string) {
  const rows = records.filter((r) => r.stop === id);
  return {
    completed: rows.length,
    best: rows.length ? Math.max(...rows.map((r) => r.score)) : 0,
    fastest: rows.length ? Math.min(...rows.map((r) => r.seconds)) : null,
  };
}
export function formatTime(seconds: number): string {
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (seconds % 60).toString().padStart(2, '0')
  );
}
