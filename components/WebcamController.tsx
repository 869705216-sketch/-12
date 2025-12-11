import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { lerp } from '../utils/math';

export const WebcamController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setTargetChaosLevel, setCameraOffset, setWebcamActive } = useAppStore();
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 320 }, 
            height: { ideal: 240 },
            facingMode: "user" 
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setWebcamActive(true);
        }
      } catch (err) {
        console.error("Webcam access denied", err);
        setPermissionError(true);
      }
    };

    startWebcam();

    // Motion Detection Logic
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    let prevFrameData: Uint8ClampedArray | null = null;
    const width = 64; // Low res for performance
    const height = 48;

    const processFrame = () => {
      if (!videoRef.current || !canvasRef.current || !ctx) return;
      
      // Draw small frame
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      const frame = ctx.getImageData(0, 0, width, height);
      const data = frame.data;
      
      if (!prevFrameData) {
        prevFrameData = data;
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      let diffScore = 0;
      let motionCenterX = 0;
      let motionCenterY = 0;
      let motionPixels = 0;

      // Simple pixel difference loop
      for (let i = 0; i < data.length; i += 4) {
        const rDiff = Math.abs(data[i] - prevFrameData[i]);
        const gDiff = Math.abs(data[i + 1] - prevFrameData[i + 1]);
        const bDiff = Math.abs(data[i + 2] - prevFrameData[i + 2]);
        
        const pixelDiff = (rDiff + gDiff + bDiff) / 3;
        
        if (pixelDiff > 30) { // Threshold
          diffScore += pixelDiff;
          
          // Calculate centroid of motion
          const pixelIndex = i / 4;
          const x = pixelIndex % width;
          const y = Math.floor(pixelIndex / width);
          
          motionCenterX += x;
          motionCenterY += y;
          motionPixels++;
        }
      }

      prevFrameData = data;

      // Normalize metrics
      const normalizedDiff = Math.min(diffScore / (width * height * 10), 1);
      
      // Logic: High motion = Chaos (Unleash). Low motion = Form (Tree).
      // If motion is sustained, we push chaos level up.
      // 0.15 is a sensitivity threshold.
      const isUnleashing = normalizedDiff > 0.15;
      
      setTargetChaosLevel(isUnleashing ? 1 : 0);

      // Camera Control: Move based on motion centroid
      if (motionPixels > 0) {
        const avgX = (motionCenterX / motionPixels) / width; // 0 to 1
        const avgY = (motionCenterY / motionPixels) / height; // 0 to 1
        // Map to -1 to 1
        setCameraOffset((avgX - 0.5) * 4, (avgY - 0.5) * 2); 
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    // Wait for video to be ready
    if (videoRef.current) {
        videoRef.current.onloadeddata = () => {
             processFrame();
        }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [setTargetChaosLevel, setCameraOffset, setWebcamActive]);

  if (permissionError) return null;

  return (
    <div className="absolute opacity-0 pointer-events-none">
      <video ref={videoRef} muted playsInline className="w-16 h-16" />
      <canvas ref={canvasRef} width={64} height={48} className="w-16 h-16" />
    </div>
  );
};