import type { EndlessMove } from './endless-engine.ts';
export type RunAck = {
  revision: number;
  score: number;
  finished: boolean;
  over: boolean;
};
export type RunBatch = {
  action: 'moves';
  sessionId: string;
  revision: number;
  requestId: string;
  moves: EndlessMove[];
  finish: boolean;
  nickname: string;
};
// Keep an uncertain request intact: a retry must never count the same move twice.
export class RunSync {
  sessionId: string;
  revision = 0;
  finished = false;
  pending: EndlessMove[] = [];
  private batch: RunBatch | null = null;
  private active: Promise<void> | null = null;
  private transport: (batch: RunBatch) => Promise<RunAck>;
  constructor(
    sessionId: string,
    transport: (batch: RunBatch) => Promise<RunAck>,
  ) {
    this.sessionId = sessionId;
    this.transport = transport;
  }
  add(move: EndlessMove) {
    if (this.finished || this.batch?.finish)
      throw new Error('Run already saved or awaiting confirmation');
    this.pending.push(move);
  }
  flush(finish: boolean, nickname: string): Promise<void> {
    if (this.active)
      return this.active.then(() => this.flush(finish, nickname));
    this.active = this.send(finish, nickname).finally(() => {
      this.active = null;
    });
    return this.active;
  }
  private async send(finish: boolean, nickname: string) {
    while (!this.finished && (this.batch || this.pending.length || finish)) {
      if (!this.batch)
        this.batch = {
          action: 'moves',
          sessionId: this.sessionId,
          revision: this.revision,
          requestId: crypto.randomUUID(),
          moves: this.pending.slice(0, 24),
          finish: finish && this.pending.length <= 24,
          nickname,
        };
      const batch = this.batch,
        ack = await this.transport(batch);
      if (
        ack.revision !== batch.revision + batch.moves.length ||
        ack.finished !== batch.finish
      )
        throw new Error('Could not confirm this run. Retry saving.');
      this.pending.splice(0, batch.moves.length);
      this.revision = ack.revision;
      this.finished = ack.finished;
      this.batch = null;
    }
  }
}
