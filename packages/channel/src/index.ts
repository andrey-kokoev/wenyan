export interface ChannelEvent {
  id: string;
  type: 'transition.committed' | 'message.rejected' | 'archive.appended';
  messageId: string;
  payload: Record<string, unknown>;
  at: string;
}

type Subscriber = (event: ChannelEvent) => void;

export class ReliableChannel {
  private subscribers = new Set<Subscriber>();
  private seen = new Set<string>();
  private log: ChannelEvent[] = [];

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  publish(event: ChannelEvent): boolean {
    if (this.seen.has(event.id)) {
      return false;
    }
    this.seen.add(event.id);
    this.log.push(event);
    for (const s of this.subscribers) {
      s(event);
    }
    return true;
  }

  replay(sinceIso: string): ChannelEvent[] {
    return this.log.filter((e) => e.at >= sinceIso);
  }
}

export * from './merkle'
