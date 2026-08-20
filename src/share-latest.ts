import { shareReplay } from 'rxjs';

/**
 * Shares one upstream execution, replays the latest emitted value to new
 * subscribers, and disconnects upstream when the last subscriber leaves.
 *
 * Canonical rxjs-bindings policy for remembered state streams.
 */
export const shareLatest = <T>() =>
  shareReplay<T>({
    bufferSize: 1,
    refCount: true,
  });
