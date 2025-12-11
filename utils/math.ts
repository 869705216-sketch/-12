import * as THREE from 'three';

// Generate random point inside a sphere
export const getRandomSpherePoint = (radius: number): THREE.Vector3 => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

// Generate point on a cone surface (Tree shape) with curved profile
export const getConePoint = (height: number, radiusBase: number, yOffset: number = 0): THREE.Vector3 => {
  const y = Math.random() * height; // Height from base
  
  // Power function for a slightly curved, fuller tree look (like a real fir)
  // (1 - y/height) is linear. Raising to power < 1 makes it bulge out slightly.
  const taper = Math.pow(1 - y / height, 0.8); 
  
  const actualR = radiusBase * taper;
  
  const theta = Math.random() * Math.PI * 2;
  // Add some volume/noise so it's not a hollow shell
  // 0.4 to 1.0 distribution
  const r = actualR * (0.4 + Math.random() * 0.6); 

  return new THREE.Vector3(
    r * Math.cos(theta),
    y + yOffset,
    r * Math.sin(theta)
  );
};

export const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};