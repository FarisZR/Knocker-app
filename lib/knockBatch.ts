/**
 * Starts every knock before waiting for any response. Keeping dispatch in this
 * small pure helper makes the latency-sensitive concurrency contract testable.
 */
export async function knockBatch<T, R>(
  items: readonly T[],
  send: (item: T) => Promise<R>,
): Promise<Array<{ item: T; result: R }>> {
  const started = items.map((item) => ({ item, result: send(item) }));
  return Promise.all(
    started.map(async ({ item, result }) => ({ item, result: await result })),
  );
}
