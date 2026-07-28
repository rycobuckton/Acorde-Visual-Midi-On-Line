import React, { useEffect, useRef } from 'react';
import { synthEngineInstance } from '../lib/synth-engine';

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize observer to scale canvas properly
    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });
    
    resizeObserver.observe(canvas);

    const draw = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      
      ctx.fillStyle = '#000000'; // Pure Black background for high contrast
      ctx.fillRect(0, 0, width, height);

      const analyser = synthEngineInstance.analyser;
      if (!analyser || synthEngineInstance.ctx?.state === 'suspended') {
        // Draw a flat center line if synthesizer is inactive
        ctx.strokeStyle = '#27272a'; // Zinc-800
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw ambient radar grid lines for tech aesthetics
        drawGrid(ctx, width, height);

        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Draw grid
      drawGrid(ctx, width, height);

      // Check if there is active audio signal
      let isSilent = true;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] !== 128) {
          isSilent = false;
          break;
        }
      }

      // Wave form styling
      ctx.lineWidth = 2.0;
      
      // Create a glowing emerald laser color gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#059669');   // Deep Emerald
      gradient.addColorStop(0.5, '#10b981'); // Vibrant Emerald
      gradient.addColorStop(1, '#34d399');   // Mint Emerald
      
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = isSilent ? 0 : 10;
      ctx.shadowColor = '#10b981';

      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // Normalized -1 to 1
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Reset shadows for other draws
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(draw);
    };

    const drawGrid = (c: CanvasRenderingContext2D, w: number, h: number) => {
      c.strokeStyle = '#18181b'; // Zinc-900 grid lines
      c.lineWidth = 1;
      
      // Vertical grid lines
      const cols = 8;
      for (let i = 1; i < cols; i++) {
        const x = (w / cols) * i;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }

      // Horizontal grid lines
      const rows = 4;
      for (let i = 1; i < rows; i++) {
        const y = (h / rows) * i;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full h-24 bg-black rounded border border-zinc-700 overflow-hidden shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-mono font-medium text-emerald-400 uppercase tracking-widest">
          MASTER OSCILLOSCOPE
        </span>
      </div>
    </div>
  );
};
