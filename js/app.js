// Chiikawa Character Creator - Main Application Controller

const SUBTABS_CONFIG = {
  body: [
    { id: 'bodyColor', label: 'Body Color' },
    { id: 'shape', label: 'Shape' },
    { id: 'pattern', label: 'Pattern' }
  ],
  face: [
    { id: 'eyes', label: 'Eyes' },
    { id: 'eyebrows', label: 'Eyebrows' },
    { id: 'mouths', label: 'Mouth' },
    { id: 'markings', label: 'Markings' },
    { id: 'glasses', label: 'Glasses' },
    { id: 'blushStyles', label: 'Blush' }
  ],
  head: [
    { id: 'ears', label: 'Ears' },
    { id: 'accessories', label: 'Accessories' },
    { id: 'hair', label: 'Hair' }
  ],
  dressUp: [
    { id: 'tails', label: 'Tail' },
    { id: 'neckBags', label: 'Neck & Bag' },
    { id: 'props', label: 'Handheld' },
    { id: 'backgrounds', label: 'Background' }
  ],
  personality: []
};

class ChiikawaApp {
  constructor() {
    this.state = createDefaultCharacterState();
    this.activeCategory = 'body';
    this.activeSubtab = 'bodyColor';

    this.renderer = new ChiikawaRenderer(document.getElementById('stage-character-mount'));
    this.village = new VillageEngine(this.renderer);

    this.colorPickerTarget = 'bodyColor';
    this.cpHSV = { h: 0, s: 0, v: 100 };

    this.init();
  }

  init() {
    this.bindTopBar();
    this.bindStageInteractions();
    this.bindCategoryTabs();
    this.bindColorPicker();
    this.bindBottomAction();

    this.renderAll();
  }

  bindTopBar() {
    const nameInput = document.getElementById('char-name-input');
    const counter = document.getElementById('name-counter');
    const resetBtn = document.getElementById('btn-reset');

    nameInput.addEventListener('input', () => {
      this.state.name = nameInput.value.slice(0, 8);
      if (nameInput.value.length > 8) nameInput.value = this.state.name;
      counter.textContent = `${this.state.name.length}/8`;
    });

    resetBtn.addEventListener('click', () => {
      this.state = createDefaultCharacterState();
      nameInput.value = '';
      counter.textContent = '0/8';
      this.triggerBounce();
      this.renderAll();
    });
  }

