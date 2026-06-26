/**
 * Synthesizer for Thermal Printer sounds using the Web Audio API
 */
export class PrinterSoundManager {
  private ctx: AudioContext | null = null;
  private motorOsc: OscillatorNode | null = null;
  private noiseNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private volume: number = 0.5;

  constructor() {
    // Context is created lazily on user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Start the printer motor sound with a fast step buzz
   * @param speed The printer speed (1 to 5)
   */
  startPrinting(speed: number) {
    try {
      this.initContext();
      if (!this.ctx) return;

      // Stop if already running
      this.stopPrinting();

      const ctx = this.ctx;
      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);
      this.gainNode.connect(ctx.destination);

      // Create a motor frequency oscillator (hum/buzz)
      const osc = ctx.createOscillator();
      // Low square wave sounds like a stepper motor
      osc.type = 'square';
      osc.frequency.setValueAtTime(65 + speed * 10, ctx.currentTime); // Base motor frequency

      // Frequency modulation for step-jitter (LFO)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sawtooth';
      
      // Fast speed = fast steps
      const stepRate = 6 + speed * 4; 
      lfo.frequency.setValueAtTime(stepRate, ctx.currentTime);
      lfoGain.gain.setValueAtTime(40, ctx.currentTime); // jitter amplitude

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // Filter to make it less harsh and more inside the printer body
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      filter.Q.setValueAtTime(1.5, ctx.currentTime);

      // Noise source for the thermal head friction (hiss/scritch)
      // ScriptProcessor is older but widely compatible and perfect for local synthesis
      const bufferSize = 4096;
      const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
      noise.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
      };

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(800, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(0.8, ctx.currentTime);

      const noiseGain = ctx.createGain();
      // Modulate noise volume to match printing steps
      const noiseLFO = ctx.createOscillator();
      const noiseLFOGain = ctx.createGain();
      noiseLFO.type = 'square';
      noiseLFO.frequency.setValueAtTime(stepRate, ctx.currentTime);
      noiseLFOGain.gain.setValueAtTime(0.12, ctx.currentTime);

      // Connecting noise
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.gainNode);

      // Modulate noise gain to match motor rate
      noiseLFO.connect(noiseLFOGain);
      // We manually shape noise volume if we can, or just let them combine
      noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);

      // Connecting motor
      osc.connect(filter);
      filter.connect(this.gainNode);

      // Start all oscillators
      osc.start();
      lfo.start();
      noiseLFO.start();

      this.motorOsc = osc;
      // Keep references to close them later
      (this as any).lfo = lfo;
      (this as any).noiseLFO = noiseLFO;
      (this as any).noise = noise;
      (this as any).noiseGain = noiseGain;
    } catch (err) {
      console.warn('Failed to start audio synthesizer:', err);
    }
  }

  stopPrinting() {
    try {
      if (this.motorOsc) {
        this.motorOsc.stop();
        this.motorOsc.disconnect();
        this.motorOsc = null;
      }
      if ((this as any).lfo) {
        (this as any).lfo.stop();
        (this as any).lfo.disconnect();
        (this as any).lfo = null;
      }
      if ((this as any).noiseLFO) {
        (this as any).noiseLFO.stop();
        (this as any).noiseLFO.disconnect();
        (this as any).noiseLFO = null;
      }
      if ((this as any).noise) {
        (this as any).noise.disconnect();
        (this as any).noise = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
    } catch (e) {
      // Ignored
    }
  }

  /**
   * Play a crisp paper tearing sound effect (rip!)
   */
  playTear() {
    try {
      this.initContext();
      if (!this.ctx) return;

      const ctx = this.ctx;
      const now = ctx.currentTime;

      // Noise source
      const bufferSize = 2048;
      const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
      noise.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
      };

      // Highpass filter for paper ripping (removes bass, keeps paper rustling crinkle)
      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.setValueAtTime(2000, now);
      // Sweeping filter down slightly to simulate a tear across
      hpFilter.frequency.exponentialRampToValueAtTime(800, now + 0.35);

      const ripGain = ctx.createGain();
      ripGain.gain.setValueAtTime(this.volume * 0.4, now);
      ripGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // Fast decay

      // Connections
      noise.connect(hpFilter);
      hpFilter.connect(ripGain);
      ripGain.connect(ctx.destination);

      // Auto cleanup after play
      setTimeout(() => {
        try {
          noise.disconnect();
          hpFilter.disconnect();
          ripGain.disconnect();
        } catch (e) {}
      }, 500);
    } catch (err) {
      console.warn('Failed to play tear audio:', err);
    }
  }
}

export const printerAudio = new PrinterSoundManager();
