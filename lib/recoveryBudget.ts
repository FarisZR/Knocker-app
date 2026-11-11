/** Bounds automatic recovery independently of grant timestamps and UI refreshes. */
export class RecoveryBudget {
  private attempts = new Map<string, { count: number; nextAt: number }>();
  constructor(
    private limit = 3,
    private delay = 30000,
  ) {}

  /** Allows a delayed retry only after this target/connection has already failed. */
  ready(key: string, now = Date.now()): boolean {
    const entry = this.attempts.get(key);
    return !!entry && entry.count < this.limit && now >= entry.nextAt;
  }

  /** Claims one automatic attempt without allowing immediate success-feedback loops. */
  claim(key: string, now = Date.now()): boolean {
    const entry = this.attempts.get(key);
    if (entry && (entry.count >= this.limit || now < entry.nextAt))
      return false;
    this.attempts.set(key, {
      count: (entry?.count ?? 0) + 1,
      nextAt: now + this.delay,
    });
    if (this.attempts.size > 64)
      this.attempts.delete(this.attempts.keys().next().value!);
    return true;
  }

  /** A known status no longer needs failure retries. */
  forget(key: string): void {
    this.attempts.delete(key);
  }
}
