// Chiikawa Sound Engine
// Plays authentic audio clips sliced from video + procedural Web Audio SFX

class AudioManager {
  constructor() {
    this.muted = false;
    this.bgmPlaying = false;
    this.audioContext = null;

    // Load authentic clips
    this.clips = {
      yaha: new Audio('assets/audio/yaha.mp3'),
      prrrr: new Audio('assets/audio/prrrr.mp3'),
      ura: new Audio('assets/audio/ura.mp3'),
      haha: new Audio('assets/audio/haha.mp3'),
      scream: new Audio('assets/audio/scream.mp3'),
      cute_squeak: new Audio('assets/audio/cute_squeak.mp3'),
    };

    // Background music loop
    this.bgm = new Audio('assets/audio/bgm.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0.35;

    // Adjust clip volumes
    Object.values(this.clips).forEach(clip => {
      clip.volume = 0.7;
    });
  }

  initContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioContext = new AudioCtx();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playVoice(name) {
    if (this.muted) return;
    this.initContext();

    const clip = this.clips[name] || this.clips['cute_squeak'];
    if (clip) {
      clip.currentTime = 0;
      clip.play().catch(() => {
        // Fallback to Web Audio chirp if browser blocks audio element
        this.playBoing();
      });
    }
  }

  // Play random cute voice reaction
  playRandomVoice() {
    const keys = ['yaha', 'ura', 'prrrr', 'haha', 'cute_squeak'];
    const pick = keys[Math.floor(Math.random() * keys.length)];
    this.playVoice(pick);
  }

  toggleBgm() {
    this.initContext();
    if (this.bgmPlaying) {
      this.bgm.pause();
      this.bgmPlaying = false;
    } else {
      this.bgm.play().then(() => {
        this.bgmPlaying = true;
      }).catch(err => {
        console.log('BGM autoplay waiting for interaction');
      });
    }
    return this.bgmPlaying;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.bgm.pause();
    } else if (this.bgmPlaying) {
      this.bgm.play();
    }
    return this.muted;
  }

  // --- Procedural Web Audio FX ---
  playPop() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playTap() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  playSparkle() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  playBoing() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }
}

const audioMgr = new AudioManager();
