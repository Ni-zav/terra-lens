// Interactive geographic picker. Blue Marble is a historical context image,
// not a climate-data layer. Rendering happens only after interaction.
import * as THREE from 'three';

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = lon => ((lon + 180) % 360 + 360) % 360 - 180;
const MARKER_COLORS = { A: 0x62d6e4, B: 0xf6b975, C: 0xa38cf8, D: 0x56d39a };

export function pointToVector(lat, lon, radius = 1) {
  const phi = lat * RAD, lambda = lon * RAD;
  return new THREE.Vector3(radius * Math.cos(phi) * Math.cos(lambda),
    radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(lambda));
}
export function vectorToPoint(vector) {
  const v = vector.clone().normalize();
  return {lat: Math.asin(clamp(v.y, -1, 1)) / RAD, lon: wrap(Math.atan2(-v.z, v.x) / RAD)};
}

export function createGlobe(host, onPick, onHover) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40),
    new THREE.MeshStandardMaterial({color:0xffffff, roughness:1}));
  scene.add(earth);
  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const sunlight = new THREE.DirectionalLight(0xffffff, 1.6);
  sunlight.position.set(3, 2, 4); scene.add(sunlight);
  const markers = new THREE.Group(); scene.add(markers);
  let disposed = false;
  const loader = new THREE.TextureLoader();
  loader.load(new URL('../assets/nasa-blue-marble.jpg', import.meta.url).href, texture => {
    if (disposed) {texture.dispose(); return;}
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    earth.material.map = texture; earth.material.needsUpdate = true; draw();
  }, undefined, () => {
    renderer.domElement.style.display='none';
    host.dataset.error='true';
    host.append(document.createTextNode('Earth imagery unavailable. Use the coordinate fields below.'));
  });
  let centerLat = -8, centerLon = 110, pointer = null, pendingFrame = 0;
  const raycaster = new THREE.Raycaster(), cursor = new THREE.Vector2();
  function draw() {
    if (disposed) return;
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      camera.position.copy(pointToVector(centerLat, centerLon, 3.5));
      camera.lookAt(0, 0, 0); renderer.render(scene, camera);
    });
  }
  function resize() {
    const {width, height} = host.getBoundingClientRect();
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
      const color = MARKER_COLORS[point.id] || 0x62d6e4;
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.026, 16, 12),
        new THREE.MeshBasicMaterial({color}));
      marker.position.copy(pointToVector(point.lat, point.lon, 1.02));
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
      earth.geometry.dispose(); earth.material.map?.dispose(); earth.material.dispose();
      renderer.dispose(); renderer.domElement.remove();
    }};
}
