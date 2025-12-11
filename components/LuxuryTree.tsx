import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store';
import { getConePoint, getRandomSpherePoint, lerp } from '../utils/math';

// --- Shaders ---
const foliageVertexShader = `
  uniform float uProgress;
  uniform float uTime;
  attribute vec3 aTreePos;
  attribute vec3 aChaosPos;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aIsLight; // 1.0 if it's a light, 0.0 if foliage
  
  varying vec3 vColor;
  varying float vIsLight;

  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; 
    vec3 x3 = x0 - D.yyy;      
    i = mod289(i); 
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857; 
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vColor = aColor;
    vIsLight = aIsLight;
    
    // Mix positions
    vec3 pos = mix(aTreePos, aChaosPos, uProgress);
    
    // Add subtle wind
    float noise = snoise(pos * 0.5 + uTime * 0.5);
    pos += noise * 0.2 * (1.0 - uProgress); 

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    float baseSize = aSize;
    // Make lights bigger
    if (aIsLight > 0.5) {
       // Twinkle effect
       float twinkle = sin(uTime * 3.0 + pos.x * 10.0) * 0.5 + 0.5;
       baseSize = aSize * (1.0 + twinkle * 1.5);
    }
    
    gl_PointSize = baseSize * (300.0 / -mvPosition.z);
  }
`;

const foliageFragmentShader = `
  varying vec3 vColor;
  varying float vIsLight;
  
  void main() {
    // Circular particle
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if(dist > 0.5) discard;
    
    vec3 finalColor = vColor;
    
    // Lights have a hot core
    if (vIsLight > 0.5) {
        float glow = 1.0 - dist * 2.0;
        glow = pow(glow, 2.0); // sharp glow
        gl_FragColor = vec4(finalColor + glow, 1.0);
    } else {
        // Normal foliage / sparkles
        float strength = 1.0 - dist * 2.0;
        gl_FragColor = vec4(finalColor * strength * 2.0, 1.0);
    }
  }
`;

const FOLIAGE_COUNT = 18000;
const LIGHTS_COUNT = 800; // Extra twinkling lights
const TOTAL_PARTICLES = FOLIAGE_COUNT + LIGHTS_COUNT;
const ORNAMENT_COUNT = 400;