  bindStageInteractions() {
    const stage = document.getElementById('stage-canvas-wrap');
    let isDragging = false;
    let startX = 0;
    let startAngle = 0;
    let moved = false;

    stage.addEventListener('pointerdown', (e) => {
      isDragging = true;
      moved = false;
      startX = e.clientX;
      startAngle = this.state.rotationAngle;
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      this.state.rotationAngle = (startAngle - dx * 1.1 + 360) % 360;
      this.renderer.renderCharacter(this.state);
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      if (!moved) {
        this.triggerBounce();
      }
    };

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  }

  bindCategoryTabs() {
    const nav = document.getElementById('categories-nav');
    nav.querySelectorAll('.cat-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category;
        if (this.activeCategory === cat) return;
        this.activeCategory = cat;

        nav.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const subs = SUBTABS_CONFIG[cat] || [];
        this.activeSubtab = subs.length > 0 ? subs[0].id : null;

        // Auto-turn character like in the video (e.g. Tail -> Back view)
        if (cat === 'dressUp' && this.activeSubtab === 'tails') {
          this.state.rotationAngle = 180;
        } else if (this.state.rotationAngle === 180) {
          this.state.rotationAngle = 0;
        }

        this._updateCameraZoom();
        this.renderSubtabs();
        this.renderWorkspace();
        this.renderer.renderCharacter(this.state);
      });
    });
  }

  bindBottomAction() {
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn && startScreen) {
      startBtn.addEventListener('click', () => {
        startScreen.style.display = 'none';
      });
    }

    const downloadBtn = document.getElementById('btn-download-image');
    if (!downloadBtn) return;

    downloadBtn.addEventListener('click', () => {
      const rawName = (this.state.name || '').trim();
      const safeName = (rawName || 'chiikawa').replace(/[\\/:*?"<>|]/g, '_');
      this.renderer.capturePNG((dataUrl) => {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.save_image) {
          window.pywebview.api.save_image(`${safeName}.png`, dataUrl);
          return;
        }
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${safeName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    });
  }

  triggerBounce() {
    this.state._bounce = true;
    this.renderer.renderCharacter(this.state);
    clearTimeout(this._bounceTimer);
    this._bounceTimer = setTimeout(() => {
      this.state._bounce = false;
    }, 450);
  }

  renderAll() {
    this._updateCameraZoom();
    this._applyStageBackground();
    this.renderSubtabs();
    this.renderWorkspace();
    this.renderer.renderCharacter(this.state);
  }

  _applyStageBackground() {
    const svg = document.querySelector('.stage-bg-svg');
    if (!svg) return;
    const bg = this.state.background || 'bg_meadow';
    const themes = {
      bg_meadow: { sky1: '#BEE3F8', sky2: '#DFF2FC', hill1: '#A8D878', hill2: '#95CA62', hillStroke: '#4A3832', sun: '#FBE16E' },
      bg_night: { sky1: '#1E2A4A', sky2: '#3B4D7A', hill1: '#3D5A58', hill2: '#2C4341', hillStroke: '#1A242F', sun: '#FFF59D' },
      bg_sakura: { sky1: '#FFDCE8', sky2: '#FFF3F7', hill1: '#C5E49E', hill2: '#AED67E', hillStroke: '#5D4037', sun: '#FFE082' },
      bg_sunset: { sky1: '#FF9E80', sky2: '#FFE0B2', hill1: '#8D9E63', hill2: '#75874B', hillStroke: '#4A3832', sun: '#FF7043' },
      bg_pastel: { sky1: '#E1BEE7', sky2: '#FFF9C4', hill1: '#B2DFDB', hill2: '#80CBC4', hillStroke: '#4A3832', sun: '#FFF176' }
    };
    const t = themes[bg] || themes.bg_meadow;
    const stops = svg.querySelectorAll('#skyGrad stop');
    if (stops.length >= 2) {
      stops[0].setAttribute('stop-color', t.sky1);
      stops[1].setAttribute('stop-color', t.sky2);
    }
    const sunCircle = svg.querySelector('circle[stroke]');
    if (sunCircle) sunCircle.setAttribute('fill', t.sun);
    const paths = svg.querySelectorAll('path');
    paths.forEach(p => {
      const fill = p.getAttribute('fill') || '';
      if (fill === '#A8D878' || fill === '#3D5A58' || fill === '#C5E49E' || fill === '#8D9E63' || fill === '#B2DFDB') {
        p.setAttribute('fill', t.hill1);
      } else if (fill === '#95CA62' || fill === '#2C4341' || fill === '#AED67E' || fill === '#75874B' || fill === '#80CBC4') {
        p.setAttribute('fill', t.hill2);
      }
    });
  }

  _updateCameraZoom() {
    const zoomedIn =
      this.activeCategory === 'face' ||
      (this.activeCategory === 'body' && (this.activeSubtab === 'bodyColor' || this.activeSubtab === 'shape')) ||
      (this.activeCategory === 'head' && (this.activeSubtab === 'accessories' || this.activeSubtab === 'hair'));
    const wrap = document.getElementById('stage-canvas-wrap');
    if (wrap) {
      wrap.classList.toggle('stage-zoom-in', zoomedIn);
    }
    if (this.renderer && this.renderer.setCameraZoom) {
      this.renderer.setCameraZoom(zoomedIn);
    }
  }

  renderSubtabs() {
    const bar = document.getElementById('subtabs-bar');
    const subs = SUBTABS_CONFIG[this.activeCategory] || [];

    if (subs.length === 0) {
      bar.style.display = 'none';
      bar.dataset.renderedCat = '';
      return;
    }
    bar.style.display = 'flex';

    let pillsWrap = bar.querySelector('.subtabs-pills');
    const isSameCategory = pillsWrap && bar.dataset.renderedCat === this.activeCategory;

    if (!isSameCategory) {
      bar.dataset.renderedCat = this.activeCategory;
      const pillsHtml = subs.map(s => `
        <button class="subtab-pill ${this.activeSubtab === s.id ? 'active' : ''}" data-sub="${s.id}">
          ${s.label}
        </button>
      `).join('');

      bar.innerHTML = `<div class="subtabs-pills">${pillsHtml}</div>`;
      pillsWrap = bar.querySelector('.subtabs-pills');

      // Horizontal mouse wheel scrolling
      const handleWheel = (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          pillsWrap.scrollLeft += e.deltaY;
        }
      };
      bar.onwheel = handleWheel;
      pillsWrap.onwheel = handleWheel;

      // Mouse drag-to-scroll support for desktop
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      pillsWrap.onmousedown = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDown = true;
        startX = e.pageX - pillsWrap.offsetLeft;
        scrollLeft = pillsWrap.scrollLeft;
      };
      window.addEventListener('mouseup', () => { isDown = false; });
      pillsWrap.onmousemove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - pillsWrap.offsetLeft;
        const walk = (x - startX) * 1.5;
        pillsWrap.scrollLeft = scrollLeft - walk;
      };

      bar.querySelectorAll('.subtab-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetSub = btn.dataset.sub;
          if (this.activeSubtab === targetSub) return;
          this.activeSubtab = targetSub;

          if (this.activeSubtab === 'tails') {
            this.state.rotationAngle = 145;
          } else if (this.activeCategory === 'dressUp' && this.activeSubtab === 'neckBags') {
            this.state.rotationAngle = 0;
          }

          this._updateCameraZoom();
          this.renderSubtabs();
          this.renderWorkspace();
          this.renderer.renderCharacter(this.state);
        });
      });
    }

    // Update active classes without wiping DOM or resetting scroll
    let activeBtn = null;
    bar.querySelectorAll('.subtab-pill').forEach(btn => {
      const isActive = (btn.dataset.sub === this.activeSubtab);
      btn.classList.toggle('active', isActive);
      if (isActive) activeBtn = btn;
    });

    // Safely scroll active pill within pillsWrap ONLY (never scrolls ancestors/window)
    if (activeBtn && pillsWrap) {
      setTimeout(() => {
        const wrapWidth = pillsWrap.clientWidth;
        const pillLeft = activeBtn.offsetLeft;
        const pillWidth = activeBtn.offsetWidth;
        const targetLeft = pillLeft - (wrapWidth / 2) + (pillWidth / 2);
        pillsWrap.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: 'smooth'
        });
      }, 15);
    }

    // Guarantee that outer containers are NEVER shifted
    const gw = document.getElementById('game-app');
    if (gw && gw.scrollLeft !== 0) gw.scrollLeft = 0;
    if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
    if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0;
  }

  renderWorkspace() {
    const ws = document.getElementById('options-content');
    ws.scrollTop = 0;

    if (this.activeCategory === 'body') {
      if (this.activeSubtab === 'bodyColor') {
        ws.innerHTML = this._buildColorPalettesHTML();
        this._bindColorPalettes(ws);
        return;
      }
      if (this.activeSubtab === 'shape') {
        this._renderCardGrid(ws, GAME_DATA.body.shapes, 'shape', 0);
        return;
      }
      if (this.activeSubtab === 'pattern') {
        this._renderCardGrid(ws, GAME_DATA.body.patterns, 'pattern', (item) => item.id === 'pat_back' ? 180 : 0);
        return;
      }
    }

    if (this.activeCategory === 'face') {
      const slidersHtml = this._buildFaceSlidersHTML();
      ws.innerHTML = slidersHtml + `<div class="cards-grid" id="face-cards-grid"></div>`;
      this._bindFaceSliders(ws);

      const grid = ws.querySelector('#face-cards-grid');
      const map = {
        eyes: { list: GAME_DATA.face.eyes, key: 'eyeStyle' },
        eyebrows: { list: GAME_DATA.face.eyebrows, key: 'eyebrowStyle' },
        mouths: { list: GAME_DATA.face.mouths, key: 'mouthStyle' },
        markings: { list: GAME_DATA.face.markings, key: 'marking' },
        glasses: { list: GAME_DATA.face.glasses, key: 'glasses' },
        blushStyles: { list: GAME_DATA.face.blushStyles, key: 'blushStyle' }
      };
      const cfg = map[this.activeSubtab];
      if (cfg) this._populateGrid(grid, cfg.list, cfg.key, 0);
      return;
    }

    if (this.activeCategory === 'head') {
      const map = {
        ears: { list: GAME_DATA.head.ears, key: 'earType' },
        accessories: { list: GAME_DATA.head.accessories, key: 'headAccessory' },
        hair: { list: GAME_DATA.head.hair, key: 'hairType' }
      };
      const cfg = map[this.activeSubtab];
      if (cfg) this._renderCardGrid(ws, cfg.list, cfg.key, 0);
      return;
    }

    if (this.activeCategory === 'dressUp') {
      if (this.activeSubtab === 'tails') {
        this._renderCardGrid(ws, GAME_DATA.dressUp.tails, 'tailType', 180);
        return;
      }
      if (this.activeSubtab === 'neckBags') {
        this._renderCardGrid(ws, GAME_DATA.dressUp.neckBags, 'neckBag', 0);
        return;
      }
      if (this.activeSubtab === 'props') {
        this._renderCardGrid(ws, GAME_DATA.dressUp.props, 'handProp', 0);
        return;
      }
      if (this.activeSubtab === 'backgrounds') {
        this._renderCardGrid(ws, GAME_DATA.dressUp.backgrounds, 'background', 0);
        return;
      }
    }

    if (this.activeCategory === 'personality') {
      this._renderPersonalityPanel(ws);
    }
  }

  _buildColorPalettesHTML() {
    const buildSwatches = (colors, currentHex, target) => {
      const items = colors.map(hex => {
        const isActive = currentHex.toLowerCase() === hex.toLowerCase();
        return `<button class="color-swatch ${isActive ? 'active' : ''}" data-target="${target}" data-hex="${hex}" style="background-color: ${hex};"></button>`;
      }).join('');
      const rainbow = `<button class="color-swatch rainbow-swatch" data-target="${target}" data-custom="true" title="Custom Color"></button>`;
      return items + rainbow;
    };

    return `
      <div class="palette-section" id="body-palette-sec">
        <div class="palette-title">Body Color</div>
        <div class="palette-grid">
          ${buildSwatches(GAME_DATA.bodyColors, this.state.bodyColor, 'bodyColor')}
        </div>
      </div>
    `;
  }

  _bindColorPalettes(ws) {
    ws.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (btn.dataset.custom) {
          this.openColorPicker(target);
          return;
        }
        this.state[target] = btn.dataset.hex;
        this.triggerBounce();
        this.renderWorkspace();
      });
    });
  }

  _buildFaceSlidersHTML() {
    return `
      <div class="sliders-panel">
        <div class="slider-row">
          <div class="slider-labels"><span>Closer Eyes</span><span>Wider Eyes</span></div>
          <input type="range" class="chiikawa-slider" id="sl-eye-spacing" min="0" max="100" value="${this.state.eyeSpacing}">
        </div>
        <div class="slider-row">
          <div class="slider-labels"><span>Lower Face</span><span>Higher Face</span></div>
          <input type="range" class="chiikawa-slider" id="sl-feature-height" min="0" max="100" value="${this.state.featureHeight}">
        </div>
        <div class="slider-row">
          <div class="slider-labels"><span>Droopy Brows</span><span>Raised Brows</span></div>
          <input type="range" class="chiikawa-slider" id="sl-brow-tilt" min="0" max="100" value="${this.state.eyebrowTilt}">
        </div>
      </div>
    `;
  }

  _bindFaceSliders(ws) {
    const s1 = ws.querySelector('#sl-eye-spacing');
    const s2 = ws.querySelector('#sl-feature-height');
    const s3 = ws.querySelector('#sl-brow-tilt');

    s1.addEventListener('input', () => {
      this.state.eyeSpacing = Number(s1.value);
      this.renderer.renderCharacter(this.state);
    });
    s2.addEventListener('input', () => {
      this.state.featureHeight = Number(s2.value);
      this.renderer.renderCharacter(this.state);
    });
    s3.addEventListener('input', () => {
      this.state.eyebrowTilt = Number(s3.value);
      this.renderer.renderCharacter(this.state);
    });
  }

  _renderCardGrid(ws, list, stateKey, angleOrFn) {
    ws.innerHTML = `<div class="cards-grid"></div>`;
    const grid = ws.querySelector('.cards-grid');
    this._populateGrid(grid, list, stateKey, angleOrFn);
  }

  _populateGrid(grid, list, stateKey, angleOrFn) {
    grid.innerHTML = list.map(item => {
      const isActive = this.state[stateKey] === item.id;
      const angle = typeof angleOrFn === 'function' ? angleOrFn(item) : angleOrFn;
      const thumbSvg = this.renderer.renderThumbnail(this.state, { [stateKey]: item.id }, angle, stateKey);

      return `
        <div class="option-card ${isActive ? 'active' : ''}" data-id="${item.id}">
          <span class="card-check-badge">✓</span>
          <div class="card-thumb">${thumbSvg}</div>
          <div class="card-label">${item.label}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.state[stateKey] = id;

        if (id === 'pat_back') {
          this.state.rotationAngle = 180;
        } else if (stateKey === 'tailType') {
          this.state.rotationAngle = 145;
        } else if (stateKey === 'background') {
          this._applyStageBackground();
        }

        this.triggerBounce();
        grid.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
  }

  _renderPersonalityPanel(ws) {
    const slidersHtml = GAME_DATA.personalitySliders.map(sl => `
      <div class="slider-row">
        <div class="slider-labels">
          <span>${sl.left}</span>
          <span>${sl.right}</span>
        </div>
        <input type="range" class="chiikawa-slider p-slider" data-pid="${sl.id}" min="0" max="100" value="${this.state.personality[sl.id]}">
      </div>
    `).join('');

    ws.innerHTML = `
      <div class="sliders-panel">${slidersHtml}</div>
      <div class="personality-summary-box" id="personality-summary"></div>
    `;

    const updateSummary = () => {
      const p = this.state.personality;
      const braveText = p.bravery >= 60 ? 'Brave ones stand up to monsters,' : 'Timid ones hide behind friends,';
      const socialText = p.sociability >= 60 ? 'and friendly ones love calling friends over.' : 'and quiet ones munch grass on their own.';
      ws.querySelector('#personality-summary').textContent =
        `Personality shapes how they act in the village. ${braveText} ${socialText}`;
    };

    updateSummary();
    ws.querySelectorAll('.p-slider').forEach(sl => {
      sl.addEventListener('input', () => {
        this.state.personality[sl.dataset.pid] = Number(sl.value);
        updateSummary();
      });
    });
  }

  // ================= CUSTOM COLOR PICKER =================
  openColorPicker(target) {
    this.colorPickerTarget = target;
    const modal = document.getElementById('color-picker-modal');
    modal.style.display = 'flex';

    const rgb = this._hexToRgb(this.state[target]);
    this.cpHSV = this._rgbToHsv(rgb.r, rgb.g, rgb.b);
    this._syncColorPickerUI();
  }

  bindColorPicker() {
    const modal = document.getElementById('color-picker-modal');
    const svBox = document.getElementById('cp-sv-box');
    const hueSlider = document.getElementById('cp-hue-slider');
    const rIn = document.getElementById('cp-r');
    const gIn = document.getElementById('cp-g');
    const bIn = document.getElementById('cp-b');
    const closeBtn = document.getElementById('cp-close-btn');

    let draggingSV = false;
    const updateSVFromPointer = (e) => {
      const rect = svBox.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this.cpHSV.s = Math.round(x * 100);
      this.cpHSV.v = Math.round((1 - y) * 100);
      this._applyPickerColor();
    };

    svBox.addEventListener('pointerdown', (e) => {
      draggingSV = true;
      svBox.setPointerCapture(e.pointerId);
      updateSVFromPointer(e);
    });
    svBox.addEventListener('pointermove', (e) => {
      if (draggingSV) updateSVFromPointer(e);
    });
    svBox.addEventListener('pointerup', () => { draggingSV = false; });

    hueSlider.addEventListener('input', () => {
      this.cpHSV.h = Number(hueSlider.value);
      this._applyPickerColor();
    });

    const onRgbInput = () => {
      const r = Math.max(0, Math.min(255, Number(rIn.value) || 0));
      const g = Math.max(0, Math.min(255, Number(gIn.value) || 0));
      const b = Math.max(0, Math.min(255, Number(bIn.value) || 0));
      this.cpHSV = this._rgbToHsv(r, g, b);
      this._applyPickerColor(true);
    };
    [rIn, gIn, bIn].forEach(inp => inp.addEventListener('change', onRgbInput));

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      this.renderWorkspace();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        this.renderWorkspace();
      }
    });
  }

  _applyPickerColor(skipRgbInputs = false) {
    const rgb = this._hsvToRgb(this.cpHSV.h, this.cpHSV.s, this.cpHSV.v);
    const hex = this._rgbToHex(rgb.r, rgb.g, rgb.b);
    this.state[this.colorPickerTarget] = hex;
    this._syncColorPickerUI(skipRgbInputs);
    this.renderer.renderCharacter(this.state);
  }

  _syncColorPickerUI(skipRgbInputs = false) {
    const svBox = document.getElementById('cp-sv-box');
    const cursor = document.getElementById('cp-sv-cursor');
    const hueSlider = document.getElementById('cp-hue-slider');
    const previewDot = document.getElementById('cp-preview-dot');

    const pureHue = this._hsvToRgb(this.cpHSV.h, 100, 100);
    svBox.style.backgroundColor = `rgb(${pureHue.r}, ${pureHue.g}, ${pureHue.b})`;
    cursor.style.left = `${this.cpHSV.s}%`;
    cursor.style.top = `${100 - this.cpHSV.v}%`;
    hueSlider.value = this.cpHSV.h;

    const rgb = this._hsvToRgb(this.cpHSV.h, this.cpHSV.s, this.cpHSV.v);
    previewDot.style.backgroundColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    if (!skipRgbInputs) {
      document.getElementById('cp-r').value = rgb.r;
      document.getElementById('cp-g').value = rgb.g;
      document.getElementById('cp-b').value = rgb.b;
    }
  }

  _hexToRgb(hex) {
    const clean = (hex || '#FFFFFF').replace('#', '');
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  _hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  _rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chiikawaApp = new ChiikawaApp();
});
