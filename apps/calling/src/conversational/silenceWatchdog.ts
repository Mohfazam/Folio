export interface SilenceWatchdogCallbacks {
  onNudge: (promptText: string) => void | Promise<void>;
  onHangup: (reason: string) => void | Promise<void>;
}

export interface SilenceWatchdogOptions {
  nudgeTimeoutMs?: number; // default: 8000ms (8s of complete silence after speech ends)
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
    this.nudgeTimeoutMs = options?.nudgeTimeoutMs ?? 8000;
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

  public pause(durationMs = 5000): void {
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
      const text = isHindi ? "Hello, kya aap sun pa rahe hain?" : "Hello, are you still there?";
      await this.callbacks.onNudge(text);
      this.pause(6000);
    } else if (this.cycle === 2) {
      const text = isHindi
        ? "Kya aapko meri aawaz aa rahi hai?"
        : "Just checking in, can you hear me okay?";
      await this.callbacks.onNudge(text);
      this.pause(8000);
    } else if (this.cycle === 3) {
      const text = isHindi
        ? "Main yahi hoon, jab aap tayyar hon batayein."
        : "I'm right here whenever you're ready.";
      await this.callbacks.onNudge(text);
      this.pause(10000);
    } else if (this.cycle >= 4) {
      const text = isHindi
        ? "Aisa lag raha hai sampark toot gaya hai. Main baad me call karti hoon. Namaste! [HANGUP]"
        : "Seems like we lost the connection. I'll follow up later. Have a wonderful day! [HANGUP]";
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