export const LuxuryTree: React.FC = () => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const ornamentsRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const { targetChaosLevel, setChaosLevel } = useAppStore();
  
  // -- PARTICLE DATA --
  const particleData = useMemo(() => {
    const treePositions = new Float32Array(TOTAL_PARTICLES * 3);
    const chaosPositions = new Float32Array(TOTAL_PARTICLES * 3);
    const colors = new Float32Array(TOTAL_PARTICLES * 3);
    const sizes = new Float32Array(TOTAL_PARTICLES);
    const isLight = new Float32Array(TOTAL_PARTICLES);

    const emerald = new THREE.Color("#008f4c");
    const darkGreen = new THREE.Color("#004225");
    const warmWhite = new THREE.Color("#fffdd0");
    const brightGold = new THREE.Color("#ffec8b");

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      // Tree Shape: Cone
      const treePos = getConePoint(14, 5.5, -7);
      treePositions[i * 3] = treePos.x;
      treePositions[i * 3 + 1] = treePos.y;
      treePositions[i * 3 + 2] = treePos.z;

      // Chaos Shape: Sphere
      const chaosPos = getRandomSpherePoint(18);
      chaosPositions[i * 3] = chaosPos.x;
      chaosPositions[i * 3 + 1] = chaosPos.y;
      chaosPositions[i * 3 + 2] = chaosPos.z;

      // Determine if it's a light or foliage
      if (i >= FOLIAGE_COUNT) {
        // It's a light
        isLight[i] = 1.0;
        const col = Math.random() > 0.5 ? warmWhite : brightGold;
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
        sizes[i] = Math.random() * 0.4 + 0.3; // Bigger
      } else {
        // Foliage
        isLight[i] = 0.0;
        const col = Math.random() > 0.7 ? emerald : darkGreen;
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
        sizes[i] = Math.random() * 0.25 + 0.1;
      }
    }

    return { treePositions, chaosPositions, colors, sizes, isLight };
  }, []);

  // -- ORNAMENTS & STAR DATA --
  const { ornamentTargets, starTargets } = useMemo(() => {
    const treeArr = [];
    const chaosArr = [];
    
    // Ornaments
    for(let i=0; i<ORNAMENT_COUNT; i++) {
        // Place ornaments slightly inside the cone radius so they nestle
        treeArr.push(getConePoint(13.5, 5.2, -6.8));
        chaosArr.push(getRandomSpherePoint(22));
    }

    // Star Targets
    const starTree = new THREE.Vector3(0, 7.5, 0); // Top of tree (14 - 7 roughly)
    const starChaos = getRandomSpherePoint(25);

    return { 
        ornamentTargets: { tree: treeArr, chaos: chaosArr },
        starTargets: { tree: starTree, chaos: starChaos }
    };
  }, []);
  
  // -- INITIAL SETUP --
  useLayoutEffect(() => {
    // Set Ornament Colors
    if (ornamentsRef.current) {
        const tempColor = new THREE.Color();
        const gold = new THREE.Color("#ffd700");
        const red = new THREE.Color("#d42426"); // Christmas Red
        const silver = new THREE.Color("#e0e0e0");

        for (let i = 0; i < ORNAMENT_COUNT; i++) {
            const r = Math.random();
            if (r > 0.5) tempColor.copy(gold);
            else if (r > 0.2) tempColor.copy(red);
            else tempColor.copy(silver);
            
            ornamentsRef.current.setColorAt(i, tempColor);
        }
        ornamentsRef.current.instanceColor.needsUpdate = true;
    }
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPos = useMemo(() => new Array(ORNAMENT_COUNT).fill(0).map(() => new THREE.Vector3()), []);
  const currentStarPos = useRef(new THREE.Vector3(0, 0, 0));

  // -- ANIMATION LOOP --
  useFrame((state, delta) => {
    const currentChaos = useAppStore.getState().chaosLevel;
    const newChaos = lerp(currentChaos, targetChaosLevel, delta * 2.0);
    setChaosLevel(newChaos);

    // 1. Update Shader
    if (shaderRef.current) {
      shaderRef.current.uniforms.uProgress.value = newChaos;
      shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }

    // 2. Update Star
    if (starRef.current) {
        const sT = starTargets.tree;
        const sC = starTargets.chaos;
        const sTargetX = lerp(sT.x, sC.x, newChaos);
        const sTargetY = lerp(sT.y, sC.y, newChaos);
        const sTargetZ = lerp(sT.z, sC.z, newChaos);
        
        currentStarPos.current.x = lerp(currentStarPos.current.x, sTargetX, delta * 4.0);
        currentStarPos.current.y = lerp(currentStarPos.current.y, sTargetY, delta * 4.0);
        currentStarPos.current.z = lerp(currentStarPos.current.z, sTargetZ, delta * 4.0);

        starRef.current.position.copy(currentStarPos.current);
        starRef.current.rotation.y += delta;
        starRef.current.rotation.z += delta * 0.5;
    }

    // 3. Update Ornaments
    if (ornamentsRef.current) {
      for (let i = 0; i < ORNAMENT_COUNT; i++) {
        const tPos = ornamentTargets.tree[i];
        const cPos = ornamentTargets.chaos[i];
        
        const targetX = lerp(tPos.x, cPos.x, newChaos);
        const targetY = lerp(tPos.y, cPos.y, newChaos);
        const targetZ = lerp(tPos.z, cPos.z, newChaos);
        
        currentPos[i].x = lerp(currentPos[i].x, targetX, delta * 4.0);
        currentPos[i].y = lerp(currentPos[i].y, targetY, delta * 4.0);
        currentPos[i].z = lerp(currentPos[i].z, targetZ, delta * 4.0);
        
        dummy.position.set(currentPos[i].x, currentPos[i].y, currentPos[i].z);
        
        // Dynamic scaling: smaller in chaos
        const scale = lerp(0.35, 0.1, newChaos); 
        dummy.scale.set(scale, scale, scale);
        
        dummy.updateMatrix();
        ornamentsRef.current.setMatrixAt(i, dummy.matrix);
      }
      ornamentsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Foliage & Lights Particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={TOTAL_PARTICLES}
            array={particleData.treePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aTreePos"
            count={TOTAL_PARTICLES}
            array={particleData.treePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aChaosPos"
            count={TOTAL_PARTICLES}
            array={particleData.chaosPositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={TOTAL_PARTICLES}
            array={particleData.colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aSize"
            count={TOTAL_PARTICLES}
            array={particleData.sizes}
            itemSize={1}
          />
           <bufferAttribute
            attach="attributes-aIsLight"
            count={TOTAL_PARTICLES}
            array={particleData.isLight}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={shaderRef}
          vertexShader={foliageVertexShader}
          fragmentShader={foliageFragmentShader}
          uniforms={{
            uProgress: { value: 0 },
            uTime: { value: 0 }
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Ornaments (Instanced) */}
      <instancedMesh
        ref={ornamentsRef}
        args={[undefined, undefined, ORNAMENT_COUNT]}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          roughness={0.15}
          metalness={0.9}
        />
      </instancedMesh>

      {/* The Crown Star */}
      <mesh ref={starRef}>
         <octahedronGeometry args={[1.2, 0]} />
         <meshStandardMaterial 
            color="#fffdd0" 
            emissive="#fffdd0" 
            emissiveIntensity={2} 
            toneMapped={false}
         />
      </mesh>
    </group>
  );
};