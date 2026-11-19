// Chiikawa Village Screen
// Displays created character(s) wandering, speaking based on personality, and interacting.

class VillageEngine {
  constructor(renderer) {
    this.renderer = renderer;
    this.container = null;
    this.characters = [];
    this.wanderTimer = null;
  }

  init(containerElement, currentState, onBackCallback) {
    this.container = containerElement;
    this.onBack = onBackCallback;

    // Save or update character in village list (max 8)
    const saved = JSON.parse(localStorage.getItem('chiikawa_village_chars') || '[]');
    const charCopy = JSON.parse(JSON.stringify(currentState));
    charCopy.rotationAngle = 0;
    if (!charCopy.name || !charCopy.name.trim()) {
      charCopy.name = 'Chiikawa';
    }

    const existingIdx = saved.findIndex(c => c.name === charCopy.name);
    if (existingIdx >= 0) {
      saved[existingIdx] = charCopy;
    } else {
      saved.unshift(charCopy);
      if (saved.length > 8) saved.pop();
    }
    localStorage.setItem('chiikawa_village_chars', JSON.stringify(saved));
    this.characters = saved;

    this.render();
    this.startWandering();
  }

  stop() {
    if (this.wanderTimer) {
      clearInterval(this.wanderTimer);
      this.wanderTimer = null;
    }
  }

  render() {
    const actorsHtml = this.characters.map((ch, idx) => {
      const left = 18 + ((idx * 27) % 62);
      const top = 46 + ((idx * 17) % 34);
      const svg = this.renderer.buildSVG(ch, { isStage: false });
      return `
        <div class="village-actor-wrap" data-idx="${idx}" style="left: ${left}%; top: ${top}%;">
          <div class="village-speech" id="v-speech-${idx}">Yaha!</div>
          ${svg}
          <div class="village-name-tag">${this._escapeHtml(ch.name)}</div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <header class="village-header">
        <span class="village-title">Chiikawa Village (${this.characters.length}/8)</span>
        <button class="village-back-btn" id="v-btn-back">Create Character</button>
      </header>
      <div class="village-meadow" id="village-meadow">
        ${actorsHtml}
      </div>
      <div class="village-controls">
        <button class="v-action-btn" id="v-btn-snack">Give Pudding</button>
        <button class="v-action-btn" id="v-btn-cheer">Say Hello</button>
        <button class="v-action-btn" id="v-btn-clear">Clear Village</button>
      </div>
    `;

    this.container.querySelector('#v-btn-back').addEventListener('click', () => {
      this.stop();
      if (this.onBack) this.onBack();
    });

    this.container.querySelector('#v-btn-snack').addEventListener('click', () => {
      this.characters.forEach((ch, idx) => {
        this.showSpeech(idx, 'Yum!! Pudding!');
      });
    });

    this.container.querySelector('#v-btn-cheer').addEventListener('click', () => {
      this.characters.forEach((ch, idx) => {
        const line = this._getPersonalityLine(ch);
        this.showSpeech(idx, line);
      });
    });

    this.container.querySelector('#v-btn-clear').addEventListener('click', () => {
      localStorage.removeItem('chiikawa_village_chars');
      this.characters = this.characters.slice(0, 1);
      localStorage.setItem('chiikawa_village_chars', JSON.stringify(this.characters));
      this.render();
    });

    this.container.querySelectorAll('.village-actor-wrap').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        this.showSpeech(idx, this._getPersonalityLine(this.characters[idx]));
      });
    });
  }

  startWandering() {
    this.stop();
    this.wanderTimer = setInterval(() => {
      const actors = this.container.querySelectorAll('.village-actor-wrap');
      actors.forEach(el => {
        const newLeft = 10 + Math.random() * 64;
        const newTop = 42 + Math.random() * 38;
        el.style.left = `${newLeft}%`;
        el.style.top = `${newTop}%`;
      });
    }, 2400);
  }

  showSpeech(idx, text) {
    const bubble = this.container.querySelector(`#v-speech-${idx}`);
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubble._hideTimer);
    bubble._hideTimer = setTimeout(() => {
      bubble.classList.remove('show');
    }, 2200);
  }

  _getPersonalityLine(ch) {
    const p = ch.personality || {};
    if ((p.bravery ?? 50) > 70) return 'Ura! Bring it on!';
    if ((p.bravery ?? 50) < 35) return 'Hwaaah, scary...';
    if ((p.sociability ?? 50) > 70) return 'Let\'s play together~!';
    if ((p.talkative ?? 50) > 70) return 'The weather is so nice today!';
    return 'Yaha~♪';
  }

  _escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
}
