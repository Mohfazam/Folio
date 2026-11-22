export interface SilenceWatchdogCallbacks {
  onNudge: (promptText: string) => void | Promise<void>;
  onHangup: (reason: string) => void | Promise<void>;
}

export interface SilenceWatchdogOptions {
  nudgeTimeoutMs?: number; // default: 7000ms (7s)
  language?: string;
}

export class SilenceWatchdog {
  private timer: NodeJS.Timeout | null = null;
  private cycle = 0;
  private closed = false;
  private readonly nudgeTimeoutMs: number;
  private readonly language: string;
  private readonly callbacks: SilenceWatchdogCallbacks;

  constructor(callbacks: SilenceWatchdogCallbacks, options?: SilenceWatchdogOptions) {
    this.callbacks = callbacks;
    this.nudgeTimeoutMs = options?.nudgeTimeoutMs ?? 7000;
    this.language = options?.language ?? "en-IN";
  }

  public reset(isSpeakingOrTurnActive = false): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.closed || isSpeakingOrTurnActive) return;

    this.timer = setTimeout(() => this.handleTimeout(), this.nudgeTimeoutMs);
    this.timer.unref();
  }

  public registerSpeech(): void {
    // Reset cycle count when user speaks
    this.cycle = 0;
    this.reset();
  }

  public pause(durationMs = 25000): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.closed) return;
    this.timer = setTimeout(() => {
      this.reset();
    }, durationMs);
    this.timer.unref();
  }

  private async handleTimeout(): Promise<void> {
    if (this.closed) return;
    this.cycle++;

    const isHindi = this.language.startsWith("hi");

    if (this.cycle === 1) {
      const text = isHindi ? "Hello? Kya aap sun pa rahe hain?" : "Hello? Are you still with me?";
      await this.callbacks.onNudge(text);
      this.reset();
    } else if (this.cycle === 2) {
      const text = isHindi
        ? "Line thodi shaant lag rahi hai. Kya aapko meri aawaz aa rahi hai?"
        : "The connection seems quiet. Can you hear me okay?";
      await this.callbacks.onNudge(text);
      this.reset();
    } else if (this.cycle >= 3) {
      const text = isHindi
        ? "Aisa lag raha hai connection me dikkat hai. Main aapko baad me call karti hoon. Namaste! [HANGUP]"
        : "It seems we have a connection issue. I'll reach out again later. Have a great day! [HANGUP]";
      await this.callbacks.onHangup(text);
    }
  }

  public stop(): void {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
