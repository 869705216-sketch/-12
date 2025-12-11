import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { LuxuryTree } from './LuxuryTree';
import { useAppStore } from '../store';
import { lerp } from '../utils/math';

const CameraRig = () => {
  const { cameraOffset, chaosLevel } = useAppStore();
  const { camera } = useThree();
  
  useFrame((state, delta) => {
    // Smoothly interpolate camera position based on webcam tracking
    // Base position: [0, 4, 20]
    
    // During chaos, camera shakes slightly
    const shake = chaosLevel * 0.1;
    const time = state.clock.elapsedTime;
    
    const targetX = cameraOffset.x * 5 + Math.sin(time * 2) * shake;
    const targetY = 4 + cameraOffset.y * 3 + Math.cos(time * 2) * shake;
    
    camera.position.x = lerp(camera.position.x, targetX, delta * 2);
    camera.position.y = lerp(camera.position.y, targetY, delta * 2);
    camera.lookAt(0, 4, 0);
  });
  
  return null;
};

export const Scene: React.FC = () => {
  return (
    <div className="w-full h-screen bg-[#022b1c]">
      <Canvas
        dpr={[1, 2]}
        gl={{ 
            antialias: false, 
            toneMapping: THREE.ReinhardToneMapping, 
            toneMappingExposure: 1.5 
        }}
        camera={{ position: [0, 4, 20], fov: 45 }}
      >
        <color attach="background" args={['#01150e']} />
        
        {/* Environment & Lights */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} color="#002200" />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#ffd700" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ff0000" />
        
        {/* High Definition Environment Map for Reflections */}
        <Environment preset="lobby" />

        {/* Content */}
        <LuxuryTree />
        <CameraRig />
        
        {/* Interaction controls as fallback */}
        <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={10} 
            maxDistance={40}
            maxPolarAngle={Math.PI / 1.5}
        />

        {/* Cinematic Post Processing */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={0.65} 
            luminanceSmoothing={0.9} 
            height={300} 
            intensity={1.5} 
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};