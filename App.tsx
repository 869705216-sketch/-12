import React, { useState } from 'react';
import { Scene } from './components/Scene';
import { WebcamController } from './components/WebcamController';
import { useAppStore } from './store';

// A "Trump-Style" Luxurious Button Component
const LuxuryButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      relative overflow-hidden group
      bg-gradient-to-b from-[#ffd700] to-[#b8860b]
      text-[#022b1c] font-bold font-serif uppercase tracking-widest
      border-2 border-[#ffec8b]
      px-8 py-3 rounded-sm shadow-[0_0_15px_rgba(255,215,0,0.5)]
      transition-all duration-300 transform
      hover:scale-105 hover:shadow-[0_0_25px_rgba(255,215,0,0.8)]
      disabled:opacity-50 disabled:grayscale
    `}
  >
    <span className="relative z-10">{children}</span>
    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
  </button>
);

const App: React.FC = () => {
  const [startExp, setStartExp] = useState(false);
  const { setTargetChaosLevel, chaosLevel, isWebcamActive } = useAppStore();

  const handleManualUnleash = () => {
    // Toggle for manual testing if webcam isn't desired
    setTargetChaosLevel(chaosLevel > 0.5 ? 0 : 1);
  };

  if (!startExp) {
    return (
      <div className="w-full h-screen bg-[#022b1c] flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0a4a33_0%,_#022b1c_100%)]" />
        
        {/* Decorative Borders */}
        <div className="absolute top-4 left-4 w-32 h-32 border-t-4 border-l-4 border-[#ffd700] opacity-50" />
        <div className="absolute bottom-4 right-4 w-32 h-32 border-b-4 border-r-4 border-[#ffd700] opacity-50" />

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-6xl md:text-8xl font-serif text-[#ffd700] mb-2 tracking-tighter drop-shadow-lg">
            THE GRAND TREE
          </h1>
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#ffd700] to-transparent mb-6" />
          <p className="text-xl text-[#a8d5c3] mb-10 font-light italic">
            "A tremendously luxurious interactive holiday experience."
          </p>
          
          <div className="bg-black/30 backdrop-blur-sm p-6 border border-[#ffd700]/30 rounded-lg mb-8">
            <h3 className="text-[#ffd700] text-lg mb-4 font-bold uppercase">Instructions</h3>
            <ul className="text-gray-300 space-y-2 text-left text-sm font-sans">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-[#ffd700] rounded-full mr-3"></span>
                Allow Camera Access to enable interactive gestures.
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-[#ffd700] rounded-full mr-3"></span>
                <span className="font-bold text-white mr-1">Move/Wave</span> to UNLEASH chaos.
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-[#ffd700] rounded-full mr-3"></span>
                <span className="font-bold text-white mr-1">Stay Still</span> to FORM the perfect tree.
              </li>
            </ul>
          </div>

          <LuxuryButton onClick={() => setStartExp(true)}>
            Enter The Lobby
          </LuxuryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <Scene />
      <WebcamController />
      
      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
        <div>
            <h2 className="text-[#ffd700] font-serif text-2xl drop-shadow-md">GRAND LUXURY</h2>
            <div className="flex items-center mt-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${isWebcamActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-[#a8d5c3] font-sans tracking-widest uppercase">
                    {isWebcamActive ? 'Sensors Active' : 'Sensors Offline'}
                </span>
            </div>
        </div>
        
        {/* Status Indicator */}
        <div className="text-right">
             <div className="text-[#ffd700] text-sm font-bold border border-[#ffd700] px-3 py-1 bg-black/50">
                STATUS: {chaosLevel > 0.5 ? 'CHAOS UNLEASHED' : 'PERFECT FORM'}
             </div>
        </div>
      </div>

      {/* Manual Override Control (Bottom) */}
      <div className="absolute bottom-8 left-0 w-full flex justify-center pointer-events-auto">
        <button 
            onClick={handleManualUnleash}
            className="text-[#ffd700]/50 hover:text-[#ffd700] text-xs uppercase tracking-widest transition-colors"
        >
            [ Manual Override ]
        </button>
      </div>
    </div>
  );
};

export default App;