// Chiikawa 3D Cel-Shaded Character Renderer (Three.js)
// Uses exact pixel-measured ref_char_front.png profile for 1-to-1 front silhouette + true 360-degree 3D rotation.

class ChiikawaRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.outlineHex = '#4A3832';
    this.outlineColor = new THREE.Color(this.outlineHex);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.charRoot = null;
    this.bodyGroup = null;

    this.lastStateKey = '';
    this.lastTexKey = '';
    this.currentAngle = 0;
    this.bounceTime = -1;
    this.clock = new THREE.Clock();

    this.texCanvas = document.createElement('canvas');
    this.texCanvas.width = 1024;
    this.texCanvas.height = 1024;
    this.texCtx = this.texCanvas.getContext('2d');
    this.bodyTexture = null;

    this.headCanvas = document.createElement('canvas');
    this.headCanvas.width = 512;
    this.headCanvas.height = 512;
    this.headCtx = this.headCanvas.getContext('2d');
    this.headTexture = null;

    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 1024;
    this.faceCanvas.height = 1024;
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceTexture = null;

    this.targetZoom = 1.82;
    this.targetCamY = 0.10;
    this._zoomInitialized = false;
    this._orthoHalfH = 3.55 / 2;

    this.toonGradient = this._createToonGradient();

    if (this.container && typeof THREE !== 'undefined') {
      this._initThree();
      this._animate();
    }
  }

  // Smooth Chiikawa mochi silhouette: big round head + small compact torso (yNorm: +1 top -> -1 bottom)
  _evalChiikawaProfile(yNorm) {
    if (yNorm >= 1 || yNorm <= -1) return 0;
    if (yNorm >= 0.25) {
      const t = (yNorm - 0.25) / 0.75;
      return Math.pow(Math.max(0, 1 - t * t), 0.42);
    }
    if (yNorm >= -0.35) {
      const u = (0.25 - yNorm) / 0.60;
      const s = 0.5 - 0.5 * Math.cos(Math.PI * u);
      return 1.00 - 0.27 * s;
    }
    const v = (-0.35 - yNorm) / 0.65;
    return 0.73 * Math.pow(Math.max(0, 1 - v * v), 0.46);
  }

  _createToonGradient() {
    const data = new Uint8Array([
      244, 244, 244, 255,
      255, 255, 255, 255,
      255, 255, 255, 255
    ]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  _initThree() {
    const w = this.container.clientWidth || 215;
    const h = this.container.clientHeight || 215;

    this.scene = new THREE.Scene();
    const aspect = w / h;
    const halfH = this._orthoHalfH;
    const halfW = halfH * aspect;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
    this.camera.position.set(0, 0.10, 10);
    this.camera.lookAt(0, 0.02, 0);
    this.camera.zoom = this.targetZoom;
    this.camera.updateProjectionMatrix();

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    const ambient = new THREE.AmbientLight(0xffffff, 2.5);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(0.5, 4, 4);
    this.scene.add(dirLight);

    this.charRoot = new THREE.Group();
    this.charRoot.position.y = -0.22;
    this.scene.add(this.charRoot);

    this.bodyTexture = new THREE.CanvasTexture(this.texCanvas);
    this.bodyTexture.colorSpace = THREE.SRGBColorSpace;
    this.bodyTexture.needsUpdate = true;

    this.headTexture = new THREE.CanvasTexture(this.headCanvas);
    this.headTexture.colorSpace = THREE.SRGBColorSpace;
    this.headTexture.needsUpdate = true;

    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;
    this.faceTexture.generateMipmaps = false;
    this.faceTexture.minFilter = THREE.LinearFilter;
    this.faceTexture.magFilter = THREE.LinearFilter;
    this.faceTexture.needsUpdate = true;

    const onContainerResize = () => {
      const nw = Math.round(this.container.clientWidth || 215);
      const nh = Math.round(this.container.clientHeight || 215);
      if (nw > 0 && nh > 0) {
        const aspect = nw / nh;
        const halfH = this._orthoHalfH;
        const halfW = halfH * aspect;
        this.camera.left = -halfW;
        this.camera.right = halfW;
        this.camera.top = halfH;
        this.camera.bottom = -halfH;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(nw, nh, false);
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(onContainerResize).observe(this.container);
    }
    window.addEventListener('resize', onContainerResize);
    window.addEventListener('orientationchange', onContainerResize);
  }

  _makeToonMat(colorOrMap, isTexture = false) {
    const opts = {};
    if (isTexture) {
      opts.map = colorOrMap;
      opts.color = 0xffffff;
    } else {
      opts.color = new THREE.Color(colorOrMap || '#FFFFFF');
    }
    return new THREE.MeshBasicMaterial(opts);
  }

  _makeOutlineMat(thickness = 0.032) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.outlineColor },
        uThickness: { value: thickness }
      },
      vertexShader: `
        uniform float uThickness;
        void main() {
          vec3 newPos = position + normalize(normal) * uThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        void main() {
          gl_FragColor = vec4(uColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });
  }

  _makeRimMat(baseColor, rimWidth = 0.24) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: baseColor.clone ? baseColor.clone() : new THREE.Color(baseColor) },
        uOutlineColor: { value: this.outlineColor },
        uRimWidth: { value: rimWidth }
      },
      vertexShader: `
        varying vec3 vNormalView;
        void main() {
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uOutlineColor;
        uniform float uRimWidth;
        varying vec3 vNormalView;
        void main() {
          float ndotv = abs(normalize(vNormalView).z);
          float edge = smoothstep(uRimWidth - 0.05, uRimWidth + 0.05, ndotv);
          vec3 col = mix(uOutlineColor, uColor, edge);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }

  _addOutlinedMesh(parent, geo, mat, outlineThickness = 0.032, layer = 0) {
    const group = new THREE.Group();
    const meshMat = (layer === 1 && mat && !mat.map && mat.color && outlineThickness > 0)
      ? this._makeRimMat(mat.color, 0.24)
      : mat;
    const mesh = new THREE.Mesh(geo, meshMat);
    mesh.renderOrder = layer === 0 ? 2 : 5;
    if (outlineThickness > 0) {
      const outline = new THREE.Mesh(geo, this._makeOutlineMat(outlineThickness));
      outline.renderOrder = layer === 0 ? 1 : 4;
      group.add(outline);
    }
    group.add(mesh);
    parent.add(group);
    return group;
  }

  capturePNG(callback) {
    if (!this.renderer || !this.scene || !this.camera) return;
    const prevZoom = this.camera.zoom;
    const prevY = this.camera.position.y;
    const prevPR = this.renderer.getPixelRatio();
    const prevW = this.container.clientWidth || 215;
    const prevH = this.container.clientHeight || 215;

    const hiRes = 640;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(hiRes, hiRes, false);
    this.camera.zoom = 1.0;
    this.camera.position.y = 0.10;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const charDataUrl = this.renderer.domElement.toDataURL('image/png');

    this.renderer.setPixelRatio(prevPR);
    this.renderer.setSize(prevW, prevH, false);
    this.camera.zoom = prevZoom;
    this.camera.position.y = prevY;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    const bgSvg = document.querySelector('.stage-bg-svg');
    if (!bgSvg) {
      callback(charDataUrl);
      return;
    }

    const outW = 1280;
    const outH = 640;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    const svgXml = new XMLSerializer().serializeToString(bgSvg);
    const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const bgImg = new Image();
    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, outW, outH);
      URL.revokeObjectURL(svgUrl);
      const charImg = new Image();
      charImg.onload = () => {
        ctx.drawImage(charImg, (outW - hiRes) / 2, outH - hiRes - 24, hiRes, hiRes);
        callback(canvas.toDataURL('image/png'));
      };
      charImg.onerror = () => callback(charDataUrl);
      charImg.src = charDataUrl;
    };
    bgImg.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      callback(charDataUrl);
    };
    bgImg.src = svgUrl;
  }

  setCameraZoom(zoomedIn) {
    if (zoomedIn) {
      this.targetZoom = 1.82;
      this.targetCamY = 0.10;
    } else {
      this.targetZoom = 1.0;
      this.targetCamY = 0.10;
    }
    if (!this._zoomInitialized && this.camera) {
      this._zoomInitialized = true;
      this.camera.zoom = this.targetZoom;
      this.camera.position.y = this.targetCamY;
      this.camera.updateProjectionMatrix();
    }
  }

  renderCharacter(state) {
    if (!this.scene) return;

    this.currentAngle = ((state.rotationAngle || 0) % 360 + 360) % 360;
    if (state._bounce) {
      this.bounceTime = 0;
    }

    const texKey = JSON.stringify([
      state.bodyColor, state.pointColor, state.pattern,
      state.eyeStyle, state.eyebrowStyle, state.mouthStyle, state.marking,
      state.glasses, state.blushStyle,
      state.eyeSpacing, state.featureHeight, state.eyebrowTilt
    ]);
    if (texKey !== this.lastTexKey) {
      this.lastTexKey = texKey;
      this._paintBodyTexture(state);
      this.bodyTexture.needsUpdate = true;
      this._paintHeadTexture(state);
      this.headTexture.needsUpdate = true;
      this._paintFaceDecal(state);
      this.faceTexture.needsUpdate = true;
    }

    const structKey = JSON.stringify([
      state.shape, state.bodyColor, state.pointColor, state.pattern,
      state.earType, state.earUsePoint, state.headAccessory, state.hairType,
      state.tailType, state.tailUsePoint, state.neckBag, state.handProp
    ]);
    if (structKey !== this.lastStateKey) {
      this.lastStateKey = structKey;
      this._rebuild3DCharacter(state);
    }
  }

  _deformVertexToProfile(x, y, z, scaleOffset = 1.0) {
    const rHoriz = Math.sqrt(x * x + z * z);
    const targetR = this._evalChiikawaProfile(y);
    const factor = rHoriz > 1e-5 ? (targetR / rHoriz) : 0;
    const nx = x * factor * 0.98 * scaleOffset;
    const ny = y * 0.86 * scaleOffset;
    const nz = z * factor * 0.82 * scaleOffset;
    return [nx, ny, nz];
  }

  _rebuild3DCharacter(state) {
    while (this.charRoot.children.length > 0) {
      const old = this.charRoot.children[0];
      old.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      this.charRoot.remove(old);
    }

    const shapeDef = GAME_DATA.body.shapes.find(s => s.id === state.shape) || GAME_DATA.body.shapes[1];
    const bodyCol = state.bodyColor === '#FFFFFF' ? '#FCFBF4' : (state.bodyColor || '#FCFBF4');
    const pointCol = state.pointColor || '#5D4037';
    const earCol = state.earUsePoint ? pointCol : bodyCol;
    const tailCol = state.tailUsePoint ? pointCol : bodyCol;

    const group = new THREE.Group();
    group.scale.set(shapeDef.scaleX, shapeDef.scaleY, shapeDef.scaleX);
    this.charRoot.add(group);
    this.bodyGroup = group;

    // 1. Seamless 2-Sphere Chiikawa Body (Round Mochi Head + Compact Oval Torso, UV seam at -Z)
    const headMat = this._makeToonMat(this.headTexture, true);
    const bodyMat = this._makeToonMat(this.bodyTexture, true);

    const headGeo = new THREE.SphereGeometry(1, 64, 48, -Math.PI / 2);
    const headWrap = this._addOutlinedMesh(group, headGeo, headMat, 0.026);
    headWrap.scale.set(0.86, 0.75, 0.76);
    headWrap.position.set(0, 0.16, 0);

    const torsoGeo = new THREE.SphereGeometry(1, 48, 36, -Math.PI / 2);
    const tPos = torsoGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const vx = tPos.getX(i), vy = tPos.getY(i), vz = tPos.getZ(i);
      const r2 = Math.sqrt(vx * vx + vz * vz);
      const p = 2.28;
      const denom = Math.pow(Math.pow(r2, p) + Math.pow(Math.abs(vy), p), 1 / p);
      if (denom > 1e-5) {
        tPos.setXYZ(i, vx / denom, vy / denom, vz / denom);
      }
    }
    torsoGeo.computeVertexNormals();
    const torsoWrap = this._addOutlinedMesh(group, torsoGeo, bodyMat, 0.026);
    torsoWrap.scale.set(0.60, 0.56, 0.56);
    torsoWrap.position.set(0, -0.32, 0);

    // 1b. Crisp 1:1 Curved Front Face Patch flush on the Head Sphere (+0.004 offset)
    const faceGeo = new THREE.SphereGeometry(1.004, 32, 24, Math.PI * 0.22, Math.PI * 0.56, Math.PI * 0.22, Math.PI * 0.54);
    const faceMat = new THREE.MeshBasicMaterial({
      map: this.faceTexture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.scale.set(0.86, 0.75, 0.76);
    faceMesh.position.set(0, 0.16, 0);
    faceMesh.renderOrder = 3;
    group.add(faceMesh);

    // 2. Stubby 3D Arms positioned at upper torso sides
    const armCol = state.pattern === 'pat_gloves' ? pointCol : bodyCol;
    const armGeo = new THREE.CapsuleGeometry(0.062, 0.08, 8, 16);
    const armMat = this._makeToonMat(armCol);

    const leftArm = this._addOutlinedMesh(group, armGeo, armMat, 0.024);
    leftArm.position.set(-0.63, -0.36, 0.04);
    leftArm.rotation.z = -1.05;

    const rightArm = this._addOutlinedMesh(group, armGeo, armMat, 0.024);
    rightArm.position.set(0.63, -0.36, 0.04);
    rightArm.rotation.z = 1.05;

    // 3. Tiny Stubby 3D Legs
    const legCol = state.pattern === 'pat_gloves' ? pointCol : (state.pattern === 'pat_pants' ? pointCol : bodyCol);
    const legGeo = new THREE.CapsuleGeometry(0.058, 0.065, 8, 16);
    const legMat = this._makeToonMat(legCol);

    const leftLeg = this._addOutlinedMesh(group, legGeo, legMat, 0.024);
    leftLeg.position.set(-0.16, -0.86, 0.04);

    const rightLeg = this._addOutlinedMesh(group, legGeo, legMat, 0.024);
    rightLeg.position.set(0.16, -0.86, 0.04);

    // 4. 3D Ears, Hair, Head Accessories, Tail, Neck/Bags
    this._build3DEars(group, state.earType, earCol, pointCol);
    this._build3DHair(group, state.hairType, earCol);
    this._build3DHeadAccessory(group, state.headAccessory);
    this._build3DTail(group, state.tailType, tailCol, pointCol);
    this._build3DNeckBag(group, state.neckBag);
    this._build3DHandProp(group, state.handProp);
  }

  _build3DEars(group, earType, earCol, pointCol) {
    if (!earType || earType === 'ear_none') return;
    const mat = this._makeToonMat(earCol);
    const pinkMat = this._makeToonMat('#FFBAC4');

    const addPair = (buildFn) => {
      const L = new THREE.Group();
      const R = new THREE.Group();
      buildFn(L, -1);
      buildFn(R, 1);
      group.add(L);
      group.add(R);
    };

    switch (earType) {
      case 'ear_small':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.125, 24, 18), mat, 0.024);
          m.position.set(s * 0.49, 0.89, 0.0);
        });
        break;
      case 'ear_bear':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.18, 24, 18), mat, 0.03);
          m.scale.set(1, 1, 0.72);
          m.position.set(s * 0.50, 0.84, 0.0);
          const inner = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), pinkMat);
          inner.scale.set(1, 1, 0.5);
          inner.position.set(s * 0.50, 0.84, 0.09);
          g.add(inner);
        });
        break;
      case 'ear_big':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.22, 24, 18), mat, 0.032);
          m.scale.set(1, 1.12, 0.75);
          m.position.set(s * 0.52, 0.86, 0.0);
        });
        break;
      case 'ear_cat':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.18, 0.38, 20), mat, 0.032);
          m.scale.set(1, 1, 0.7);
          m.position.set(s * 0.48, 0.92, 0.0);
          m.rotation.z = -s * 0.35;
        });
        break;
      case 'ear_rabbit':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.CapsuleGeometry(0.115, 0.24, 10, 20), mat, 0.03);
          m.scale.set(1, 1, 0.68);
          m.position.set(s * 0.36, 0.94, 0.0);
          m.rotation.z = -s * 0.14;
        });
        break;
      case 'ear_lop':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.CapsuleGeometry(0.12, 0.36, 10, 20), mat, 0.03);
          m.scale.set(1, 1, 0.68);
          m.position.set(s * 0.80, 0.44, 0.02);
          m.rotation.z = s * 0.40;
        });
        break;
      case 'ear_puppy':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.CapsuleGeometry(0.14, 0.30, 10, 20), mat, 0.03);
          m.scale.set(1, 1, 0.65);
          m.position.set(s * 0.80, 0.38, 0.02);
          m.rotation.z = s * 0.22;
        });
        break;
      case 'ear_momonga':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.20, 20, 16), mat, 0.032);
          m.scale.set(1.25, 0.78, 0.65);
          m.position.set(s * 0.70, 0.74, 0.0);
          m.rotation.z = s * 0.45;
        });
        break;
      case 'ear_folded':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.16, 18, 14), mat, 0.032, 1);
          m.scale.set(1.25, 0.65, 0.72);
          m.position.set(s * 0.56, 0.76, 0.04);
          m.rotation.z = -s * 0.65;
        });
        break;
      case 'ear_ram':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.TorusGeometry(0.15, 0.07, 12, 24, Math.PI * 1.55), mat, 0.032, 1);
          m.position.set(s * 0.78, 0.56, 0.06);
          m.rotation.z = s * 0.4;
          m.rotation.y = s * 0.28;
        });
        break;
      case 'ear_side':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.14, 20, 16), mat, 0.03);
          m.scale.set(0.75, 1.15, 0.75);
          m.position.set(s * 0.82, 0.20, 0.0);
        });
        break;
      case 'ear_antenna':
        addPair((g, s) => {
          const stem = this._addOutlinedMesh(g, new THREE.CylinderGeometry(0.026, 0.026, 0.24, 10), mat, 0.022);
          stem.position.set(s * 0.42, 0.90, 0.0);
          stem.rotation.z = -s * 0.22;
          const ball = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.08, 16, 12), mat, 0.026);
          ball.position.set(s * 0.46, 1.02, 0.0);
        });
        break;
      case 'ear_fin':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.16, 0.30, 4), mat, 0.03);
          m.scale.set(0.4, 1, 1.2);
          m.position.set(s * 0.82, 0.32, 0.0);
          m.rotation.z = -s * 1.3;
        });
        break;
      case 'ear_leaf':
        addPair((g, s) => {
          const leafMat = this._makeToonMat('#81C784');
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.17, 18, 14), leafMat, 0.03);
          m.scale.set(1.3, 0.55, 0.4);
          m.position.set(s * 0.50, 0.94, 0.0);
          m.rotation.z = s * 0.5;
        });
        break;
      case 'ear_devil':
        addPair((g, s) => {
          const base = this._addOutlinedMesh(g, new THREE.CylinderGeometry(0.055, 0.09, 0.24, 16), mat, 0.026);
          base.position.set(s * 0.36, 0.90, 0.04);
          base.rotation.set(-0.2, 0, s * 0.35);
          const tip = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.055, 0.18, 16), mat, 0.026);
          tip.position.set(s * 0.30, 1.05, 0.08);
          tip.rotation.set(-0.35, 0, s * 0.75);
        });
        break;
      case 'ear_curled':
        addPair((g, s) => {
          const torus = this._addOutlinedMesh(g, new THREE.TorusGeometry(0.18, 0.065, 14, 28, Math.PI * 1.3), mat, 0.026);
          torus.position.set(s * 0.62, 0.66, 0.06);
          torus.rotation.set(0.15, s * 0.4, -s * 0.7);
          const tip = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.065, 0.14, 14), mat, 0.024);
          tip.position.set(s * 0.52, 0.52, 0.12);
          tip.rotation.set(0.2, s * 0.3, s * 1.8);
        });
        break;
      case 'ear_dragon':
        addPair((g, s) => {
          [
            { dy: 0.16, rot: 0.25, len: 0.34, rad: 0.09 },
            { dy: 0.00, rot: -0.15, len: 0.38, rad: 0.10 },
            { dy: -0.16, rot: -0.55, len: 0.32, rad: 0.085 }
          ].forEach(cfg => {
            const fin = this._addOutlinedMesh(g, new THREE.ConeGeometry(cfg.rad, cfg.len, 5), mat, 0.024);
            fin.scale.set(0.3, 1, 1.2);
            fin.position.set(s * 0.72, 0.50 + cfg.dy, 0.0);
            fin.rotation.set(0, 0, -s * (Math.PI / 2 + cfg.rot));
          });
        });
        break;
      case 'ear_bunny_droop':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.CapsuleGeometry(0.11, 0.50, 10, 20), mat, 0.028);
          m.scale.set(0.8, 1, 0.7);
          m.position.set(s * 0.72, 0.28, 0.02);
          m.rotation.z = s * 0.14;
          const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.38, 8, 16), pinkMat);
          inner.scale.set(0.7, 1, 0.5);
          inner.position.set(s * 0.72, 0.28, 0.05);
          inner.rotation.z = s * 0.14;
          g.add(inner);
        });
        break;
      case 'ear_mouse':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32), mat, 0.03, 1);
          m.position.set(s * 0.58, 0.86, 0.0);
          m.rotation.set(Math.PI / 2, 0, -s * 0.22);
          // Pink inner circle
          const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.054, 24), pinkMat);
          inner.position.set(s * 0.58, 0.86, 0.012);
          inner.rotation.set(Math.PI / 2, 0, -s * 0.22);
          g.add(inner);
        });
        break;
      case 'ear_deer':
        addPair((g, s) => {
          const main = this._addOutlinedMesh(g, new THREE.CylinderGeometry(0.032, 0.046, 0.40, 10), mat, 0.022);
          main.position.set(s * 0.44, 0.96, 0.0);
          main.rotation.z = -s * 0.35;
          const p1 = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.026, 0.18, 10), mat, 0.02);
          p1.position.set(s * 0.42, 0.98, 0.08);
          p1.rotation.set(-0.7, 0, -s * 0.4);
          const p2 = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.024, 0.20, 10), mat, 0.02);
          p2.position.set(s * 0.52, 1.10, 0.0);
          p2.rotation.z = -s * 0.75;
          const tip = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.032, 0.18, 10), mat, 0.02);
          tip.position.set(s * 0.46, 1.20, 0.0);
          tip.rotation.z = -s * 0.15;
        });
        break;
      case 'ear_pointed':
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.ConeGeometry(0.12, 0.44, 16), mat, 0.025);
          m.scale.set(0.3, 1, 0.85);
          m.position.set(s * 0.82, 0.44, 0.0);
          m.rotation.set(0.1, 0, -s * (Math.PI / 2 + 0.18));
          const inner = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.32, 12), pinkMat);
          inner.scale.set(0.25, 1, 0.7);
          inner.position.set(s * 0.80, 0.44, 0.02);
          inner.rotation.set(0.1, 0, -s * (Math.PI / 2 + 0.18));
          g.add(inner);
        });
        break;
      case 'ear_fluffy_top':
        addPair((g, s) => {
          [
            { dx: -0.08, dy: -0.02, r: 0.11 },
            { dx: 0.00, dy: 0.06, r: 0.14 },
            { dx: 0.08, dy: -0.01, r: 0.12 }
          ].forEach(cfg => {
            const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(cfg.r, 16, 14), mat, 0.025);
            m.position.set(s * (0.46 + cfg.dx), 0.88 + cfg.dy, 0.0);
          });
        });
        break;
      case 'ear_round':
      default:
        addPair((g, s) => {
          const m = this._addOutlinedMesh(g, new THREE.SphereGeometry(0.14, 24, 18), mat, 0.028);
          m.scale.set(1, 1, 0.82);
          m.position.set(s * 0.46, 0.84, 0.0);
        });
        break;
    }
  }

  _build3DHair(group, hairType, earCol) {
    // Hair disabled per user request
    return;
    const mat = this._makeToonMat(earCol);
    if (hairType === 'hair_tuft') {
      const m1 = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.10, 0.26, 14), mat, 0.03, 1);
      m1.position.set(-0.04, 0.94, 0.06);
      m1.rotation.z = 0.25;
      const m2 = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.085, 0.22, 14), mat, 0.028, 1);
      m2.position.set(0.07, 0.92, 0.06);
      m2.rotation.z = -0.35;
    } else if (hairType === 'hair_fluffy') {
      [-0.14, 0, 0.14].forEach((x, i) => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(i === 1 ? 0.13 : 0.11, 16, 14), mat, 0.024, 1);
        m.position.set(x, i === 1 ? 0.92 : 0.89, 0.24);
      });
    } else if (hairType === 'hair_curl') {
      [-0.09, 0.09].forEach((x) => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.10, 18, 14), mat, 0.024, 1);
        m.scale.set(1.0, 0.95, 0.85);
        m.position.set(x, 0.96, 0.24);
      });
    } else if (hairType === 'hair_bangs') {
      [-0.16, 0, 0.16].forEach(x => {
        const m = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.10, 0.20, 14), mat, 0.024, 1);
        m.scale.set(1.1, 1, 0.45);
        m.position.set(x, 0.65, x === 0 ? 0.65 : 0.63);
        m.rotation.x = Math.PI * 0.84;
        m.rotation.z = -x * 0.5;
      });
    } else if (hairType === 'hair_parted') {
      [-1, 1].forEach(s => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.15, 16, 12), mat, 0.024, 1);
        m.scale.set(1.25, 0.46, 0.35);
        m.position.set(s * 0.16, 0.68, 0.60);
        m.rotation.set(0.28, s * 0.22, -s * 0.45);
      });
    } else if (hairType === 'hair_ahoge') {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.88, 0.12),
        new THREE.Vector3(-0.04, 1.06, 0.14),
        new THREE.Vector3(0.08, 1.15, 0.12)
      ]);
      this._addOutlinedMesh(group, new THREE.TubeGeometry(curve, 14, 0.032, 10, false), mat, 0.022, 1);
    } else if (hairType === 'hair_twinpuffs') {
      [-0.58, 0.58].forEach(x => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.16, 18, 14), mat, 0.024, 1);
        m.position.set(x, 0.72, 0.10);
      });
    } else if (hairType === 'hair_sideswept') {
      const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.22, 18, 14), mat, 0.024, 1);
      m.scale.set(1.6, 0.42, 0.35);
      m.position.set(-0.10, 0.67, 0.60);
      m.rotation.set(0.25, 0.15, 0.25);
    } else if (hairType === 'hair_pigtails') {
      [-1, 1].forEach(s => {
        const m = this._addOutlinedMesh(group, new THREE.CapsuleGeometry(0.10, 0.26, 8, 14), mat, 0.024, 1);
        m.position.set(s * 0.72, 0.46, 0.02);
        m.rotation.z = s * 0.28;
      });
    } else if (hairType === 'hair_mohawk') {
      [-0.08, 0, 0.08].forEach((z, i) => {
        const m = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.09, 0.24 - i * 0.02, 12), mat, 0.024, 1);
        m.position.set(0, 0.94 - i * 0.03, 0.16 - z);
        m.rotation.x = -0.2 * i;
      });
    } else if (hairType === 'hair_swoop') {
      const m = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.14, 0.30, 14), mat, 0.024, 1);
      m.scale.set(1.2, 1, 0.45);
      m.position.set(0.06, 0.70, 0.62);
      m.rotation.set(Math.PI * 0.80, 0, 0.65);
    } else if (hairType === 'hair_bob') {
      [-1, 1].forEach(s => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.18, 18, 14), mat, 0.024, 1);
        m.scale.set(1.15, 0.52, 0.35);
        m.position.set(s * 0.15, 0.69, 0.62);
        m.rotation.set(0.24, 0, -s * 0.3);
      });
    } else if (hairType === 'hair_messy') {
      [-0.14, 0, 0.14].forEach((x, i) => {
        const m = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.09, 0.22, 10), mat, 0.026, 1);
        m.position.set(x, 0.94 + (i === 1 ? 0.04 : 0), 0.12);
        m.rotation.set(-0.15, 0, (i - 1) * 0.35);
      });
    } else if (hairType === 'hair_braid') {
      [0, 1, 2].forEach(i => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.08 - i * 0.012, 14, 10), mat, 0.022, 1);
        m.position.set(0.68, 0.56 - i * 0.12, 0.08);
      });
    } else if (hairType === 'hair_ponytail') {
      const m = this._addOutlinedMesh(group, new THREE.CapsuleGeometry(0.10, 0.34, 10, 18), mat, 0.026, 1);
      m.position.set(0.25, 1.05, -0.15);
      m.rotation.set(-0.6, 0, 0.5);
    } else if (hairType === 'hair_wavy_fringe') {
      [-0.18, -0.06, 0.06, 0.18].forEach(x => {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.09, 14, 10), mat, 0.022, 1);
        m.scale.set(1, 0.7, 0.4);
        m.position.set(x, 0.67, 0.64);
      });
    } else if (hairType === 'hair_cowlick') {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.88, 0.10),
        new THREE.Vector3(0.06, 1.04, 0.10),
        new THREE.Vector3(-0.08, 1.14, 0.10)
      ]);
      this._addOutlinedMesh(group, new THREE.TubeGeometry(curve, 14, 0.038, 10, false), mat, 0.024, 1);
    } else if (hairType === 'hair_dreadlocks') {
      [-1, 1].forEach(s => {
        const m = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.05, 0.04, 0.36, 10), mat, 0.024, 1);
        m.position.set(s * 0.70, 0.42, 0.05);
        m.rotation.z = s * 0.25;
      });
    } else if (hairType === 'hair_curtains') {
      [-1, 1].forEach(s => {
        const m = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.12, 0.26, 12), mat, 0.024, 1);
        m.scale.set(1, 1, 0.4);
        m.position.set(s * 0.22, 0.66, 0.61);
        m.rotation.set(Math.PI * 0.82, 0, -s * 0.42);
      });
    }
  }

  _makeExtrudedStarGeo(outerR = 0.13, innerR = 0.055, depth = 0.05) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  }

  _makeExtrudedHeartGeo(scale = 0.14, depth = 0.05) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.7 * scale);
    s.bezierCurveTo(0.8 * scale, -0.1 * scale, 1.0 * scale, 0.7 * scale, 0.45 * scale, 0.9 * scale);
    s.bezierCurveTo(0.15 * scale, 1.0 * scale, 0, 0.65 * scale, 0, 0.45 * scale);
    s.bezierCurveTo(0, 0.65 * scale, -0.15 * scale, 1.0 * scale, -0.45 * scale, 0.9 * scale);
    s.bezierCurveTo(-1.0 * scale, 0.7 * scale, -0.8 * scale, -0.1 * scale, 0, -0.7 * scale);
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  }

  _build3DHeadAccessory(group, acc) {
    if (!acc || acc === 'acc_none') return;
    switch (acc) {
      case 'acc_ribbon': {
        const mat = this._makeToonMat('#F0627D');
        const rg = new THREE.Group();
        rg.position.set(0.42, 0.74, 0.52);
        rg.rotation.set(0, 0, -0.35);
        const lWing = this._addOutlinedMesh(rg, new THREE.ConeGeometry(0.11, 0.22, 16), mat, 0.024, 1);
        lWing.scale.set(1.0, 1.0, 0.38);
        lWing.position.set(-0.11, 0, 0);
        lWing.rotation.z = -Math.PI / 2;
        const rWing = this._addOutlinedMesh(rg, new THREE.ConeGeometry(0.11, 0.22, 16), mat, 0.024, 1);
        rWing.scale.set(1.0, 1.0, 0.38);
        rWing.position.set(0.11, 0, 0);
        rWing.rotation.z = Math.PI / 2;
        const knot = this._addOutlinedMesh(rg, new THREE.SphereGeometry(0.052, 12, 10), mat, 0.024, 1);
        knot.scale.set(1, 1, 0.5);
        group.add(rg);
        break;
      }
      case 'acc_beret': {
        const mat = this._makeToonMat('#E57373');
        const hat = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.40, 24, 16), mat, 0.042, 1);
        hat.scale.set(1.12, 0.42, 1.12);
        hat.position.set(0, 0.90, 0);
        const stem = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.024, 0.024, 0.09, 8), mat, 0.025, 1);
        stem.position.set(0, 1.09, 0);
        break;
      }
      case 'acc_crown': {
        const mat = this._makeToonMat('#FFD54F');
        const cg = new THREE.Group();
        cg.position.set(0, 0.90, 0);
        this._addOutlinedMesh(cg, new THREE.CylinderGeometry(0.20, 0.17, 0.12, 16), mat, 0.03, 1);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const sp = this._addOutlinedMesh(cg, new THREE.ConeGeometry(0.055, 0.12, 8), mat, 0.024, 1);
          sp.position.set(Math.cos(a) * 0.15, 0.10, Math.sin(a) * 0.15);
        }
        group.add(cg);
        break;
      }
      case 'acc_sprout': {
        const stemMat = this._makeToonMat('#558B2F');
        const leafMat = this._makeToonMat('#81C784');
        const stem = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.024, 0.024, 0.24, 8), stemMat, 0.024, 1);
        stem.position.set(0, 0.95, 0);
        const l1 = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.10, 14, 10), leafMat, 0.028, 1);
        l1.scale.set(1.3, 0.5, 0.4);
        l1.position.set(-0.10, 1.07, 0);
        l1.rotation.z = 0.4;
        const l2 = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.10, 14, 10), leafMat, 0.028, 1);
        l2.scale.set(1.3, 0.5, 0.4);
        l2.position.set(0.10, 1.07, 0);
        l2.rotation.z = -0.4;
        break;
      }
      case 'acc_flower': {
        const petalMat = this._makeToonMat('#FFBAC4');
        const centerMat = this._makeToonMat('#FFD54F');
        const fg = new THREE.Group();
        fg.position.set(-0.40, 0.74, 0.42);
        fg.rotation.set(-0.35, -0.42, 0.25);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const p = this._addOutlinedMesh(fg, new THREE.SphereGeometry(0.065, 10, 10), petalMat, 0.024, 1);
          p.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
        }
        this._addOutlinedMesh(fg, new THREE.SphereGeometry(0.052, 10, 10), centerMat, 0.024, 1);
        group.add(fg);
        break;
      }
      case 'acc_star': {
        const mat = this._makeToonMat('#FFF176');
        const s = this._addOutlinedMesh(group, this._makeExtrudedStarGeo(0.12, 0.052, 0.03), mat, 0.024, 1);
        s.position.set(0.40, 0.74, 0.42);
        s.rotation.set(-0.35, 0.42, -0.2);
        break;
      }
      case 'acc_halo': {
        const mat = this._makeToonMat('#FFE066');
        const halo = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.24, 0.038, 12, 32), mat, 0.022, 1);
        halo.rotation.x = Math.PI / 2 - 0.15;
        halo.position.set(0, 1.06, 0.06);
        break;
      }
      case 'acc_horns': {
        const mat = this._makeToonMat('#E53935');
        [-1, 1].forEach(s => {
          const h = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.075, 0.22, 14), mat, 0.022, 1);
          h.position.set(s * 0.26, 0.96, 0.16);
          h.rotation.z = -s * 0.35;
        });
        break;
      }
      case 'acc_beanie': {
        const mat = this._makeToonMat('#FF8A65');
        const cap = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.44, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, 0.028, 1);
        cap.scale.set(1.05, 0.75, 1.0);
        cap.position.set(0, 0.68, 0.04);
        const rim = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.44, 0.055, 12, 32), this._makeToonMat('#FFAB91'), 0.024, 1);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, 0.70, 0.04);
        const pom = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.09, 14, 12), this._makeToonMat('#FFFFFF'), 0.024, 1);
        pom.position.set(0, 1.04, 0.04);
        break;
      }
      case 'acc_strawhat': {
        const mat = this._makeToonMat('#F5D782');
        const brim = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.66, 0.70, 0.04, 28), mat, 0.026, 1);
        brim.position.set(0, 0.84, 0.04);
        const top = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.32, 0.36, 0.18, 24), mat, 0.026, 1);
        top.position.set(0, 0.94, 0.04);
        const band = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.365, 0.365, 0.05, 24), this._makeToonMat('#E53935'), 0.02, 1);
        band.position.set(0, 0.88, 0.04);
        break;
      }
      case 'acc_witch': {
        const mat = this._makeToonMat('#5E35B1');
        const brim = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.62, 0.64, 0.035, 28), mat, 0.026, 1);
        brim.position.set(0, 0.84, 0.04);
        const cone = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.32, 0.44, 24), mat, 0.026, 1);
        cone.position.set(-0.02, 1.06, 0.04);
        cone.rotation.z = 0.12;
        const band = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.31, 0.33, 0.05, 24), this._makeToonMat('#FFD54F'), 0.02, 1);
        band.position.set(0, 0.88, 0.04);
        break;
      }
      case 'acc_headphones': {
        const band = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.84, 0.04, 10, 32, Math.PI), this._makeToonMat('#455A64'), 0.022, 1);
        band.position.set(0, 0.18, 0.02);
        [-1, 1].forEach(s => {
          const cup = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.15, 0.15, 0.09, 18), this._makeToonMat('#F0627D'), 0.024, 1);
          cup.rotation.z = Math.PI / 2;
          cup.position.set(s * 0.86, 0.18, 0.02);
        });
        break;
      }
      case 'acc_heartpin': {
        const h = this._addOutlinedMesh(group, this._makeExtrudedHeartGeo(0.11, 0.03), this._makeToonMat('#FF4081'), 0.022, 1);
        h.position.set(0.42, 0.72, 0.52);
        h.rotation.z = -0.25;
        break;
      }
      case 'acc_bandaid': {
        const m = this._addOutlinedMesh(group, new THREE.BoxGeometry(0.22, 0.08, 0.03), this._makeToonMat('#FFE0B2'), 0.02, 1);
        m.position.set(-0.34, 0.62, 0.60);
        m.rotation.z = 0.35;
        break;
      }
    }
  }

  _build3DTail(group, tailType, tailCol, pointCol) {
    if (!tailType || tailType === 'tail_none') return;
    const mat = this._makeToonMat(tailCol);
    const ptMat = this._makeToonMat(pointCol);

    switch (tailType) {
      case 'tail_fluffy': {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.20, 20, 16), mat, 0.038, 1);
        m.position.set(0, -0.52, -0.54);
        break;
      }
      case 'tail_short': {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.13, 18, 14), mat, 0.034, 1);
        m.position.set(0, -0.54, -0.52);
        break;
      }
      case 'tail_cat': {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.50, -0.40),
          new THREE.Vector3(0.06, -0.50, -0.74),
          new THREE.Vector3(0.20, -0.22, -0.90),
          new THREE.Vector3(0.24, 0.12, -0.84)
        ]);
        this._addOutlinedMesh(group, new THREE.TubeGeometry(curve, 20, 0.065, 12, false), mat, 0.032, 1);
        const tip = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.065, 12, 10), mat, 0.032, 1);
        tip.position.set(0.24, 0.12, -0.84);
        break;
      }
      case 'tail_swirl': {
        const base = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.50, -0.40),
          new THREE.Vector3(0, -0.50, -0.60)
        ]);
        this._addOutlinedMesh(group, new THREE.TubeGeometry(base, 8, 0.055, 10, false), mat, 0.03, 1);
        const m = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.14, 0.055, 12, 24, Math.PI * 1.6), mat, 0.032, 1);
        m.position.set(0, -0.40, -0.64);
        break;
      }
      case 'tail_bushy':
      case 'tail_fox': {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.26, 22, 18), mat, 0.038, 1);
        m.scale.set(0.75, 1.35, 0.85);
        m.position.set(0.12, -0.38, -0.66);
        m.rotation.set(-0.42, 0, -0.32);
        if (tailType === 'tail_fox') {
          const tip = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.14, 14, 12), this._makeToonMat('#FFFFFF'), 0.032, 1);
          tip.position.set(0.26, -0.06, -0.82);
        }
        break;
      }
      case 'tail_dragon': {
        const m = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.18, 0.56, 16), mat, 0.034, 1);
        m.position.set(0, -0.50, -0.64);
        m.rotation.x = -1.25;
        break;
      }
      case 'tail_beaver': {
        const m = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.21, 18, 14), ptMat, 0.036, 1);
        m.scale.set(0.85, 0.36, 1.35);
        m.position.set(0, -0.58, -0.64);
        m.rotation.x = 0.2;
        break;
      }
      case 'tail_fish': {
        const stem = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.05, 0.07, 0.22, 10), mat, 0.03, 1);
        stem.position.set(0, -0.52, -0.52);
        stem.rotation.x = Math.PI / 2;
        const fin1 = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.15, 0.30, 4), mat, 0.032, 1);
        fin1.scale.set(0.45, 1, 1.1);
        fin1.position.set(0, -0.42, -0.68);
        fin1.rotation.x = -0.8;
        const fin2 = this._addOutlinedMesh(group, new THREE.ConeGeometry(0.15, 0.30, 4), mat, 0.032, 1);
        fin2.scale.set(0.45, 1, 1.1);
        fin2.position.set(0, -0.60, -0.68);
        fin2.rotation.x = -2.3;
        break;
      }
      case 'tail_sprout': {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.50, -0.40),
          new THREE.Vector3(0, -0.48, -0.68),
          new THREE.Vector3(0, -0.26, -0.78)
        ]);
        this._addOutlinedMesh(group, new THREE.TubeGeometry(curve, 14, 0.032, 8, false), this._makeToonMat('#558B2F'), 0.024, 1);
        const leafMat = this._makeToonMat('#81C784');
        [-1, 1].forEach(s => {
          const lf = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.10, 12, 10), leafMat, 0.026, 1);
          lf.scale.set(1.3, 0.5, 0.4);
          lf.position.set(s * 0.09, -0.22, -0.78);
          lf.rotation.z = -s * 0.4;
        });
        break;
      }
      default: {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.50, -0.40),
          new THREE.Vector3(0.06, -0.45, -0.72),
          new THREE.Vector3(0.10, -0.18, -0.80)
        ]);
        this._addOutlinedMesh(group, new THREE.TubeGeometry(curve, 16, 0.045, 10, false), mat, 0.03, 1);
        const tipCol = tailType === 'tail_heart' ? '#F0627D' : (tailType === 'tail_star' ? '#FFD54F' : pointCol);
        const tipGeo = tailType === 'tail_heart'
          ? this._makeExtrudedHeartGeo(0.14, 0.04)
          : (tailType === 'tail_star'
            ? this._makeExtrudedStarGeo(0.14, 0.06, 0.04)
            : (tailType === 'tail_devil'
              ? new THREE.ConeGeometry(0.13, 0.22, 4)
              : new THREE.SphereGeometry(0.12, 14, 12)));
        const tip = this._addOutlinedMesh(group, tipGeo, this._makeToonMat(tipCol), 0.028, 1);
        tip.position.set(0.10, -0.18, -0.80);
        if (tailType === 'tail_heart' || tailType === 'tail_star') {
          tip.rotation.y = 0.55;
        }
        break;
      }
    }
  }

  _build3DNeckBag(group, neckBag) {
    if (!neckBag || neckBag === 'neck_none') return;
    switch (neckBag) {
      case 'neck_towel': {
        const mat = this._makeToonMat('#FFFFFF');
        const ring = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.69, 0.072, 16, 36), mat, 0.024, 1);
        ring.scale.set(1.06, 1.0, 0.94);
        ring.rotation.x = Math.PI / 2 - 0.16;
        ring.position.set(0, -0.32, 0.02);
        break;
      }
      case 'neck_scarf': {
        const mat = this._makeToonMat('#546E7A');
        const ring = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.62, 0.085, 14, 32), mat, 0.034, 1);
        ring.scale.set(1.10, 1.0, 1.0);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -0.32, 0);
        const tail = this._addOutlinedMesh(group, new THREE.CapsuleGeometry(0.075, 0.22, 8, 12), mat, 0.03, 1);
        tail.scale.set(1.15, 1, 0.55);
        tail.position.set(0.16, -0.48, 0.62);
        tail.rotation.z = 0.22;
        break;
      }
      case 'neck_bell': {
        const strap = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.62, 0.042, 12, 32), this._makeToonMat('#E53935'), 0.028, 1);
        strap.scale.set(1.10, 1.0, 1.0);
        strap.rotation.x = Math.PI / 2;
        strap.position.set(0, -0.32, 0);
        const bell = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.095, 16, 14), this._makeToonMat('#FFD54F'), 0.032, 1);
        bell.position.set(0, -0.38, 0.66);
        break;
      }
      case 'neck_bowtie': {
        const mat = this._makeToonMat('#5D4037');
        const bg = new THREE.Group();
        bg.position.set(0, -0.30, 0.68);
        const l = this._addOutlinedMesh(bg, new THREE.ConeGeometry(0.095, 0.18, 16), mat, 0.022, 1);
        l.scale.set(1.0, 1.0, 0.38);
        l.position.set(-0.09, 0, 0);
        l.rotation.z = -Math.PI / 2;
        const r = this._addOutlinedMesh(bg, new THREE.ConeGeometry(0.095, 0.18, 16), mat, 0.022, 1);
        r.scale.set(1.0, 1.0, 0.38);
        r.position.set(0.09, 0, 0);
        r.rotation.z = Math.PI / 2;
        const knot = this._addOutlinedMesh(bg, new THREE.SphereGeometry(0.044, 12, 10), mat, 0.022, 1);
        knot.scale.set(1, 1, 0.5);
        group.add(bg);
        break;
      }
      case 'neck_cape': {
        const mat = this._makeToonMat('#EF9A9A');
        const cape = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.66, 0.84, 0.36, 28, 1, false), mat, 0.034, 1);
        cape.position.set(0, -0.48, -0.02);
        const collar = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.62, 0.06, 12, 32), this._makeToonMat('#F48FB1'), 0.028, 1);
        collar.scale.set(1.10, 1.0, 1.0);
        collar.rotation.x = Math.PI / 2;
        collar.position.set(0, -0.32, 0);
        break;
      }
      case 'neck_pochette': {
        const strapCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.62, -0.18, 0.44),
          new THREE.Vector3(-0.08, -0.36, 0.68),
          new THREE.Vector3(0.46, -0.52, 0.42),
          new THREE.Vector3(0.24, -0.34, -0.58),
          new THREE.Vector3(-0.26, -0.16, -0.56)
        ], true);
        this._addOutlinedMesh(group, new THREE.TubeGeometry(strapCurve, 36, 0.018, 8, true), this._makeToonMat(this.outlineHex), 0, 1);
        const bag = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.145, 18, 16), this._makeToonMat('#F48FB1'), 0.024, 1);
        bag.scale.set(1.08, 0.88, 0.55);
        bag.position.set(0.46, -0.52, 0.42);
        bag.rotation.y = 0.45;
        break;
      }
      case 'neck_overalls': {
        const mat = this._makeToonMat('#64B5F6');
        const body = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.63, 0.68, 0.36, 28), mat, 0.026, 1);
        body.position.set(0, -0.54, 0.0);
        [-0.22, 0.22].forEach(x => {
          const strap = this._addOutlinedMesh(group, new THREE.BoxGeometry(0.08, 0.22, 0.06), mat, 0.02, 1);
          strap.position.set(x, -0.32, 0.54);
        });
        break;
      }
      case 'neck_hoodie': {
        const mat = this._makeToonMat('#F8BBD0');
        const body = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.64, 0.70, 0.40, 28), mat, 0.026, 1);
        body.position.set(0, -0.50, 0.0);
        const hood = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.66, 0.09, 14, 32), this._makeToonMat('#F48FB1'), 0.024, 1);
        hood.rotation.x = Math.PI / 2;
        hood.position.set(0, -0.30, -0.04);
        break;
      }
      case 'neck_apron': {
        const mat = this._makeToonMat('#FFFFFF');
        const apron = this._addOutlinedMesh(group, new THREE.BoxGeometry(0.62, 0.40, 0.14), mat, 0.024, 1);
        apron.position.set(0, -0.52, 0.54);
        const ribbon = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.63, 0.035, 10, 32), this._makeToonMat('#F0627D'), 0.02, 1);
        ribbon.rotation.x = Math.PI / 2;
        ribbon.position.set(0, -0.34, 0);
        break;
      }
      case 'neck_lei': {
        const cols = ['#FF8A80', '#FFD180', '#FFFF8D', '#A7FFEB', '#EA80FC', '#FF80AB'];
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const fl = this._addOutlinedMesh(group, new THREE.SphereGeometry(0.085, 12, 10), this._makeToonMat(cols[i % cols.length]), 0.02, 1);
          fl.scale.set(1, 0.8, 0.6);
          fl.position.set(Math.sin(a) * 0.66, -0.34, Math.cos(a) * 0.62);
        }
        break;
      }
      case 'neck_backpack': {
        const mat = this._makeToonMat('#FFB74D');
        const pack = this._addOutlinedMesh(group, new THREE.BoxGeometry(0.54, 0.52, 0.28), mat, 0.026, 1);
        pack.position.set(0, -0.44, -0.56);
        const pocket = this._addOutlinedMesh(group, new THREE.BoxGeometry(0.36, 0.22, 0.10), this._makeToonMat('#FFE082'), 0.02, 1);
        pocket.position.set(0, -0.54, -0.70);
        break;
      }
      case 'neck_medal': {
        const strap = this._addOutlinedMesh(group, new THREE.TorusGeometry(0.64, 0.03, 10, 32), this._makeToonMat('#42A5F5'), 0.018, 1);
        strap.rotation.x = Math.PI / 2 - 0.12;
        strap.position.set(0, -0.32, 0.02);
        const medal = this._addOutlinedMesh(group, new THREE.CylinderGeometry(0.11, 0.11, 0.04, 20), this._makeToonMat('#FFD54F'), 0.022, 1);
        medal.rotation.x = Math.PI / 2;
        medal.position.set(0, -0.44, 0.66);
        break;
      }
    }
  }

  _build3DHandProp(group, prop) {
    if (!prop || prop === 'prop_none') return;
    const pg = new THREE.Group();
    pg.position.set(0.76, -0.36, 0.22);
    switch (prop) {
      case 'prop_sasumata': {
        const mat = this._makeToonMat('#CFD8DC');
        const staff = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.028, 0.028, 0.95, 10), mat, 0.02, 1);
        staff.position.set(0, 0.22, 0);
        const fork = this._addOutlinedMesh(pg, new THREE.TorusGeometry(0.12, 0.028, 10, 18, Math.PI), mat, 0.02, 1);
        fork.rotation.z = Math.PI;
        fork.position.set(0, 0.72, 0);
        pg.rotation.z = -0.22;
        break;
      }
      case 'prop_wand': {
        const stick = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.024, 0.024, 0.65, 10), this._makeToonMat('#F48FB1'), 0.02, 1);
        stick.position.set(0, 0.20, 0);
        const star = this._addOutlinedMesh(pg, this._makeExtrudedStarGeo(0.14, 0.06, 0.03), this._makeToonMat('#FFD54F'), 0.022, 1);
        star.position.set(0, 0.56, 0);
        pg.rotation.z = -0.25;
        break;
      }
      case 'prop_boba': {
        const cup = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.12, 0.09, 0.28, 18), this._makeToonMat('#D7CCC8'), 0.022, 1);
        cup.position.set(0, 0.08, 0);
        const lid = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.13, 0.13, 0.04, 18), this._makeToonMat('#FFFFFF'), 0.02, 1);
        lid.position.set(0, 0.23, 0);
        const straw = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), this._makeToonMat('#F0627D'), 0.015, 1);
        straw.position.set(0.03, 0.30, 0);
        break;
      }
      case 'prop_lollipop': {
        const stick = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), this._makeToonMat('#FFFFFF'), 0.015, 1);
        stick.position.set(0, 0.14, 0);
        const candy = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), this._makeToonMat('#FF80AB'), 0.022, 1);
        candy.rotation.x = Math.PI / 2;
        candy.position.set(0, 0.42, 0);
        pg.rotation.z = -0.20;
        break;
      }
      case 'prop_onigiri': {
        const rice = this._addOutlinedMesh(pg, new THREE.ConeGeometry(0.15, 0.22, 16), this._makeToonMat('#FFFFFF'), 0.022, 1);
        rice.scale.set(1.1, 1.0, 0.65);
        rice.position.set(0, 0.06, 0);
        const nori = this._addOutlinedMesh(pg, new THREE.BoxGeometry(0.12, 0.10, 0.14), this._makeToonMat('#2E3A2F'), 0.018, 1);
        nori.position.set(0, -0.02, 0.02);
        break;
      }
      case 'prop_balloon': {
        const str = this._addOutlinedMesh(pg, new THREE.CylinderGeometry(0.01, 0.01, 0.56, 6), this._makeToonMat('#4A3832'), 0, 1);
        str.position.set(0, 0.26, 0);
        const h = this._addOutlinedMesh(pg, this._makeExtrudedHeartGeo(0.20, 0.06), this._makeToonMat('#FF5252'), 0.024, 1);
        h.position.set(0, 0.66, 0);
        break;
      }
      case 'prop_plush': {
        const body = this._addOutlinedMesh(pg, new THREE.SphereGeometry(0.13, 16, 14), this._makeToonMat('#BCAAA4'), 0.022, 1);
        body.position.set(0, 0.06, 0);
        [-0.08, 0.08].forEach(x => {
          const ear = this._addOutlinedMesh(pg, new THREE.SphereGeometry(0.045, 10, 10), this._makeToonMat('#BCAAA4'), 0.018, 1);
          ear.position.set(x, 0.18, 0);
        });
        break;
      }
    }
    group.add(pg);
  }

  _paintHeadTexture(state) {
    const ctx = this.headCtx;
    const W = 512, H = 512;
    const bodyCol = state.bodyColor === '#FFFFFF' ? '#FCFBF4' : (state.bodyColor || '#FCFBF4');
    const pointCol = state.pointColor || '#5D4037';

    ctx.fillStyle = bodyCol;
    ctx.fillRect(0, 0, W, H);

    if (state.pattern === 'pat_spots') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(W * 0.64, H * 0.34, 28, 22, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (state.marking === 'mark_half') {
      ctx.fillStyle = pointCol;
      ctx.fillRect(W * 0.5, 0, W * 0.5, H);
    }
  }

  _paintBodyTexture(state) {
    const ctx = this.texCtx;
    const W = 1024, H = 1024;
    const bodyCol = state.bodyColor === '#FFFFFF' ? '#FCFBF4' : (state.bodyColor || '#FCFBF4');
    const pointCol = state.pointColor || '#5D4037';

    ctx.fillStyle = bodyCol;
    ctx.fillRect(0, 0, W, H);

    if (state.pattern === 'pat_belly') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.54, 150, 125, 0, 0, Math.PI * 2); ctx.fill();
    } else if (state.pattern === 'pat_bib') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.36, 130, 95, 0, 0, Math.PI * 2); ctx.fill();
    } else if (state.pattern === 'pat_heart') {
      ctx.fillStyle = pointCol;
      const hx = W * 0.5, hy = H * 0.52;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 55);
      ctx.bezierCurveTo(hx - 85, hy + 5, hx - 90, hy - 55, hx - 42, hy - 60);
      ctx.bezierCurveTo(hx - 15, hy - 64, hx, hy - 36, hx, hy - 24);
      ctx.bezierCurveTo(hx, hy - 36, hx + 15, hy - 64, hx + 42, hy - 60);
      ctx.bezierCurveTo(hx + 90, hy - 55, hx + 85, hy + 5, hx, hy + 55);
      ctx.fill();
    } else if (state.pattern === 'pat_stripes') {
      ctx.strokeStyle = pointCol;
      ctx.lineWidth = 28;
      ctx.lineCap = 'round';
      [H * 0.44, H * 0.58].forEach(y => {
        ctx.beginPath(); ctx.moveTo(W * 0.14, y); ctx.lineTo(W * 0.34, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * 0.66, y); ctx.lineTo(W * 0.86, y); ctx.stroke();
      });
    } else if (state.pattern === 'pat_spots') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(W * 0.34, H * 0.48, 75, 58, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.68, H * 0.60, 82, 62, -0.2, 0, Math.PI * 2); ctx.fill();
    } else if (state.pattern === 'pat_back') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(W * 0.02, H * 0.50, 125, 110, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W * 0.98, H * 0.50, 125, 110, 0, 0, Math.PI * 2); ctx.fill();
    } else if (state.pattern === 'pat_pants') {
      ctx.fillStyle = pointCol;
      ctx.fillRect(0, H * 0.54, W, H * 0.46);
      ctx.strokeStyle = this.outlineHex;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(0, H * 0.54); ctx.lineTo(W, H * 0.54); ctx.stroke();
    }
  }

  _paintFaceDecal(state) {
    const ctx = this.faceCtx;
    const S = 512;
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, S, S);

    const pointCol = state.pointColor || '#5D4037';
    const spacingOff = ((state.eyeSpacing ?? 50) - 50) * 0.55;
    const heightOff = ((state.featureHeight ?? 50) - 50) * -0.55;
    const browTilt = ((state.eyebrowTilt ?? 50) - 50) * 0.008;

    const fx = S * 0.5;
    const fy = S * 0.51 + heightOff;
    const eyeDist = 86 + spacingOff;
    const lx = fx - eyeDist;
    const rx = fx + eyeDist;
    const cheekDist = 156 + spacingOff * 0.7;
    const cy = fy + 44;

    // 1. Blush is drawn first so markings and eyes sit cleanly on top
    const blushStyle = state.blushStyle || 'blush_classic';
    if (blushStyle !== 'blush_none') {
      [fx - cheekDist, fx + cheekDist].forEach(cx => {
        if (blushStyle === 'blush_heart') {
          ctx.fillStyle = '#FF7597';
          ctx.beginPath();
          ctx.moveTo(cx, cy + 16);
          ctx.bezierCurveTo(cx - 26, cy - 2, cx - 22, cy - 22, cx, cy - 8);
          ctx.bezierCurveTo(cx + 22, cy - 22, cx + 26, cy - 2, cx, cy + 16);
          ctx.fill();
        } else if (blushStyle === 'blush_star') {
          ctx.fillStyle = '#FFD54F';
          this._drawCanvasStar(ctx, cx, cy, 5, 22, 10);
        } else if (blushStyle === 'blush_sparkle') {
          ctx.fillStyle = '#FABCC8';
          ctx.beginPath(); ctx.ellipse(cx, cy, 38, 20, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFF59D';
          this._drawCanvasStar(ctx, cx, cy, 4, 14, 5);
        } else if (blushStyle === 'blush_flushed') {
          ctx.fillStyle = '#FF5277';
          ctx.beginPath(); ctx.ellipse(cx, cy, 48, 28, 0, 0, Math.PI * 2); ctx.fill();
        } else if (blushStyle === 'blush_stripes') {
          ctx.strokeStyle = '#FF4081';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          [-16, 0, 16].forEach(dx => {
            ctx.beginPath(); ctx.moveTo(cx + dx + 7, cy - 14); ctx.lineTo(cx + dx - 7, cy + 14); ctx.stroke();
          });
        } else if (blushStyle === 'blush_dots') {
          ctx.fillStyle = '#FF6B8B';
          [-14, 0, 14].forEach(dx => {
            ctx.beginPath(); ctx.arc(cx + dx, cy + (dx === 0 ? -4 : 4), 6, 0, Math.PI * 2); ctx.fill();
          });
        } else if (blushStyle === 'blush_cat') {
          ctx.strokeStyle = '#FF6B8B';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          [-12, 0, 12].forEach(dy => {
            ctx.beginPath(); ctx.moveTo(cx - 18, cy + dy); ctx.lineTo(cx + 18, cy + dy); ctx.stroke();
          });
        } else if (blushStyle === 'blush_spiral') {
          ctx.strokeStyle = '#FF4081';
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let theta = 0; theta < Math.PI * 5; theta += 0.1) {
            const r = 2.5 + theta * 3.2;
            const px = cx + r * Math.cos(theta);
            const py = cy + r * Math.sin(theta);
            if (theta === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        } else if (blushStyle === 'blush_flower') {
          ctx.fillStyle = '#FF80AB';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 7.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#FFF59D';
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        } else if (blushStyle === 'blush_rainbow') {
          const rCols = ['#FF5252', '#FFD54F', '#40C4FF'];
          rCols.forEach((col, i) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy + 12, 28 - i * 7, Math.PI * 1.15, Math.PI * 1.85, false);
            ctx.stroke();
          });
        } else {
          ctx.fillStyle = '#FABCC8';
          ctx.beginPath();
          ctx.ellipse(cx, cy, 42, 23, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#4A342E';
          ctx.lineWidth = 6.0;
          ctx.lineCap = 'round';
          [-19, -6.5, 6.5, 19].forEach(dx => {
            ctx.beginPath();
            ctx.moveTo(cx + dx + 4.5, cy - 10);
            ctx.lineTo(cx + dx - 4.5, cy + 10);
            ctx.stroke();
          });
        }
      });
    }

    // 2. Markings
    if (state.marking === 'mark_eyepatch') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(rx, fy, 42, 38, 0, 0, Math.PI * 2); ctx.fill();
    } else if (state.marking === 'mark_raccoon') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(lx, fy, 38, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx, fy, 38, 34, 0, 0, Math.PI * 2); ctx.fill();
    } else if (state.marking === 'mark_star') {
      ctx.fillStyle = pointCol;
      this._drawCanvasStar(ctx, fx, fy - 80, 5, 26, 11);
    } else if (state.marking === 'mark_tiger') {
      ctx.strokeStyle = pointCol;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx - 18, fy - 86); ctx.lineTo(fx - 18, fy - 58); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy - 90); ctx.lineTo(fx, fy - 56); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 18, fy - 86); ctx.lineTo(fx + 18, fy - 58); ctx.stroke();
      [-1, 1].forEach(s => {
        const bx = s === -1 ? lx - 38 : rx + 38;
        ctx.beginPath(); ctx.moveTo(bx, fy + 6); ctx.lineTo(bx + s * 30, fy + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + s * 4, fy + 24); ctx.lineTo(bx + s * 28, fy + 24); ctx.stroke();
      });
    } else if (state.marking === 'mark_maro') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(lx, fy - 42, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx, fy - 42, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else if (state.marking === 'mark_muzzle') {
      ctx.fillStyle = pointCol;
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.ellipse(fx, fy + 26, 46, 28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (state.marking === 'mark_heart') {
      ctx.fillStyle = pointCol;
      this._drawCanvasHeart(ctx, rx + 44, cy - 8, 22);
    } else if (state.marking === 'mark_cross') {
      ctx.fillStyle = '#FFE082';
      ctx.strokeStyle = '#D78B2C';
      ctx.lineWidth = 3;
      ctx.save();
      ctx.translate(rx + 42, fy + 24);
      ctx.rotate(0.35);
      ctx.fillRect(-22, -7, 44, 14); ctx.strokeRect(-22, -7, 44, 14);
      ctx.fillRect(-7, -22, 14, 44); ctx.strokeRect(-7, -22, 14, 44);
      ctx.restore();
    } else if (state.marking === 'mark_whiskers') {
      ctx.strokeStyle = pointCol;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      [-1, 1].forEach(s => {
        const bx = s === -1 ? lx - 46 : rx + 46;
        ctx.beginPath(); ctx.moveTo(bx, fy + 10); ctx.lineTo(bx + s * 34, fy + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, fy + 22); ctx.lineTo(bx + s * 36, fy + 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, fy + 34); ctx.lineTo(bx + s * 34, fy + 42); ctx.stroke();
      });
    } else if (state.marking === 'mark_lightning') {
      ctx.fillStyle = pointCol;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 110);
      ctx.lineTo(fx - 14, fy - 72);
      ctx.lineTo(fx - 3, fy - 70);
      ctx.lineTo(fx - 16, fy - 36);
      ctx.lineTo(fx + 10, fy - 66);
      ctx.lineTo(fx - 1, fy - 68);
      ctx.closePath();
      ctx.fill();
    } else if (state.marking === 'mark_panda') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(lx, fy, 44, 40, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(rx, fy, 44, 40, 0.2, 0, Math.PI * 2); ctx.fill();
    } else if (state.marking === 'mark_spot') {
      ctx.fillStyle = pointCol;
      ctx.beginPath(); ctx.ellipse(lx, fy, 48, 44, -0.15, 0, Math.PI * 2); ctx.fill();
    } else if (state.marking === 'mark_clover') {
      ctx.fillStyle = '#66BB6A';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 11, fy - 80 + Math.sin(a) * 11, 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#43A047'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(fx, fy - 80); ctx.quadraticCurveTo(fx + 6, fy - 64, fx + 2, fy - 56); ctx.stroke();
    } else if (state.marking === 'mark_teardrop') {
      ctx.fillStyle = pointCol;
      ctx.beginPath();
      ctx.moveTo(rx + 10, fy + 26);
      ctx.bezierCurveTo(rx + 2, fy + 38, rx + 2, fy + 46, rx + 10, fy + 46);
      ctx.bezierCurveTo(rx + 18, fy + 46, rx + 18, fy + 38, rx + 10, fy + 26);
      ctx.fill();
    } else if (state.marking === 'mark_freckles') {
      ctx.fillStyle = pointCol;
      [fx - cheekDist, fx + cheekDist].forEach(cx => {
        [-12, 0, 12].forEach((dx, idx) => {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + (idx % 2 === 0 ? -3 : 5), 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    // 3. Eyes, Brows, Mouth & Glasses
    this._drawCanvasEye(ctx, state.eyeStyle, lx, fy, false);
    this._drawCanvasEye(ctx, state.eyeStyle, rx, fy, true);
    this._drawCanvasBrow(ctx, state.eyebrowStyle, state.eyeStyle, lx, fy - 58, -1, browTilt);
    this._drawCanvasBrow(ctx, state.eyebrowStyle, state.eyeStyle, rx, fy - 58, 1, browTilt);
    this._drawCanvasMouth(ctx, state.mouthStyle, state.eyeStyle, fx, fy + 34);
    this._drawCanvasGlasses(ctx, state.glasses, lx, rx, fy);
    ctx.restore();
  }

  _drawCanvasGlasses(ctx, glasses, lx, rx, fy) {
    if (!glasses || glasses === 'glasses_none') return;
    const fx = (lx + rx) / 2;
    ctx.save();
    ctx.strokeStyle = '#3A2E2B';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (glasses === 'glasses_round') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.arc(x, fy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(lx + 46, fy); ctx.lineTo(rx - 46, fy); ctx.stroke();
    } else if (glasses === 'glasses_heart') {
      ctx.fillStyle = 'rgba(240,98,125,0.75)';
      [lx, rx].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, fy + 36);
        ctx.bezierCurveTo(x - 52, fy - 4, x - 44, fy - 44, x, fy - 16);
        ctx.bezierCurveTo(x + 44, fy - 44, x + 52, fy - 4, x, fy + 36);
        ctx.fill(); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(lx + 38, fy - 12); ctx.lineTo(rx - 38, fy - 12); ctx.stroke();
    } else if (glasses === 'glasses_star') {
      ctx.fillStyle = 'rgba(255,213,79,0.82)';
      [lx, rx].forEach(x => {
        this._drawCanvasStar(ctx, x, fy, 5, 52, 24);
        ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(lx + 40, fy - 8); ctx.lineTo(rx - 40, fy - 8); ctx.stroke();
    } else if (glasses === 'glasses_monocle') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(rx, fy, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(rx + 46, fy + 8); ctx.quadraticCurveTo(rx + 66, fy + 55, rx + 50, fy + 95); ctx.stroke();
    } else if (glasses === 'glasses_retro') {
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      [lx, rx].forEach(x => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 44, fy - 36, 88, 72, 10);
        else ctx.rect(x - 44, fy - 36, 88, 72);
        ctx.fill(); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(lx + 44, fy); ctx.lineTo(rx - 44, fy); ctx.stroke();
    } else if (glasses === 'glasses_sunglasses') {
      ctx.fillStyle = '#261C19';
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.ellipse(x, fy + 4, 46, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(lx + 40, fy - 18); ctx.lineTo(rx - 40, fy - 18); ctx.stroke();
    } else if (glasses === 'glasses_pixel') {
      ctx.fillStyle = '#111111';
      [lx, rx].forEach(x => {
        ctx.fillRect(x - 44, fy - 22, 88, 44);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 30, fy - 14, 12, 12);
        ctx.fillRect(x + 10, fy - 2, 12, 12);
        ctx.fillStyle = '#111111';
      });
      ctx.fillRect(lx + 36, fy - 10, rx - lx - 72, 14);
    } else if (glasses === 'glasses_goggles') {
      ctx.fillStyle = 'rgba(129,212,250,0.55)';
      ctx.strokeStyle = '#D78B2C';
      ctx.lineWidth = 11;
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.arc(x, fy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(lx - 46, fy); ctx.lineTo(lx - 76, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + 46, fy); ctx.lineTo(rx + 76, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx + 46, fy); ctx.lineTo(rx - 46, fy); ctx.stroke();
    } else if (glasses === 'glasses_dizzy') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.arc(x, fy, 45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(x, fy, 12 + i * 11, 0, Math.PI * 1.85); ctx.stroke();
        }
      });
      ctx.strokeStyle = '#3A2E2B';
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(lx + 45, fy); ctx.lineTo(rx - 45, fy); ctx.stroke();
    } else if (glasses === 'glasses_half') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 6;
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.arc(x, fy + 8, 42, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(lx + 42, fy + 8); ctx.lineTo(rx - 42, fy + 8); ctx.stroke();
    } else if (glasses === 'glasses_cat') {
      ctx.fillStyle = 'rgba(32, 26, 26, 0.88)';
      ctx.strokeStyle = '#E91E63';
      ctx.lineWidth = 7;
      [lx, rx].forEach((x, idx) => {
        const s = idx === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x - 34 * s, fy + 18);
        ctx.quadraticCurveTo(x + 48 * s, fy + 20, x + 56 * s, fy - 24);
        ctx.quadraticCurveTo(x + 12 * s, fy - 16, x - 34 * s, fy - 8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(lx + 28, fy - 4); ctx.lineTo(rx - 28, fy - 4); ctx.stroke();
    } else if (glasses === 'glasses_sleep') {
      ctx.fillStyle = '#CE93D8';
      ctx.strokeStyle = '#4A3832';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(lx, fy, 48, 38, 0, 0, Math.PI * 2);
      ctx.ellipse(rx, fy, 48, 38, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(lx, fy - 34, rx - lx, 68);
      ctx.beginPath(); ctx.moveTo(lx, fy - 34); ctx.lineTo(rx, fy - 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx, fy + 34); ctx.lineTo(rx, fy + 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx - 46, fy); ctx.lineTo(lx - 74, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + 46, fy); ctx.lineTo(rx + 74, fy); ctx.stroke();
      ctx.strokeStyle = '#5E35B1';
      ctx.lineWidth = 6;
      [lx, rx].forEach(x => {
        ctx.beginPath(); ctx.arc(x, fy - 2, 20, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      });
    }
    ctx.restore();
  }

  _drawCanvasEye(ctx, style, x, y, isRight) {
    const eyeInk = '#56433C';
    ctx.strokeStyle = eyeInk;
    ctx.fillStyle = eyeInk;
    ctx.lineCap = 'round';

    if (style === 'eye_happy' || (style === 'eye_wink' && isRight)) {
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(x, y + 7, 22, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      return;
    }
    if (style === 'eye_dot') {
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (style === 'eye_sleepy') {
      ctx.lineWidth = 8.5;
      ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 3, 17, 0, Math.PI); ctx.fill();
      return;
    }
    if (style === 'eye_crying') {
      ctx.beginPath(); ctx.ellipse(x, y - 2, 28, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(x - 8, y - 10, 11, 9, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#81D4FA';
      ctx.beginPath(); ctx.arc(x, y + 4, 22, Math.PI * 0.08, Math.PI * 0.92); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4FC3F7';
      ctx.beginPath(); ctx.arc(x + (isRight ? 16 : -16), y + 26, 6.5, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (style === 'eye_dizzy') {
      ctx.strokeStyle = eyeInk;
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let theta = 0; theta < Math.PI * 6.5; theta += 0.08) {
        const r = 2.5 + theta * 3.6;
        const px = x + r * Math.cos(theta);
        const py = y + r * Math.sin(theta);
        if (theta === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      return;
    }
    if (style === 'eye_heart') {
      ctx.fillStyle = '#F0627D';
      ctx.beginPath();
      ctx.moveTo(x, y + 18);
      ctx.bezierCurveTo(x - 26, y - 4, x - 22, y - 24, x, y - 8);
      ctx.bezierCurveTo(x + 22, y - 24, x + 26, y - 4, x, y + 18);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x - 6, y - 8, 4, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (style === 'eye_angry') {
      ctx.save();
      ctx.beginPath();
      if (!isRight) {
        ctx.moveTo(x - 26, y - 10);
        ctx.lineTo(x + 24, y + 6);
        ctx.arc(x, y + 8, 20, 0.1, Math.PI - 0.1, false);
      } else {
        ctx.moveTo(x - 24, y + 6);
        ctx.lineTo(x + 26, y - 10);
        ctx.arc(x, y + 8, 20, 0.1, Math.PI - 0.1, false);
      }
      ctx.closePath();
      ctx.fillStyle = eyeInk;
      ctx.fill();
      ctx.strokeStyle = eyeInk;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x - 4, y + 8, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    if (style === 'eye_cross') {
      ctx.strokeStyle = eyeInk;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 16); ctx.lineTo(x + 16, y + 16);
      ctx.moveTo(x + 16, y - 16); ctx.lineTo(x - 16, y + 16);
      ctx.stroke();
      return;
    }
    if (style === 'eye_squint') {
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(x, y + 4, 20, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + (isRight ? 16 : -16), y); ctx.lineTo(x + (isRight ? 24 : -24), y - 4); ctx.stroke();
      return;
    }
    if (style === 'eye_sparkle_big') {
      ctx.beginPath(); ctx.ellipse(x, y, 31, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(x - 8, y - 10, 13, 11, -0.2, 0, Math.PI * 2); ctx.fill();
      this._drawCanvasStar(ctx, x + 10, y - 9, 4, 8, 2.5);
      this._drawCanvasStar(ctx, x - 8, y + 10, 4, 6, 2);
      ctx.beginPath(); ctx.arc(x + 10, y + 8, 5, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (style === 'eye_glance') {
      ctx.beginPath(); ctx.ellipse(x, y, 28, 30, 0, 0, Math.PI * 2); ctx.fill();
      const lookOffset = 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x + lookOffset, y - 6, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#EAE6DF';
      ctx.beginPath(); ctx.arc(x + lookOffset - 2, y + 8, 7, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (style === 'eye_calm') {
      ctx.lineWidth = 8.5;
      ctx.beginPath(); ctx.moveTo(x - 24, y - 6); ctx.lineTo(x + 24, y - 6); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 6, 20, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(x - 5, y + 2, 4.5, 0, Math.PI * 2); ctx.fill();
      return;
    }

    const rx = style === 'eye_sparkle' ? 30 : 28;
    const ry = style === 'eye_sparkle' ? 33 : 31;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'eye_star') {
      ctx.fillStyle = '#FFF59D';
      this._drawCanvasStar(ctx, x, y, 5, 16, 6.5);
      return;
    }

    if (style === 'eye_sparkle') {
      // Big multi-highlight sparkling anime eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(x - 7, y - 9, 12, 10, -0.25, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 9, y + 7, 5.5, 0, Math.PI * 2); ctx.fill();
      this._drawCanvasStar(ctx, x + 10, y - 10, 4, 6.5, 2);
      ctx.fillStyle = '#EAE6DF';
      ctx.beginPath();
      ctx.arc(x, y + 5, 21, Math.PI * 0.14, Math.PI * 0.86);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (style === 'eye_tear') {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(x - 6, y - 8, 9.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#D8F3FF';
      ctx.beginPath();
      ctx.arc(x, y + 3, 22, Math.PI * 0.05, Math.PI * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(x + 6, y + 11, 5.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }

    // Basic eye (eye_round): upper white highlight + soft warm-white lower crescent
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x, y - 7, 11, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#EAE6DF';
    ctx.beginPath();
    ctx.arc(x, y + 4, 20, Math.PI * 0.12, Math.PI * 0.88);
    ctx.closePath();
    ctx.fill();
  }

  _drawCanvasBrow(ctx, style, eyeStyle, x, y, dir, tilt) {
    let eff = style;
    if (style === 'brow_follow') {
      if (eyeStyle === 'eye_happy' || eyeStyle === 'eye_sparkle') eff = 'brow_smile';
      else if (eyeStyle === 'eye_tear') eff = 'brow_droop';
      else eff = 'brow_short';
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dir * tilt);
    ctx.strokeStyle = this.outlineHex;
    ctx.lineWidth = eff === 'brow_thick' ? 9 : 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (eff === 'brow_smile') {
      ctx.moveTo(-15, 4); ctx.quadraticCurveTo(0, -10, 15, 4);
    } else if (eff === 'brow_droop') {
      ctx.moveTo(-15, -4 * dir); ctx.lineTo(15, 6 * dir);
    } else if (eff === 'brow_angry') {
      ctx.moveTo(-15, 6 * dir); ctx.lineTo(15, -6 * dir);
    } else {
      ctx.moveTo(-15, 0); ctx.quadraticCurveTo(0, -5, 15, 0);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawCanvasMouth(ctx, style, eyeStyle, x, y) {
    let eff = style;
    if (style === 'mouth_follow') {
      eff = (eyeStyle === 'eye_happy' || eyeStyle === 'eye_star') ? 'mouth_open' : 'mouth_cat';
    }
    ctx.strokeStyle = this.outlineHex;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (eff === 'mouth_open') {
      ctx.fillStyle = '#F0627D';
      ctx.beginPath();
      ctx.moveTo(x - 22, y - 4);
      ctx.quadraticCurveTo(x, y + 38, x + 22, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (eff === 'mouth_small') {
      ctx.beginPath(); ctx.moveTo(x - 13, y + 8); ctx.quadraticCurveTo(x, y - 7, x + 13, y + 8); ctx.stroke();
      return;
    }
    if (eff === 'mouth_dot') {
      ctx.fillStyle = '#F0627D';
      ctx.beginPath(); ctx.arc(x, y + 7, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      return;
    }
    if (eff === 'mouth_wavy') {
      ctx.beginPath();
      ctx.moveTo(x - 18, y + 4);
      ctx.quadraticCurveTo(x - 9, y - 5, x, y + 4);
      ctx.quadraticCurveTo(x + 9, y + 13, x + 18, y + 4);
      ctx.stroke();
      return;
    }

    if (eff === 'mouth_fang') {
      ctx.beginPath();
      ctx.moveTo(x - 17, y);
      ctx.quadraticCurveTo(x - 8.5, y + 13, x, y - 1);
      ctx.quadraticCurveTo(x + 8.5, y + 13, x + 17, y);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = this.outlineHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 6);
      ctx.lineTo(x - 4, y + 18);
      ctx.lineTo(x, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (eff === 'mouth_surprised') {
      ctx.fillStyle = '#F0627D';
      ctx.beginPath(); ctx.ellipse(x, y + 8, 11, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      return;
    }
    if (eff === 'mouth_cry') {
      ctx.beginPath();
      ctx.moveTo(x - 18, y + 14);
      ctx.quadraticCurveTo(x - 9, y + 2, x, y + 10);
      ctx.quadraticCurveTo(x + 9, y + 2, x + 18, y + 14);
      ctx.stroke();
      return;
    }
    if (eff === 'mouth_smirk') {
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 12);
      ctx.quadraticCurveTo(x - 2, y + 10, x + 16, y - 2);
      ctx.stroke();
      return;
    }
    if (eff === 'mouth_tongue') {
      ctx.beginPath(); ctx.moveTo(x - 16, y + 4); ctx.quadraticCurveTo(x, y - 3, x + 16, y + 4); ctx.stroke();
      ctx.fillStyle = '#FF7597';
      ctx.beginPath();
      ctx.arc(x + 2, y + 14, 10, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (eff === 'mouth_open_smile') {
      ctx.fillStyle = '#F0627D';
      ctx.beginPath();
      ctx.arc(x, y + 6, 20, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFA4B8';
      ctx.beginPath();
      ctx.arc(x, y + 18, 12, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();
      return;
    }
    if (eff === 'mouth_triangle') {
      ctx.fillStyle = '#F0627D';
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 14);
      ctx.lineTo(x, y - 3);
      ctx.lineTo(x + 16, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (eff === 'mouth_flat') {
      ctx.beginPath(); ctx.moveTo(x - 14, y + 8); ctx.lineTo(x + 14, y + 8); ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x - 17, y);
    ctx.quadraticCurveTo(x - 8.5, y + 13, x, y - 1);
    ctx.quadraticCurveTo(x + 8.5, y + 13, x + 17, y);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y + 19);
    ctx.lineTo(x + 4.5, y + 19);
    ctx.stroke();
  }

  _drawCanvasHeart(ctx, cx, cy, size) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.8);
    ctx.bezierCurveTo(cx - size * 1.1, cy, cx - size * 0.9, cy - size * 0.9, cx, cy - size * 0.3);
    ctx.bezierCurveTo(cx + size * 0.9, cy - size * 0.9, cx + size * 1.1, cy, cx, cy + size * 0.8);
    ctx.fill();
  }

  _drawCanvasStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (!this.renderer || !this.scene || !this.camera) return;

    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    if (Math.abs(this.targetZoom - this.camera.zoom) > 0.001) {
      this.camera.zoom += (this.targetZoom - this.camera.zoom) * 0.14;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.y += (this.targetCamY - this.camera.position.y) * 0.14;

    if (this.charRoot) {
      const targetRad = -(this.currentAngle * Math.PI) / 180;
      this.charRoot.rotation.y = targetRad;

      let bounceY = Math.sin(elapsed * 2.5) * 0.02;
      let sx = 1, sy = 1;

      if (this.bounceTime >= 0) {
        this.bounceTime += dt;
        const t = this.bounceTime / 0.42;
        if (t >= 1) {
          this.bounceTime = -1;
        } else {
          const squash = Math.sin(t * Math.PI * 2) * (1 - t) * 0.14;
          sx = 1 + squash;
          sy = 1 - squash;
          const bounceAmp = this.targetZoom > 1.3 ? 0.08 : 0.18;
          bounceY += Math.sin(t * Math.PI) * bounceAmp;
        }
      }

      this.charRoot.position.y = -0.22 + bounceY;
      this.charRoot.scale.set(sx, sy, sx);
    }

    this.renderer.render(this.scene, this.camera);
  }

  renderThumbnail(baseState, overrides = {}, viewAngle = 0, focusKey = null) {
    return this.buildSVG({ ...baseState, ...overrides, rotationAngle: viewAngle }, focusKey);
  }

  buildSVG(state, focusKey = null) {
    const angle = ((state.rotationAngle || 0) % 360 + 360) % 360;
    const isBack = Math.cos((angle * Math.PI) / 180) < -0.15;
    const shapeDef = GAME_DATA.body.shapes.find(s => s.id === state.shape) || GAME_DATA.body.shapes[1];
    const bodyCol = state.bodyColor === '#FFFFFF' ? '#FCFBF4' : (state.bodyColor || '#FCFBF4');
    const pointCol = state.pointColor || '#5D4037';
    const earCol = state.earUsePoint ? pointCol : bodyCol;
    const tailCol = state.tailUsePoint ? pointCol : bodyCol;
    const ink = '#4A3832';
    const eyeInk = '#56433C';

    let viewBox = '15 20 170 185';
    let aspect = 'xMidYMid meet';
    if (focusKey === 'eyeStyle' || focusKey === 'eyebrowStyle' || focusKey === 'mouthStyle' || focusKey === 'marking') {
      viewBox = '30 54 140 104';
      aspect = 'xMidYMax meet';
    } else if (focusKey === 'earType' || focusKey === 'headAccessory' || focusKey === 'hairType') {
      viewBox = '20 6 160 154';
      aspect = 'xMidYMax meet';
    } else if (focusKey === 'neckBag') {
      viewBox = '24 52 152 144';
      aspect = 'xMidYMax meet';
    }

    const bodyPath = `
      M 100,59
      C 128,59 148,70 157,86
      C 165,98 165,112 163,125
      C 158,137 153,145 149,150
      C 157,155 158,162 147,164
      C 143,174 138,184 115,189
      L 115,195 C 115,198 108,198 108,195 L 108,190
      C 103,191 97,191 92,190
      L 92,195 C 92,198 85,198 85,195 L 85,189
      C 62,184 57,174 53,164
      C 42,162 43,155 50,150
      C 46,145 42,137 37,125
      C 35,112 35,98 43,86
      C 52,70 72,59 100,59 Z
    `;

    // Body Patterns
    let bodyPatSvg = '';
    if (state.pattern === 'pat_belly') {
      bodyPatSvg = isBack ? '' : `<ellipse cx="100" cy="166" rx="22" ry="18" fill="${pointCol}" />`;
    } else if (state.pattern === 'pat_bib') {
      bodyPatSvg = isBack ? '' : `<ellipse cx="100" cy="148" rx="19" ry="13" fill="${pointCol}" />`;
    } else if (state.pattern === 'pat_heart') {
      bodyPatSvg = isBack ? '' : `<path d="M100,172 C88,162 84,152 91,148 C96,146 100,151 100,153 C100,151 104,146 109,148 C116,152 112,162 100,172 Z" fill="${pointCol}" />`;
    } else if (state.pattern === 'pat_stripes') {
      bodyPatSvg = `<path d="M52,150 H68 M132,150 H148 M56,162 H74 M126,162 H144" stroke="${pointCol}" stroke-width="5" stroke-linecap="round" />`;
    } else if (state.pattern === 'pat_spots') {
      bodyPatSvg = `<ellipse cx="76" cy="154" rx="11" ry="8" fill="${pointCol}" /><ellipse cx="126" cy="164" rx="12" ry="9" fill="${pointCol}" /><ellipse cx="124" cy="84" rx="9" ry="7" fill="${pointCol}" />`;
    } else if (state.pattern === 'pat_back') {
      bodyPatSvg = isBack ? `<ellipse cx="100" cy="148" rx="26" ry="22" fill="${pointCol}" />` : '';
    } else if (state.pattern === 'pat_pants') {
      bodyPatSvg = `<path d="M54,164 Q100,168 146,164 C142,176 135,184 115,189 L115,196 L108,196 L108,190 Q100,191 92,190 L92,196 L85,196 L85,189 C65,184 58,176 54,164 Z" fill="${pointCol}" stroke="${ink}" stroke-width="2.2" />`;
    } else if (state.pattern === 'pat_gloves') {
      bodyPatSvg = `<ellipse cx="47" cy="157" rx="7" ry="5" fill="${pointCol}" stroke="${ink}" stroke-width="2" /><ellipse cx="153" cy="157" rx="7" ry="5" fill="${pointCol}" stroke="${ink}" stroke-width="2" /><rect x="85" y="188" width="7" height="9" rx="3" fill="${pointCol}" /><rect x="108" y="188" width="7" height="9" rx="3" fill="${pointCol}" />`;
    }

    // Half-face marking
    const halfMark = (!isBack && state.marking === 'mark_half')
      ? `<path d="M100,59 C128,59 148,70 157,86 C165,98 165,112 163,125 C158,137 153,145 149,150 C157,155 158,162 147,164 C143,174 138,184 115,189 L115,195 C115,198 108,198 108,195 L108,190 L100,190 Z" fill="${pointCol}" />`
      : '';

    // Ears
    const earMap = {
      ear_none: '',
      ear_round: `<circle cx="62" cy="64" r="10" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="138" cy="64" r="10" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_small: `<circle cx="64" cy="65" r="7.5" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="136" cy="65" r="7.5" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_bear: `<circle cx="58" cy="62" r="13" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="58" cy="62" r="6.5" fill="#FFBAC4" /><circle cx="142" cy="62" r="13" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="142" cy="62" r="6.5" fill="#FFBAC4" />`,
      ear_big: `<circle cx="54" cy="59" r="17" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="146" cy="59" r="17" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_cat: `<polygon points="56,74 58,42 82,63" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" /><polygon points="144,74 142,42 118,63" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" />`,
      ear_rabbit: `<ellipse cx="74" cy="36" rx="10" ry="26" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><ellipse cx="126" cy="36" rx="10" ry="26" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_lop: `<ellipse cx="44" cy="88" rx="10" ry="24" transform="rotate(18 44 88)" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><ellipse cx="156" cy="88" rx="10" ry="24" transform="rotate(-18 156 88)" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_puppy: `<ellipse cx="43" cy="84" rx="11" ry="20" transform="rotate(14 43 84)" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><ellipse cx="157" cy="84" rx="11" ry="20" transform="rotate(-14 157 84)" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_momonga: `<ellipse cx="46" cy="64" rx="14" ry="13" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><ellipse cx="154" cy="64" rx="14" ry="13" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_folded: `<path d="M56,66 L44,54 L68,58 Z" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" /><path d="M144,66 L156,54 L132,58 Z" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" />`,
      ear_ram: `<path d="M52,66 C32,62 32,88 48,86" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round" /><path d="M52,66 C32,62 32,88 48,86" fill="none" stroke="${earCol}" stroke-width="6.5" stroke-linecap="round" /><path d="M148,66 C168,62 168,88 152,86" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round" /><path d="M148,66 C168,62 168,88 152,86" fill="none" stroke="${earCol}" stroke-width="6.5" stroke-linecap="round" />`,
      ear_side: `<circle cx="38" cy="100" r="10" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="162" cy="100" r="10" fill="${earCol}" stroke="${ink}" stroke-width="3.2" />`,
      ear_antenna: `<path d="M76,60 Q72,38 66,32" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" /><circle cx="65" cy="31" r="6" fill="${earCol}" stroke="${ink}" stroke-width="2.8" /><path d="M124,60 Q128,38 134,32" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" /><circle cx="135" cy="31" r="6" fill="${earCol}" stroke="${ink}" stroke-width="2.8" />`,
      ear_fin: `<polygon points="44,80 26,96 46,104" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" /><polygon points="156,80 174,96 154,104" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" />`,
      ear_leaf: `<ellipse cx="62" cy="56" rx="13" ry="7.5" transform="rotate(-30 62 56)" fill="#81C784" stroke="${ink}" stroke-width="3" /><ellipse cx="138" cy="56" rx="13" ry="7.5" transform="rotate(30 138 56)" fill="#81C784" stroke="${ink}" stroke-width="3" />`,
      ear_devil: `<path d="M68,62 Q66,40 56,36 Q66,48 76,58 Z" fill="${earCol}" stroke="${ink}" stroke-width="3" stroke-linejoin="round" /><path d="M132,62 Q134,40 144,36 Q134,48 124,58 Z" fill="${earCol}" stroke="${ink}" stroke-width="3" stroke-linejoin="round" />`,
      ear_curled: `<path d="M52,70 C34,60 30,86 46,88 C54,89 58,82 54,74 C50,68 40,72 44,78" fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round" /><path d="M52,70 C34,60 30,86 46,88 C54,89 58,82 54,74 C50,68 40,72 44,78" fill="none" stroke="${earCol}" stroke-width="6" stroke-linecap="round" /><path d="M148,70 C166,60 170,86 154,88 C146,89 142,82 146,74 C150,68 160,72 156,78" fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round" /><path d="M148,70 C166,60 170,86 154,88 C146,89 142,82 146,74 C150,68 160,72 156,78" fill="none" stroke="${earCol}" stroke-width="6" stroke-linecap="round" />`,
      ear_dragon: `<path d="M48,88 L26,74 L38,88 L24,96 L42,102 L28,110 L48,112 Z" fill="${earCol}" stroke="${ink}" stroke-width="3" stroke-linejoin="round" /><path d="M152,88 L174,74 L162,88 L176,96 L158,102 L172,110 L152,112 Z" fill="${earCol}" stroke="${ink}" stroke-width="3" stroke-linejoin="round" />`,
      ear_bunny_droop: `<ellipse cx="40" cy="110" rx="9" ry="32" transform="rotate(10 40 110)" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><ellipse cx="40" cy="110" rx="4.5" ry="24" transform="rotate(10 40 110)" fill="#FFBAC4" /><ellipse cx="160" cy="110" rx="9" ry="32" transform="rotate(-10 160 110)" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><ellipse cx="160" cy="110" rx="4.5" ry="24" transform="rotate(-10 160 110)" fill="#FFBAC4" />`,
      ear_mouse: `<circle cx="48" cy="54" r="18" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="48" cy="54" r="11" fill="#FFBAC4" /><circle cx="152" cy="54" r="18" fill="${earCol}" stroke="${ink}" stroke-width="3.2" /><circle cx="152" cy="54" r="11" fill="#FFBAC4" />`,
      ear_deer: `<path d="M64,62 C62,44 54,30 46,18 M56,40 C44,38 38,44 36,46 M52,28 C42,24 40,16 40,14" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" /><path d="M64,62 C62,44 54,30 46,18 M56,40 C44,38 38,44 36,46 M52,28 C42,24 40,16 40,14" fill="none" stroke="${earCol}" stroke-width="3.6" stroke-linecap="round" /><path d="M136,62 C138,44 146,30 154,18 M144,40 C156,38 162,44 164,46 M148,28 C158,24 160,16 160,14" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" /><path d="M136,62 C138,44 146,30 154,18 M144,40 C156,38 162,44 164,46 M148,28 C158,24 160,16 160,14" fill="none" stroke="${earCol}" stroke-width="3.6" stroke-linecap="round" />`,
      ear_pointed: `<polygon points="46,88 16,84 44,102" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" /><polygon points="44,89 25,86 42,98" fill="#FFBAC4" /><polygon points="154,88 184,84 156,102" fill="${earCol}" stroke="${ink}" stroke-width="3.2" stroke-linejoin="round" /><polygon points="156,89 175,86 158,98" fill="#FFBAC4" />`,
      ear_fluffy_top: `<g fill="${earCol}" stroke="${ink}" stroke-width="2.8"><circle cx="54" cy="62" r="9" /><circle cx="66" cy="54" r="11" /><circle cx="78" cy="60" r="9" /><circle cx="146" cy="62" r="9" /><circle cx="134" cy="54" r="11" /><circle cx="122" cy="60" r="9" /></g>`
    };
    const ears = earMap[state.earType] !== undefined ? earMap[state.earType] : earMap.ear_round;

    // Hair disabled
    const hairSvg = '';

    // Head Accessories
    let accSvg = '';
    if (state.headAccessory === 'acc_ribbon') {
      accSvg = `<g transform="translate(124,62) rotate(18)"><polygon points="-14,-8 0,0 -14,8" fill="#F0627D" stroke="${ink}" stroke-width="2.5" /><polygon points="14,-8 0,0 14,8" fill="#F0627D" stroke="${ink}" stroke-width="2.5" /><circle cx="0" cy="0" r="4" fill="#F0627D" stroke="${ink}" stroke-width="2.2" /></g>`;
    } else if (state.headAccessory === 'acc_beret') {
      accSvg = `<ellipse cx="100" cy="55" rx="30" ry="13" fill="#F0627D" stroke="${ink}" stroke-width="3" /><line x1="100" y1="42" x2="100" y2="36" stroke="${ink}" stroke-width="3" stroke-linecap="round" />`;
    } else if (state.headAccessory === 'acc_flower') {
      accSvg = `<g transform="translate(124,62)"><circle cx="0" cy="-6" r="5" fill="#FFBAC4" stroke="${ink}" stroke-width="2" /><circle cx="6" cy="-2" r="5" fill="#FFBAC4" stroke="${ink}" stroke-width="2" /><circle cx="4" cy="5" r="5" fill="#FFBAC4" stroke="${ink}" stroke-width="2" /><circle cx="-4" cy="5" r="5" fill="#FFBAC4" stroke="${ink}" stroke-width="2" /><circle cx="-6" cy="-2" r="5" fill="#FFBAC4" stroke="${ink}" stroke-width="2" /><circle cx="0" cy="0" r="4" fill="#FCE373" stroke="${ink}" stroke-width="1.8" /></g>`;
    } else if (state.headAccessory === 'acc_crown') {
      accSvg = `<polygon points="82,59 84,41 93,50 100,38 107,50 116,41 118,59" fill="#FFD54F" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round" />`;
    } else if (state.headAccessory === 'acc_sprout') {
      accSvg = `<path d="M100,59 Q100,44 100,42" stroke="${ink}" stroke-width="3" stroke-linecap="round" /><ellipse cx="91" cy="40" rx="8.5" ry="5" transform="rotate(-25 91 40)" fill="#81C784" stroke="${ink}" stroke-width="2.4" /><ellipse cx="109" cy="40" rx="8.5" ry="5" transform="rotate(25 109 40)" fill="#81C784" stroke="${ink}" stroke-width="2.4" />`;
    } else if (state.headAccessory === 'acc_star') {
      accSvg = `<polygon points="122,47 125,54 133,55 127,60 129,68 122,64 115,68 117,60 111,55 119,54" fill="#FFD54F" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round" />`;
    } else if (state.headAccessory === 'acc_halo') {
      accSvg = `<ellipse cx="100" cy="40" rx="22" ry="6" fill="none" stroke="${ink}" stroke-width="5" /><ellipse cx="100" cy="40" rx="22" ry="6" fill="none" stroke="#FFE066" stroke-width="2.6" />`;
    } else if (state.headAccessory === 'acc_horns') {
      accSvg = `<polygon points="72,62 66,42 82,58" fill="#E53935" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" /><polygon points="128,62 134,42 118,58" fill="#E53935" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" />`;
    } else if (state.headAccessory === 'acc_beanie') {
      accSvg = `<path d="M68,62 A32,26 0 0 1 132,62 Z" fill="#FF8A65" stroke="${ink}" stroke-width="2.6" /><rect x="66" y="57" width="68" height="8" rx="4" fill="#FFAB91" stroke="${ink}" stroke-width="2.2" /><circle cx="100" cy="34" r="6" fill="#FFFFFF" stroke="${ink}" stroke-width="2.2" />`;
    } else if (state.headAccessory === 'acc_strawhat') {
      accSvg = `<ellipse cx="100" cy="58" rx="42" ry="9" fill="#F5D782" stroke="${ink}" stroke-width="2.5" /><path d="M76,56 L80,38 L120,38 L124,56 Z" fill="#F5D782" stroke="${ink}" stroke-width="2.5" /><rect x="77" y="50" width="46" height="5" fill="#E53935" />`;
    } else if (state.headAccessory === 'acc_witch') {
      accSvg = `<ellipse cx="100" cy="58" rx="40" ry="8" fill="#5E35B1" stroke="${ink}" stroke-width="2.5" /><polygon points="78,56 100,24 122,56" fill="#5E35B1" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" /><rect x="81" y="51" width="38" height="4" fill="#FFD54F" />`;
    } else if (state.headAccessory === 'acc_headphones') {
      accSvg = `<path d="M38,104 A62,62 0 0 1 162,104" fill="none" stroke="#455A64" stroke-width="5" /><rect x="28" y="96" width="12" height="22" rx="6" fill="#F0627D" stroke="${ink}" stroke-width="2.4" /><rect x="160" y="96" width="12" height="22" rx="6" fill="#F0627D" stroke="${ink}" stroke-width="2.4" />`;
    } else if (state.headAccessory === 'acc_heartpin') {
      accSvg = `<path d="M124,68 C117,61 116,54 121,52 C123,51 124,54 124,54 C124,54 125,51 127,52 C132,54 131,61 124,68 Z" fill="#FF4081" stroke="${ink}" stroke-width="2.2" />`;
    } else if (state.headAccessory === 'acc_bandaid') {
      accSvg = `<rect x="64" y="68" width="18" height="7" rx="3" transform="rotate(-20 73 71)" fill="#FFE0B2" stroke="${ink}" stroke-width="2" />`;
    }

    // Tails (back view or side view, all 15 distinct)
    let tailSvg = '';
    if (state.tailType && state.tailType !== 'tail_none') {
      const tx = isBack ? 100 : 154;
      const ty = isBack ? 166 : 168;
      if (state.tailType === 'tail_fluffy') {
        tailSvg = `<circle cx="${tx}" cy="${ty}" r="11" fill="${tailCol}" stroke="${ink}" stroke-width="3" />`;
      } else if (state.tailType === 'tail_short') {
        tailSvg = `<ellipse cx="${tx}" cy="${ty + 2}" rx="7" ry="6" fill="${tailCol}" stroke="${ink}" stroke-width="2.8" />`;
      } else if (state.tailType === 'tail_cat') {
        tailSvg = `<path d="M${tx},168 Q${tx - 40},158 ${tx - 34},122" fill="none" stroke="${ink}" stroke-width="8.5" stroke-linecap="round" /><path d="M${tx},168 Q${tx - 40},158 ${tx - 34},122" fill="none" stroke="${tailCol}" stroke-width="4.2" stroke-linecap="round" />`;
      } else if (state.tailType === 'tail_swirl') {
        tailSvg = `<path d="M${tx},168 C${tx - 10},168 ${tx - 12},154 ${tx - 2},154 C${tx + 6},154 ${tx + 4},164 ${tx - 4},162" fill="none" stroke="${ink}" stroke-width="6.5" stroke-linecap="round" /><path d="M${tx},168 C${tx - 10},168 ${tx - 12},154 ${tx - 2},154 C${tx + 6},154 ${tx + 4},164 ${tx - 4},162" fill="none" stroke="${tailCol}" stroke-width="3" stroke-linecap="round" />`;
      } else if (state.tailType === 'tail_bushy') {
        tailSvg = `<ellipse cx="${tx + 12}" cy="154" rx="18" ry="22" transform="rotate(20 ${tx + 12} 154)" fill="${tailCol}" stroke="${ink}" stroke-width="3" />`;
      } else if (state.tailType === 'tail_fox') {
        tailSvg = `<ellipse cx="${tx + 14}" cy="156" rx="16" ry="20" transform="rotate(26 ${tx + 14} 156)" fill="${tailCol}" stroke="${ink}" stroke-width="3" /><circle cx="${tx + 22}" cy="138" r="6" fill="#FFFFFF" />`;
      } else if (state.tailType === 'tail_dragon') {
        tailSvg = `<path d="M${tx},170 Q${tx - 20},160 ${tx - 22},136 L${tx - 14},142 Z" fill="${tailCol}" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round" />`;
      } else if (state.tailType === 'tail_lion') {
        tailSvg = `<path d="M${tx},168 Q${tx + 20},158 ${tx + 16},134" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" /><ellipse cx="${tx + 16}" cy="131" rx="6" ry="7" fill="${pointCol}" stroke="${ink}" stroke-width="2.4" />`;
      } else if (state.tailType === 'tail_heart') {
        tailSvg = `<path d="M${tx},168 Q${tx - 14},156 ${tx - 16},144" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" /><path d="M${tx - 16},146 C${tx - 24},139 ${tx - 24},131 ${tx - 19},129 C${tx - 16},128 ${tx - 16},132 ${tx - 16},132 C${tx - 16},132 ${tx - 16},128 ${tx - 13},129 C${tx - 8},131 ${tx - 8},139 ${tx - 16},146 Z" fill="#F0627D" stroke="${ink}" stroke-width="2.2" />`;
      } else if (state.tailType === 'tail_star') {
        tailSvg = `<path d="M${tx},168 Q${tx - 14},156 ${tx - 16},144" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" /><polygon points="${tx - 16},128 ${tx - 13},135 ${tx - 6},136 ${tx - 11},141 ${tx - 10},148 ${tx - 16},144 ${tx - 22},148 ${tx - 21},141 ${tx - 26},136 ${tx - 19},135" fill="#FFD54F" stroke="${ink}" stroke-width="2.2" />`;
      } else if (state.tailType === 'tail_devil') {
        tailSvg = `<path d="M${tx},168 Q${tx + 18},158 ${tx + 16},138" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" /><polygon points="${tx + 16},128 ${tx + 22},140 ${tx + 10},140" fill="${pointCol}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round" />`;
      } else if (state.tailType === 'tail_fish') {
        tailSvg = `<path d="M${tx},166 L${tx - 22},154 L${tx - 18},166 L${tx - 22},178 Z" fill="${tailCol}" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round" />`;
      } else if (state.tailType === 'tail_beaver') {
        tailSvg = `<ellipse cx="${tx}" cy="174" rx="14" ry="9" fill="${pointCol}" stroke="${ink}" stroke-width="2.8" />`;
      } else if (state.tailType === 'tail_sprout') {
        tailSvg = `<path d="M${tx},168 Q${tx},152 ${tx},148" stroke="${ink}" stroke-width="3" stroke-linecap="round" /><ellipse cx="${tx - 7}" cy="147" rx="7" ry="4" transform="rotate(-25 ${tx - 7} 147)" fill="#81C784" stroke="${ink}" stroke-width="2.2" /><ellipse cx="${tx + 7}" cy="147" rx="7" ry="4" transform="rotate(25 ${tx + 7} 147)" fill="#81C784" stroke="${ink}" stroke-width="2.2" />`;
      }
    }

    // Neck / Bag items
    let neckSvg = '';
    if (state.neckBag === 'neck_towel') {
      neckSvg = `<path d="M62,146 Q100,162 138,146 L134,160 Q100,174 66,160 Z" fill="#FFFFFF" stroke="${ink}" stroke-width="2.6" />`;
    } else if (state.neckBag === 'neck_cape') {
      neckSvg = `<path d="M58,148 Q100,162 142,148 L152,182 Q100,192 48,182 Z" fill="#F48FB1" stroke="${ink}" stroke-width="2.8" />`;
    } else if (state.neckBag === 'neck_scarf') {
      neckSvg = `<path d="M60,148 Q100,164 140,148 L136,162 Q100,176 64,162 Z" fill="#5D4037" stroke="${ink}" stroke-width="2.6" /><rect x="112" y="156" width="14" height="24" rx="4" fill="#5D4037" stroke="${ink}" stroke-width="2.6" />`;
    } else if (state.neckBag === 'neck_bell') {
      neckSvg = `<path d="M60,148 Q100,164 140,148" fill="none" stroke="#E53935" stroke-width="5.5" stroke-linecap="round" /><circle cx="100" cy="159" r="7" fill="#FFD54F" stroke="${ink}" stroke-width="2.5" />`;
    } else if (state.neckBag === 'neck_bowtie') {
      neckSvg = `<g transform="translate(100,152)"><polygon points="-14,-7 0,0 -14,7" fill="#5D4037" stroke="${ink}" stroke-width="2.4" /><polygon points="14,-7 0,0 14,7" fill="#5D4037" stroke="${ink}" stroke-width="2.4" /><circle cx="0" cy="0" r="3.5" fill="#5D4037" stroke="${ink}" stroke-width="2" /></g>`;
    } else if (state.neckBag === 'neck_pochette') {
      neckSvg = `<line x1="62" y1="146" x2="132" y2="174" stroke="${ink}" stroke-width="3" /><ellipse cx="136" cy="176" rx="11" ry="9" fill="#F48FB1" stroke="${ink}" stroke-width="2.6" />`;
    } else if (state.neckBag === 'neck_overalls') {
      neckSvg = `<path d="M60,154 H140 L144,184 Q100,192 56,184 Z" fill="#64B5F6" stroke="${ink}" stroke-width="2.6" /><line x1="74" y1="142" x2="74" y2="156" stroke="#64B5F6" stroke-width="6" /><line x1="126" y1="142" x2="126" y2="156" stroke="#64B5F6" stroke-width="6" />`;
    } else if (state.neckBag === 'neck_hoodie') {
      neckSvg = `<path d="M56,148 Q100,162 144,148 L148,184 Q100,192 52,184 Z" fill="#F8BBD0" stroke="${ink}" stroke-width="2.6" /><path d="M62,146 Q100,160 138,146" fill="none" stroke="#F48FB1" stroke-width="6" stroke-linecap="round" />`;
    } else if (state.neckBag === 'neck_apron') {
      neckSvg = `<rect x="66" y="152" width="68" height="34" rx="4" fill="#FFFFFF" stroke="${ink}" stroke-width="2.5" /><path d="M60,150 Q100,162 140,150" fill="none" stroke="#F0627D" stroke-width="4" />`;
    } else if (state.neckBag === 'neck_lei') {
      neckSvg = `<circle cx="68" cy="152" r="6" fill="#FF8A80" stroke="${ink}" stroke-width="1.8" /><circle cx="84" cy="156" r="6" fill="#FFD180" stroke="${ink}" stroke-width="1.8" /><circle cx="100" cy="158" r="6" fill="#FFFF8D" stroke="${ink}" stroke-width="1.8" /><circle cx="116" cy="156" r="6" fill="#A7FFEB" stroke="${ink}" stroke-width="1.8" /><circle cx="132" cy="152" r="6" fill="#FF80AB" stroke="${ink}" stroke-width="1.8" />`;
    } else if (state.neckBag === 'neck_backpack') {
      neckSvg = `<rect x="68" y="142" width="64" height="42" rx="10" fill="#FFB74D" stroke="${ink}" stroke-width="2.6" /><rect x="78" y="158" width="44" height="18" rx="5" fill="#FFE082" stroke="${ink}" stroke-width="2" />`;
    } else if (state.neckBag === 'neck_medal') {
      neckSvg = `<path d="M64,144 L100,164 L136,144" fill="none" stroke="#42A5F5" stroke-width="4.5" /><circle cx="100" cy="168" r="9" fill="#FFD54F" stroke="${ink}" stroke-width="2.4" />`;
    }

    let propSvg = '';
    if (state.handProp === 'prop_sasumata') {
      propSvg = `<line x1="164" y1="176" x2="174" y2="108" stroke="${ink}" stroke-width="4" stroke-linecap="round" /><path d="M164,108 A10,10 0 0 1 184,108" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" />`;
    } else if (state.handProp === 'prop_wand') {
      propSvg = `<line x1="164" y1="174" x2="174" y2="124" stroke="#F48FB1" stroke-width="4" stroke-linecap="round" /><polygon points="174,110 177,118 185,119 179,124 181,132 174,128 167,132 169,124 163,119 171,118" fill="#FFD54F" stroke="${ink}" stroke-width="2" />`;
    } else if (state.handProp === 'prop_boba') {
      propSvg = `<rect x="156" y="136" width="18" height="24" rx="4" fill="#D7CCC8" stroke="${ink}" stroke-width="2.2" /><line x1="165" y1="136" x2="168" y2="122" stroke="#F0627D" stroke-width="3" />`;
    } else if (state.handProp === 'prop_lollipop') {
      propSvg = `<line x1="164" y1="172" x2="172" y2="136" stroke="${ink}" stroke-width="3" /><circle cx="174" cy="126" r="11" fill="#FF80AB" stroke="${ink}" stroke-width="2.4" />`;
    } else if (state.handProp === 'prop_onigiri') {
      propSvg = `<polygon points="166,134 152,158 180,158" fill="#FFFFFF" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" /><rect x="159" y="148" width="14" height="10" fill="#2E3A2F" />`;
    } else if (state.handProp === 'prop_balloon') {
      propSvg = `<line x1="164" y1="166" x2="172" y2="126" stroke="${ink}" stroke-width="2" /><path d="M172,128 C160,118 160,106 168,104 C171,103 172,107 172,107 C172,107 173,103 176,104 C184,106 184,118 172,128 Z" fill="#FF5252" stroke="${ink}" stroke-width="2.2" />`;
    } else if (state.handProp === 'prop_plush') {
      propSvg = `<circle cx="166" cy="146" r="10" fill="#BCAAA4" stroke="${ink}" stroke-width="2.2" /><circle cx="159" cy="137" r="4" fill="#BCAAA4" stroke="${ink}" stroke-width="2" /><circle cx="173" cy="137" r="4" fill="#BCAAA4" stroke="${ink}" stroke-width="2" />`;
    }

    // Face Features (all 17 eyeStyles distinct)
    const eyePair = (x, isR) => {
      const st = state.eyeStyle || 'eye_round';
      if (st === 'eye_happy' || (st === 'eye_wink' && isR)) {
        return `<path d="M${x - 7},110 Q${x},101 ${x + 7},110" fill="none" stroke="${eyeInk}" stroke-width="3" stroke-linecap="round" />`;
      }
      if (st === 'eye_dot') {
        return `<circle cx="${x}" cy="108" r="4.2" fill="${eyeInk}" />`;
      }
      if (st === 'eye_sleepy') {
        return `<line x1="${x - 7}" y1="107" x2="${x + 7}" y2="107" stroke="${eyeInk}" stroke-width="2.8" stroke-linecap="round" /><path d="M${x - 5},107 A5,5 0 0 0 ${x + 5},107 Z" fill="${eyeInk}" />`;
      }
      if (st === 'eye_calm') {
        return `<line x1="${x - 7}" y1="105" x2="${x + 7}" y2="105" stroke="${eyeInk}" stroke-width="2.6" stroke-linecap="round" /><path d="M${x - 5},105 A5.5,6 0 0 0 ${x + 5},105 Z" fill="${eyeInk}" /><circle cx="${x - 1.5}" cy="108" r="1.4" fill="#FFFFFF" />`;
      }
      if (st === 'eye_sparkle') {
        return `<ellipse cx="${x}" cy="108" rx="7" ry="7.6" fill="${eyeInk}" /><circle cx="${x - 2}" cy="104.5" r="2.6" fill="#FFFFFF" /><circle cx="${x + 2.5}" cy="110.5" r="1.6" fill="#FFFFFF" /><path d="M${x - 4},111.5 A4.5,4.5 0 0 0 ${x + 4},111.5 Z" fill="#EAE6DF" />`;
      }
      if (st === 'eye_tear') {
        return `<ellipse cx="${x}" cy="108" rx="6.8" ry="7.4" fill="${eyeInk}" /><circle cx="${x - 2}" cy="105" r="2.2" fill="#FFFFFF" /><ellipse cx="${x}" cy="112" rx="4.5" ry="2.2" fill="#E0F2FE" />`;
      }
      if (st === 'eye_star') {
        return `<ellipse cx="${x}" cy="108" rx="6.8" ry="7.4" fill="${eyeInk}" /><polygon points="${x},102 ${x+2},106 ${x+6},107 ${x+3},110 ${x+4},114 ${x},111 ${x-4},114 ${x-3},110 ${x-6},107 ${x-2},106" fill="#FFF59D" />`;
      }
      if (st === 'eye_crying') {
        return `<ellipse cx="${x}" cy="108" rx="6.6" ry="7.2" fill="${eyeInk}" /><circle cx="${x - 1.5}" cy="105" r="2.2" fill="#FFFFFF" /><path d="M${x - 6},112 Q${x},126 ${x + 6},112" fill="#64B5F6" opacity="0.8" /><path d="M${x - 4},114 Q${x - 6},128 ${x - 2},132 M${x + 4},114 Q${x + 6},128 ${x + 2},132" stroke="#64B5F6" stroke-width="2.5" stroke-linecap="round" fill="none" />`;
      }
      if (st === 'eye_dizzy') {
        let d = '';
        for (let th = 0; th < Math.PI * 6.0; th += 0.2) {
          const r = 0.8 + th * 0.95;
          const px = (x + r * Math.cos(th)).toFixed(1);
          const py = (108 + r * Math.sin(th)).toFixed(1);
          d += (th === 0 ? `M${px},${py}` : ` L${px},${py}`);
        }
        return `<path d="${d}" fill="none" stroke="${eyeInk}" stroke-width="2.2" stroke-linecap="round" />`;
      }
      if (st === 'eye_heart') {
        return `<path d="M${x},114 C${x - 9},104 ${x - 9},97 ${x - 4},96 C${x - 1},95 ${x},99 ${x},99 C${x},99 ${x + 1},95 ${x + 4},96 C${x + 9},97 ${x + 9},104 ${x},114 Z" fill="#FF4081" stroke="${eyeInk}" stroke-width="1.8" /><circle cx="${x - 2}" cy="102" r="1.8" fill="#FFFFFF" />`;
      }
      if (st === 'eye_angry') {
        const p = !isR
          ? `M${x - 7},103 L${x + 6},107 A6,6 0 0 1 ${x - 7},107 Z`
          : `M${x - 6},107 L${x + 7},103 A6,6 0 0 1 ${x - 6},107 Z`;
        return `<path d="${p}" fill="${eyeInk}" stroke="${eyeInk}" stroke-width="1.6" stroke-linejoin="round" /><circle cx="${x - 1.5}" cy="107.5" r="1.6" fill="#FFFFFF" />`;
      }
      if (st === 'eye_cross') {
        return `<line x1="${x - 6}" y1="102" x2="${x + 6}" y2="114" stroke="${eyeInk}" stroke-width="3" stroke-linecap="round" /><line x1="${x + 6}" y1="102" x2="${x - 6}" y2="114" stroke="${eyeInk}" stroke-width="3" stroke-linecap="round" />`;
      }
      if (st === 'eye_squint') {
        return `<path d="M${x - 7},108 Q${x},100 ${x + 7},108" fill="none" stroke="${eyeInk}" stroke-width="3.4" stroke-linecap="round" />`;
      }
      if (st === 'eye_sparkle_big') {
        return `<ellipse cx="${x}" cy="108" rx="8" ry="8.6" fill="${eyeInk}" /><circle cx="${x - 2.5}" cy="103.5" r="3.2" fill="#FFFFFF" /><polygon points="${x+2},106 ${x+3},109 ${x+6},110 ${x+3},111 ${x+2},114 ${x+1},111 ${x-2},110 ${x+1},109" fill="#FFF59D" /><circle cx="${x - 3}" cy="112" r="1.5" fill="#FFFFFF" />`;
      }
      if (st === 'eye_glance') {
        return `<ellipse cx="${x}" cy="108" rx="6.6" ry="7.2" fill="${eyeInk}" /><ellipse cx="${isR ? x + 3 : x + 3}" cy="107" rx="3.5" ry="4.5" fill="#3E2723" /><circle cx="${x + 2}" cy="105" r="2.2" fill="#FFFFFF" /><path d="M${x - 4.5},110 A4.8,4.8 0 0 0 ${x + 4.5},110 Z" fill="#EAE6DF" />`;
      }
      return `<ellipse cx="${x}" cy="108" rx="6.6" ry="7.2" fill="${eyeInk}" /><ellipse cx="${x}" cy="105.5" rx="2.6" ry="2" fill="#FFFFFF" /><path d="M${x - 4.5},110 A4.8,4.8 0 0 0 ${x + 4.5},110 Z" fill="#EAE6DF" />`;
    };

    const browPair = (x, dir) => {
      let eff = state.eyebrowStyle || 'brow_follow';
      if (eff === 'brow_follow') {
        eff = (state.eyeStyle === 'eye_happy' || state.eyeStyle === 'eye_sparkle') ? 'brow_smile' : (state.eyeStyle === 'eye_tear' ? 'brow_droop' : 'brow_short');
      }
      const w = eff === 'brow_thick' ? 3.5 : 2;
      if (eff === 'brow_smile') return `<path d="M${x - 5},95 Q${x},91 ${x + 5},95" fill="none" stroke="${eyeInk}" stroke-width="${w}" stroke-linecap="round" />`;
      if (eff === 'brow_droop') return `<line x1="${x - 5}" y1="${95 - 2 * dir}" x2="${x + 5}" y2="${95 + 2 * dir}" stroke="${eyeInk}" stroke-width="${w}" stroke-linecap="round" />`;
      if (eff === 'brow_angry') return `<line x1="${x - 5}" y1="${95 + 2 * dir}" x2="${x + 5}" y2="${95 - 2 * dir}" stroke="${eyeInk}" stroke-width="${w}" stroke-linecap="round" />`;
      return `<path d="M${x - 5},94 Q${x},92.5 ${x + 5},94" fill="none" stroke="${eyeInk}" stroke-width="${w}" stroke-linecap="round" />`;
    };

    let mouthSvg = `<path d="M94,117 Q97,120.5 100,116.5 Q103,120.5 106,117" fill="none" stroke="${eyeInk}" stroke-width="2.2" stroke-linecap="round" />`;
    let effM = state.mouthStyle || 'mouth_follow';
    if (effM === 'mouth_follow') effM = (state.eyeStyle === 'eye_happy' || state.eyeStyle === 'eye_star') ? 'mouth_open' : 'mouth_cat';
    if (effM === 'mouth_open') mouthSvg = `<path d="M93,116 Q100,127 107,116 Z" fill="#F0627D" stroke="${eyeInk}" stroke-width="2" stroke-linejoin="round" />`;
    else if (effM === 'mouth_small') mouthSvg = `<path d="M95,119 Q100,114 105,119" fill="none" stroke="${eyeInk}" stroke-width="2.2" stroke-linecap="round" />`;
    else if (effM === 'mouth_wavy') mouthSvg = `<path d="M92,119 Q96,115 100,119 Q104,123 108,119" fill="none" stroke="${eyeInk}" stroke-width="2.2" stroke-linecap="round" />`;
    else if (effM === 'mouth_dot') mouthSvg = `<circle cx="100" cy="118" r="2.8" fill="${eyeInk}" />`;
    else if (effM === 'mouth_fang') mouthSvg = `<path d="M94,117 Q97,120.5 100,116.5 Q103,120.5 106,117" fill="none" stroke="${eyeInk}" stroke-width="2.2" stroke-linecap="round" /><polygon points="98,118 102,118 100,123" fill="#FFFFFF" stroke="${eyeInk}" stroke-width="1.4" stroke-linejoin="round" />`;
    else if (effM === 'mouth_surprised') mouthSvg = `<ellipse cx="100" cy="120" rx="4.5" ry="6.5" fill="#F0627D" stroke="${eyeInk}" stroke-width="2" />`;
    else if (effM === 'mouth_cry') mouthSvg = `<path d="M93,122 Q100,113 107,122" fill="#F0627D" stroke="${eyeInk}" stroke-width="2.2" stroke-linejoin="round" /><path d="M93,122 Q100,116 107,122 Z" fill="#F0627D" />`;
    else if (effM === 'mouth_smirk') mouthSvg = `<path d="M95,119 Q103,121 108,114" fill="none" stroke="${eyeInk}" stroke-width="2.6" stroke-linecap="round" />`;
    else if (effM === 'mouth_tongue') mouthSvg = `<path d="M93,117 Q100,124 107,117" fill="none" stroke="${eyeInk}" stroke-width="2.2" stroke-linecap="round" /><path d="M98,119 Q100,126 104,124 Q106,120 102,119 Z" fill="#FF4081" stroke="${eyeInk}" stroke-width="1.6" />`;
    else if (effM === 'mouth_open_smile') mouthSvg = `<path d="M91,116 Q100,130 109,116 Z" fill="#D81B60" stroke="${eyeInk}" stroke-width="2" stroke-linejoin="round" /><path d="M94,123 Q100,120 106,123 Q103,128 97,128 Z" fill="#FF80AB" />`;
    else if (effM === 'mouth_triangle') mouthSvg = `<polygon points="93,117 107,117 100,126" fill="#F0627D" stroke="${eyeInk}" stroke-width="2" stroke-linejoin="round" />`;
    else if (effM === 'mouth_flat') mouthSvg = `<line x1="94" y1="118" x2="106" y2="118" stroke="${eyeInk}" stroke-width="2.4" stroke-linecap="round" />`;

    let markSvg = '';
    if (state.marking === 'mark_eyepatch') markSvg = `<ellipse cx="122" cy="108" rx="14" ry="12" fill="${pointCol}" />`;
    else if (state.marking === 'mark_raccoon') markSvg = `<ellipse cx="78" cy="108" rx="13" ry="11" fill="${pointCol}" /><ellipse cx="122" cy="108" rx="13" ry="11" fill="${pointCol}" />`;
    else if (state.marking === 'mark_star') markSvg = `<polygon points="100,72 102,78 109,79 104,84 105,91 100,87 95,91 96,84 91,79 98,78" fill="${pointCol}" />`;
    else if (state.marking === 'mark_tiger') markSvg = `<line x1="94" y1="70" x2="94" y2="82" stroke="${pointCol}" stroke-width="3" stroke-linecap="round" /><line x1="100" y1="68" x2="100" y2="83" stroke="${pointCol}" stroke-width="3" stroke-linecap="round" /><line x1="106" y1="70" x2="106" y2="82" stroke="${pointCol}" stroke-width="3" stroke-linecap="round" /><line x1="50" y1="112" x2="64" y2="112" stroke="${pointCol}" stroke-width="2.5" stroke-linecap="round" /><line x1="52" y1="118" x2="62" y2="118" stroke="${pointCol}" stroke-width="2.5" stroke-linecap="round" /><line x1="136" y1="112" x2="150" y2="112" stroke="${pointCol}" stroke-width="2.5" stroke-linecap="round" /><line x1="138" y1="118" x2="148" y2="118" stroke="${pointCol}" stroke-width="2.5" stroke-linecap="round" />`;
    else if (state.marking === 'mark_maro') markSvg = `<ellipse cx="78" cy="94" rx="5.5" ry="3.8" fill="${pointCol}" /><ellipse cx="122" cy="94" rx="5.5" ry="3.8" fill="${pointCol}" />`;
    else if (state.marking === 'mark_freckles') markSvg = `<circle cx="62" cy="118" r="1.5" fill="${pointCol}" /><circle cx="66" cy="120" r="1.5" fill="${pointCol}" /><circle cx="134" cy="120" r="1.5" fill="${pointCol}" /><circle cx="138" cy="118" r="1.5" fill="${pointCol}" />`;
    else if (state.marking === 'mark_muzzle') markSvg = `<ellipse cx="100" cy="117" rx="13" ry="8" fill="${pointCol}" opacity="0.3" />`;
    else if (state.marking === 'mark_heart') markSvg = `<path d="M138,123 C132,117 131,110 136,108 C139,107 140,110 140,110 C140,110 141,107 144,108 C149,110 148,117 138,123 Z" fill="${pointCol}" />`;
    else if (state.marking === 'mark_cross') markSvg = `<line x1="58" y1="96" x2="70" y2="108" stroke="${pointCol}" stroke-width="3" stroke-linecap="round" /><line x1="70" y1="96" x2="58" y2="108" stroke="${pointCol}" stroke-width="3" stroke-linecap="round" />`;
    else if (state.marking === 'mark_whiskers') markSvg = `<line x1="42" y1="108" x2="60" y2="110" stroke="${pointCol}" stroke-width="2.2" stroke-linecap="round" /><line x1="40" y1="116" x2="58" y2="116" stroke="${pointCol}" stroke-width="2.2" stroke-linecap="round" /><line x1="42" y1="124" x2="60" y2="122" stroke="${pointCol}" stroke-width="2.2" stroke-linecap="round" /><line x1="158" y1="108" x2="140" y2="110" stroke="${pointCol}" stroke-width="2.2" stroke-linecap="round" /><line x1="160" y1="116" x2="142" y2="116" stroke="${pointCol}" stroke-width="2.2" stroke-linecap="round" /><line x1="158" y1="124" x2="140" y2="122" stroke="${pointCol}" stroke-width="2.2" stroke-linecap="round" />`;
    else if (state.marking === 'mark_lightning') markSvg = `<polygon points="98,64 105,64 100,75 105,75 95,88 98,78 93,78" fill="${pointCol}" />`;
    else if (state.marking === 'mark_panda') markSvg = `<ellipse cx="78" cy="108" rx="14" ry="12" transform="rotate(-15 78 108)" fill="${pointCol}" /><ellipse cx="122" cy="108" rx="14" ry="12" transform="rotate(15 122 108)" fill="${pointCol}" />`;
    else if (state.marking === 'mark_spot') markSvg = `<ellipse cx="78" cy="108" rx="16" ry="14" transform="rotate(-10 78 108)" fill="${pointCol}" />`;
    else if (state.marking === 'mark_clover') markSvg = `<g fill="${pointCol}"><circle cx="97" cy="74" r="3.5" /><circle cx="103" cy="74" r="3.5" /><circle cx="97" cy="80" r="3.5" /><circle cx="103" cy="80" r="3.5" /><path d="M100,78 Q99,86 96,87" stroke="${pointCol}" stroke-width="1.8" fill="none" /></g>`;
    else if (state.marking === 'mark_teardrop') markSvg = `<path d="M125,118 C123,121 121,124 125,126 C129,124 127,121 125,118 Z" fill="${pointCol}" />`;

    let blushSvg = `
      <ellipse cx="63" cy="120" rx="10.5" ry="5.8" fill="#FABCC8" />
      <ellipse cx="137" cy="120" rx="10.5" ry="5.8" fill="#FABCC8" />
      <path d="M58,117 L56,123 M62,117 L60,123 M66,117 L64,123 M70,117 L68,123" stroke="#4A342E" stroke-width="1.4" stroke-linecap="round" />
      <path d="M132,117 L130,123 M136,117 L134,123 M140,117 L138,123 M144,117 L142,123" stroke="#4A342E" stroke-width="1.4" stroke-linecap="round" />
    `;
    if (state.blushStyle === 'blush_none') blushSvg = '';
    else if (state.blushStyle === 'blush_heart') blushSvg = `<path d="M63,125 C56,120 56,114 60,113 C62,112 63,115 63,115 C63,115 64,112 66,113 C70,114 70,120 63,125 Z" fill="#FF7597" /><path d="M137,125 C130,120 130,114 134,113 C136,112 137,115 137,115 C137,115 138,112 140,113 C144,114 144,120 137,125 Z" fill="#FF7597" />`;
    else if (state.blushStyle === 'blush_star') blushSvg = `<polygon points="63,113 65,118 70,118 66,121 67,126 63,123 59,126 60,121 56,118 61,118" fill="#FFD54F" /><polygon points="137,113 139,118 144,118 140,121 141,126 137,123 133,126 134,121 130,118 135,118" fill="#FFD54F" />`;
    else if (state.blushStyle === 'blush_sparkle') blushSvg = `<ellipse cx="63" cy="120" rx="10" ry="5.5" fill="#FABCC8" /><ellipse cx="137" cy="120" rx="10" ry="5.5" fill="#FABCC8" /><circle cx="63" cy="120" r="2.2" fill="#FFF59D" /><circle cx="137" cy="120" r="2.2" fill="#FFF59D" />`;
    else if (state.blushStyle === 'blush_flushed') blushSvg = `<circle cx="63" cy="120" r="11" fill="#FF5252" opacity="0.65" /><circle cx="137" cy="120" r="11" fill="#FF5252" opacity="0.65" />`;
    else if (state.blushStyle === 'blush_stripes') blushSvg = `<path d="M58,116 L54,124 M64,116 L60,124 M70,116 L66,124" stroke="#FF4081" stroke-width="2.2" stroke-linecap="round" /><path d="M130,116 L126,124 M136,116 L132,124 M142,116 L138,124" stroke="#FF4081" stroke-width="2.2" stroke-linecap="round" />`;
    else if (state.blushStyle === 'blush_dots') blushSvg = `<circle cx="58" cy="120" r="2.8" fill="#FF8A80" /><circle cx="64" cy="118" r="2.8" fill="#FF8A80" /><circle cx="70" cy="120" r="2.8" fill="#FF8A80" /><circle cx="130" cy="120" r="2.8" fill="#FF8A80" /><circle cx="136" cy="118" r="2.8" fill="#FF8A80" /><circle cx="142" cy="120" r="2.8" fill="#FF8A80" />`;
    else if (state.blushStyle === 'blush_cat') blushSvg = `<line x1="52" y1="117" x2="72" y2="117" stroke="#FF7597" stroke-width="2" stroke-linecap="round" /><line x1="54" y1="122" x2="70" y2="122" stroke="#FF7597" stroke-width="2" stroke-linecap="round" /><line x1="128" y1="117" x2="148" y2="117" stroke="#FF7597" stroke-width="2" stroke-linecap="round" /><line x1="130" y1="122" x2="146" y2="122" stroke="#FF7597" stroke-width="2" stroke-linecap="round" />`;
    else if (state.blushStyle === 'blush_spiral') blushSvg = `<path d="M63,120 m -6,0 a 6,6 0 1,0 12,0 a 4,4 0 1,0 -8,0 a 2,2 0 1,0 4,0" fill="none" stroke="#FF4081" stroke-width="1.8" stroke-linecap="round" /><path d="M137,120 m -6,0 a 6,6 0 1,0 12,0 a 4,4 0 1,0 -8,0 a 2,2 0 1,0 4,0" fill="none" stroke="#FF4081" stroke-width="1.8" stroke-linecap="round" />`;
    else if (state.blushStyle === 'blush_flower') blushSvg = `<g fill="#FF80AB" stroke="#F0627D" stroke-width="1"><circle cx="63" cy="117" r="2.5" /><circle cx="66" cy="119" r="2.5" /><circle cx="65" cy="123" r="2.5" /><circle cx="61" cy="123" r="2.5" /><circle cx="60" cy="119" r="2.5" /><circle cx="63" cy="120" r="2" fill="#FFF59D" /><circle cx="137" cy="117" r="2.5" /><circle cx="140" cy="119" r="2.5" /><circle cx="139" cy="123" r="2.5" /><circle cx="135" cy="123" r="2.5" /><circle cx="134" cy="119" r="2.5" /><circle cx="137" cy="120" r="2" fill="#FFF59D" /></g>`;
    else if (state.blushStyle === 'blush_rainbow') blushSvg = `<path d="M54,124 A11,11 0 0 1 72,124" fill="none" stroke="#FF5252" stroke-width="2" /><path d="M56,126 A8,8 0 0 1 70,126" fill="none" stroke="#FFD54F" stroke-width="2" /><path d="M58,128 A5,5 0 0 1 68,128" fill="none" stroke="#40C4FF" stroke-width="2" /><path d="M128,124 A11,11 0 0 1 146,124" fill="none" stroke="#FF5252" stroke-width="2" /><path d="M130,126 A8,8 0 0 1 144,126" fill="none" stroke="#FFD54F" stroke-width="2" /><path d="M132,128 A5,5 0 0 1 142,128" fill="none" stroke="#40C4FF" stroke-width="2" />`;

    let glassesSvg = '';
    if (state.glasses === 'glasses_round') glassesSvg = `<circle cx="78" cy="108" r="12" fill="rgba(255,255,255,0.25)" stroke="${ink}" stroke-width="2.4" /><circle cx="122" cy="108" r="12" fill="rgba(255,255,255,0.25)" stroke="${ink}" stroke-width="2.4" /><line x1="90" y1="108" x2="110" y2="108" stroke="${ink}" stroke-width="2.4" />`;
    else if (state.glasses === 'glasses_heart') glassesSvg = `<path d="M78,118 C64,108 66,97 78,103 C90,97 92,108 78,118 Z" fill="rgba(240,98,125,0.75)" stroke="${ink}" stroke-width="2.2" /><path d="M122,118 C108,108 110,97 122,103 C134,97 136,108 122,118 Z" fill="rgba(240,98,125,0.75)" stroke="${ink}" stroke-width="2.2" /><line x1="90" y1="104" x2="110" y2="104" stroke="${ink}" stroke-width="2.2" />`;
    else if (state.glasses === 'glasses_star') glassesSvg = `<polygon points="78,95 81,103 90,104 83,109 85,118 78,113 71,118 73,109 66,104 75,103" fill="rgba(255,213,79,0.85)" stroke="${ink}" stroke-width="2" /><polygon points="122,95 125,103 134,104 127,109 129,118 122,113 115,118 117,109 110,104 119,103" fill="rgba(255,213,79,0.85)" stroke="${ink}" stroke-width="2" /><line x1="88" y1="105" x2="112" y2="105" stroke="${ink}" stroke-width="2.2" />`;
    else if (state.glasses === 'glasses_monocle') glassesSvg = `<circle cx="122" cy="108" r="12.5" fill="rgba(255,255,255,0.25)" stroke="${ink}" stroke-width="2.4" /><path d="M134,112 Q140,126 135,138" fill="none" stroke="${ink}" stroke-width="1.8" />`;
    else if (state.glasses === 'glasses_retro') glassesSvg = `<rect x="66" y="100" width="24" height="17" rx="3" fill="rgba(255,255,255,0.2)" stroke="${ink}" stroke-width="3" /><rect x="110" y="100" width="24" height="17" rx="3" fill="rgba(255,255,255,0.2)" stroke="${ink}" stroke-width="3" /><line x1="90" y1="108" x2="110" y2="108" stroke="${ink}" stroke-width="3" />`;
    else if (state.glasses === 'glasses_sunglasses') glassesSvg = `<path d="M66,102 Q78,98 90,102 L88,114 Q78,122 68,114 Z" fill="#212121" stroke="${ink}" stroke-width="2.4" /><path d="M110,102 Q122,98 134,102 L132,114 Q122,122 112,114 Z" fill="#212121" stroke="${ink}" stroke-width="2.4" /><line x1="90" y1="103" x2="110" y2="103" stroke="${ink}" stroke-width="2.6" /><line x1="68" y1="104" x2="76" y2="116" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" /><line x1="112" y1="104" x2="120" y2="116" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" />`;
    else if (state.glasses === 'glasses_pixel') glassesSvg = `<rect x="66" y="104" width="24" height="10" fill="#111111" stroke="${ink}" stroke-width="1.8" /><rect x="110" y="104" width="24" height="10" fill="#111111" stroke="${ink}" stroke-width="1.8" /><rect x="90" y="104" width="20" height="4" fill="#111111" /><rect x="68" y="106" width="4" height="3" fill="#FFFFFF" /><rect x="112" y="106" width="4" height="3" fill="#FFFFFF" />`;
    else if (state.glasses === 'glasses_goggles') glassesSvg = `<line x1="42" y1="108" x2="158" y2="108" stroke="#5D4037" stroke-width="4" /><circle cx="78" cy="108" r="14" fill="#80DEEA" opacity="0.8" stroke="#37474F" stroke-width="3" /><circle cx="122" cy="108" r="14" fill="#80DEEA" opacity="0.8" stroke="#37474F" stroke-width="3" /><circle cx="78" cy="108" r="10" fill="none" stroke="#FFFFFF" opacity="0.6" stroke-width="1.5" /><circle cx="122" cy="108" r="10" fill="none" stroke="#FFFFFF" opacity="0.6" stroke-width="1.5" />`;
    else if (state.glasses === 'glasses_dizzy') glassesSvg = `<circle cx="78" cy="108" r="13" fill="#FFFFFF" stroke="${ink}" stroke-width="2.4" /><circle cx="78" cy="108" r="9" fill="none" stroke="${ink}" stroke-width="2" /><circle cx="78" cy="108" r="5" fill="none" stroke="${ink}" stroke-width="2" /><circle cx="122" cy="108" r="13" fill="#FFFFFF" stroke="${ink}" stroke-width="2.4" /><circle cx="122" cy="108" r="9" fill="none" stroke="${ink}" stroke-width="2" /><circle cx="122" cy="108" r="5" fill="none" stroke="${ink}" stroke-width="2" /><line x1="91" y1="108" x2="109" y2="108" stroke="${ink}" stroke-width="2.4" />`;
    else if (state.glasses === 'glasses_half') glassesSvg = `<path d="M67,108 Q78,118 89,108" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" /><path d="M111,108 Q122,118 133,108" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" /><line x1="89" y1="108" x2="111" y2="108" stroke="${ink}" stroke-width="2.4" />`;
    else if (state.glasses === 'glasses_cat') glassesSvg = `<path d="M60,114 Q86,114 90,98 Q72,100 58,104 Z" fill="rgba(40,30,30,0.85)" stroke="#E91E63" stroke-width="2.2" stroke-linejoin="round" /><path d="M140,114 Q114,114 110,98 Q128,100 142,104 Z" fill="rgba(40,30,30,0.85)" stroke="#E91E63" stroke-width="2.2" stroke-linejoin="round" /><line x1="88" y1="102" x2="112" y2="102" stroke="#E91E63" stroke-width="2.2" />`;
    else if (state.glasses === 'glasses_sleep') glassesSvg = `<rect x="60" y="96" width="80" height="24" rx="10" fill="#CE93D8" stroke="${ink}" stroke-width="2.4" /><line x1="50" y1="108" x2="60" y2="108" stroke="${ink}" stroke-width="2.2" /><line x1="140" y1="108" x2="150" y2="108" stroke="${ink}" stroke-width="2.2" /><path d="M72,107 Q78,114 84,107 M116,107 Q122,114 128,107" fill="none" stroke="#5E35B1" stroke-width="2.2" stroke-linecap="round" />`;

    const face = isBack ? '' : `
      ${blushSvg}
      ${markSvg}
      ${eyePair(78, false)}
      ${eyePair(122, true)}
      ${browPair(78, -1)}
      ${browPair(122, 1)}
      ${mouthSvg}
      ${glassesSvg}
    `;

    const bgThumbMap = {
      bg_meadow: `<rect width="200" height="220" fill="#DFF2FC" /><path d="M0,165 Q100,145 200,165 L200,220 L0,220 Z" fill="#A8D878" />`,
      bg_night: `<rect width="200" height="220" fill="#1E2A4A" /><circle cx="42" cy="44" r="14" fill="#FFF59D" /><path d="M0,165 Q100,145 200,165 L200,220 L0,220 Z" fill="#2C4341" />`,
      bg_sakura: `<rect width="200" height="220" fill="#FFDCE8" /><path d="M0,165 Q100,145 200,165 L200,220 L0,220 Z" fill="#C5E49E" />`,
      bg_sunset: `<rect width="200" height="220" fill="#FFAB91" /><circle cx="100" cy="70" r="22" fill="#FF7043" /><path d="M0,165 Q100,145 200,165 L200,220 L0,220 Z" fill="#8D9E63" />`,
      bg_pastel: `<rect width="200" height="220" fill="#E1BEE7" /><path d="M0,165 Q100,145 200,165 L200,220 L0,220 Z" fill="#B2DFDB" />`
    };
    const bgSvgThumb = focusKey === 'background' ? (bgThumbMap[state.background] || '') : '';

    return `
      <svg viewBox="${viewBox}" preserveAspectRatio="${aspect}" class="chiikawa-svg" xmlns="http://www.w3.org/2000/svg">
        ${bgSvgThumb}
        <g transform="translate(100, 120) scale(${shapeDef.scaleX}, ${shapeDef.scaleY}) translate(-100, -120)">
          ${!isBack ? ears : ''}
          ${!isBack ? tailSvg : ''}
          <path d="${bodyPath}" fill="${bodyCol}" stroke="${ink}" stroke-width="3.4" stroke-linejoin="round" />
          ${halfMark}
          ${bodyPatSvg}
          ${face}
          ${neckSvg}
          ${!isBack ? propSvg : ''}
          ${!isBack ? hairSvg : ''}
          ${!isBack ? accSvg : ''}
          ${isBack ? ears : ''}
          ${isBack ? tailSvg : ''}
        </g>
      </svg>
    `;
  }
}
