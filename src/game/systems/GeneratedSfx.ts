export type SfxName =
  | "select"
  | "locked"
  | "doorOpen"
  | "doorClose"
  | "timelineRestart"
  | "reset"
  | "levelComplete"
  | "pause"
  | "resume";

export class GeneratedSfx {
  private context: AudioContext | null = null;
  private enabled = true;

  play(name: SfxName): void {
    if (!this.enabled) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }

    switch (name) {
      case "select":
        this.tone(660, 0.07, "triangle", 0.04);
        break;

      case "locked":
        this.tone(150, 0.12, "square", 0.04);
        this.tone(110, 0.1, "square", 0.035, 0.08);
        break;

      case "doorOpen":
        this.tone(420, 0.08, "triangle", 0.035);
        this.tone(720, 0.12, "triangle", 0.035, 0.06);
        break;

      case "doorClose":
        this.tone(260, 0.08, "sawtooth", 0.03);
        this.tone(160, 0.12, "sawtooth", 0.03, 0.06);
        break;

      case "timelineRestart":
        this.tone(520, 0.08, "triangle", 0.035);
        this.tone(760, 0.08, "triangle", 0.035, 0.06);
        this.tone(1040, 0.1, "triangle", 0.03, 0.12);
        break;

      case "reset":
        this.tone(300, 0.08, "sine", 0.035);
        this.tone(180, 0.14, "sine", 0.035, 0.08);
        break;

      case "levelComplete":
        this.tone(523, 0.1, "triangle", 0.04);
        this.tone(659, 0.1, "triangle", 0.04, 0.1);
        this.tone(784, 0.18, "triangle", 0.04, 0.2);
        break;

      case "pause":
        this.tone(330, 0.08, "triangle", 0.03);
        this.tone(220, 0.1, "triangle", 0.025, 0.07);
        break;

      case "resume":
        this.tone(220, 0.08, "triangle", 0.03);
        this.tone(330, 0.1, "triangle", 0.025, 0.07);
        break;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    this.context = new AudioContextClass();
    return this.context;
  }

  private tone(
    frequency: number,
    duration: number,
    waveType: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const context = this.getContext();

    if (!context) {
      return;
    }

    const startTime = context.currentTime + delay;
    const endTime = startTime + duration;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.03);
  }
}