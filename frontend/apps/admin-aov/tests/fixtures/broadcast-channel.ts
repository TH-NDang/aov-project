/**
 * A BroadcastChannel that reaches only the channels of this test file. The DOM fixture leaves the global out, because
 * Node's own channel would carry messages between test files that run at the same time; a test that needs one installs
 * this class as the `BroadcastChannel` global.
 */
export class LocalBroadcastChannel {
  private static readonly open = new Set<LocalBroadcastChannel>()
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(readonly name: string) {
    LocalBroadcastChannel.open.add(this)
  }

  /** Delivers a copy to every other open channel of the same name, later, as a browser does. */
  postMessage(data: unknown) {
    for (const channel of LocalBroadcastChannel.open)
      if (channel !== this && channel.name === this.name) {
        const copy = structuredClone(data)
        queueMicrotask(() => channel.onmessage?.(new MessageEvent("message", { data: copy })))
      }
  }

  close() {
    LocalBroadcastChannel.open.delete(this)
  }
}
