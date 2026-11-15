// Interactive geographic picker. Blue Marble is a historical context image,
// not a climate-data layer. Rendering happens only after interaction.
import * as THREE from 'three';

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = lon => ((lon + 180) % 360 + 360) % 360 - 180;
const MARKER_COLORS = { A: 0x2563eb, B: 0xea580c, C: 0x0d9488, D: 0x16a34a };

export function pointToVector(lat, lon, radius = 1) {
  const phi = lat * RAD, lambda = lon * RAD;
  return new THREE.Vector3(radius * Math.cos(phi) * Math.cos(lambda),
    radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(lambda));
}
export function vectorToPoint(vector) {
  const v = vector.clone().normalize();
  return {lat: Math.asin(clamp(v.y, -1, 1)) / RAD, lon: wrap(Math.atan2(-v.z, v.x) / RAD)};
}

const EARTH_VERT = `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vPosWorld;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosWorld = worldPos.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const EARTH_FRAG = `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vPosWorld;

void main() {
  vec3 N = normalize(vNormalWorld);
  vec3 V = normalize(cameraPosition - vPosWorld);
  vec3 L = normalize(uSunDir);

  vec3 base = vec3(0.32, 0.54, 0.78);
  if (uHasMap > 0.5) {
    vec3 tex = texture2D(uMap, vUv).rgb;
    float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
    // Lift dark NASA Blue Marble oceans for light-mode legibility while keeping land contrast.
    float oceanMask = smoothstep(0.22, 0.04, lum) * smoothstep(0.0, 0.06, tex.b - tex.r + 0.02);
    vec3 liftedOcean = mix(tex, vec3(0.16, 0.38, 0.64) + tex * 1.15, 0.72);
    vec3 liftedLand = pow(tex, vec3(0.86)) * 1.08;
    base = mix(liftedLand, liftedOcean, oceanMask);
  }

  // Soft daylight + hemisphere fill so no hemisphere turns pitch black.
  float ndotl = max(dot(N, L), 0.0);
  float hemi = 0.5 + 0.5 * N.y;
  vec3 lit = base * (0.64 + 0.36 * ndotl + 0.08 * hemi);

  // Subtle 30-degree cartographic graticule.
  vec2 grid = abs(fract(vec2(vUv.x * 12.0, vUv.y * 6.0) - 0.5) - 0.5) / max(fwidth(vec2(vUv.x * 12.0, vUv.y * 6.0)), vec2(0.0001));
  float line = 1.0 - min(min(grid.x, grid.y), 1.0);
  lit = mix(lit, vec3(0.88, 0.94, 1.0), line * 0.16);

  // Fresnel atmospheric rim highlight to separate the globe on light surfaces.
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.5);
  vec3 rimColor = vec3(0.42, 0.72, 0.99);
  lit = mix(lit, rimColor, fresnel * 0.58);

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const ATMO_VERT = `
varying vec3 vNormalWorld;
varying vec3 vPosWorld;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosWorld = worldPos.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const ATMO_FRAG = `
varying vec3 vNormalWorld;
varying vec3 vPosWorld;
void main() {
  vec3 N = normalize(vNormalWorld);
  vec3 V = normalize(cameraPosition - vPosWorld);
  float rim = pow(clamp(-dot(N, V), 0.0, 1.0), 3.0);
  gl_FragColor = vec4(0.24, 0.55, 0.96, rim * 0.42);
}
`;

export function createGlobe(host, onPick, onHover) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const earthUniforms = {
    uMap: {value: null},
    uHasMap: {value: 0},
    uSunDir: {value: new THREE.Vector3(0.55, 0.42, 0.72).normalize()}
  };
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 40),
    new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG
    })
  );
  scene.add(earth);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.075, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    })
  );
  scene.add(atmosphere);

  const eqPoints = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    eqPoints.push(new THREE.Vector3(Math.cos(a) * 1.003, 0, Math.sin(a) * 1.003));
  }
  const equator = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(eqPoints),
    new THREE.LineBasicMaterial({color: 0x93c5fd, transparent: true, opacity: 0.35})
  );
  scene.add(equator);

  const markers = new THREE.Group(); scene.add(markers);
  let disposed = false;
  const loader = new THREE.TextureLoader();
  loader.load(new URL('../assets/nasa-blue-marble.jpg', import.meta.url).href, texture => {
    if (disposed) {texture.dispose(); return;}
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    earthUniforms.uMap.value = texture;
    earthUniforms.uHasMap.value = 1;
    draw();
  }, undefined, () => {
    renderer.domElement.style.display='none';
    host.dataset.error='true';
    host.append(document.createTextNode('Earth imagery unavailable. Use the coordinate fields below.'));
  });

  let centerLat = -8, centerLon = 110, pointer = null, pendingFrame = 0;
  const raycaster = new THREE.Raycaster(), cursor = new THREE.Vector2();
  const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3();

  function draw() {
    if (disposed) return;
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      const tanHalfV = Math.tan((camera.fov * 0.5) * RAD);
      const tanHalfH = tanHalfV * (camera.aspect || 1);
      const dist = Math.max(3.35, 1.13 / Math.min(tanHalfV, tanHalfH));
      camera.position.copy(pointToVector(centerLat, centerLon, dist));
      camera.lookAt(0, 0, 0);
      // Keep sunlight slightly above and right of the viewer so every hemisphere is clearly lit.
      const viewDir = camera.position.clone().normalize();
      right.crossVectors(up, viewDir).normalize();
      earthUniforms.uSunDir.value.copy(viewDir).multiplyScalar(0.82).addScaledVector(up, 0.42).addScaledVector(right, 0.38).normalize();
      renderer.render(scene, camera);
    });
  }

  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.updateProjectionMatrix(); draw();
  }

  function setPoints(points) {
    for (const old of [...markers.children]) {
      markers.remove(old); old.geometry.dispose(); old.material.dispose();
    }
    for (const point of points) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat)>90 || Math.abs(point.lon)>180) continue;
      const color = MARKER_COLORS[point.id] || 0x2563eb;
      const halo = new THREE.Mesh(new THREE.SphereGeometry(.034, 16, 12),
        new THREE.MeshBasicMaterial({color: 0xffffff}));
      halo.position.copy(pointToVector(point.lat, point.lon, 1.016));
      markers.add(halo);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.025, 16, 12),
        new THREE.MeshBasicMaterial({color}));
      marker.position.copy(pointToVector(point.lat, point.lon, 1.024));
      markers.add(marker);
    }
    draw();
  }

  function hitTest(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    cursor.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(cursor, camera);
    const hit = raycaster.intersectObject(earth)[0];
    return hit ? vectorToPoint(hit.point) : null;
  }

  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    pointer = {x:e.clientX, y:e.clientY, startX:e.clientX, startY:e.clientY};
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!pointer) {
      if (onHover) onHover(hitTest(e.clientX, e.clientY));
      return;
    }
    const dx=e.clientX-pointer.x, dy=e.clientY-pointer.y;
    pointer.x=e.clientX; pointer.y=e.clientY;
    centerLon=wrap(centerLon-dx*.35); centerLat=clamp(centerLat+dy*.35,-85,85); draw();
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!pointer) return;
    const distance=Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY); pointer=null;
    if (distance > 5) return;
    const picked = hitTest(e.clientX, e.clientY);
    if (picked) onPick(picked);
  });
  renderer.domElement.addEventListener('pointerleave', () => {if (onHover) onHover(null);});
  renderer.domElement.addEventListener('pointercancel', () => {pointer=null; if (onHover) onHover(null);});
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  return {setPoints, focus(point) {centerLat=clamp(point.lat,-85,85); centerLon=wrap(point.lon); draw();},
    dispose() {
      disposed=true; observer.disconnect(); if(pendingFrame)cancelAnimationFrame(pendingFrame);
      for (const marker of markers.children) {marker.geometry.dispose(); marker.material.dispose();}
      equator.geometry.dispose(); equator.material.dispose();
      atmosphere.geometry.dispose(); atmosphere.material.dispose();
      earthUniforms.uMap.value?.dispose();
      earth.geometry.dispose(); earth.material.dispose();
      renderer.dispose(); renderer.domElement.remove();
    }};
}
