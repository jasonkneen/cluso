import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number; // 0 to 255
  isActive: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Smooth out the volume for visualization
  const smoothedVolumeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Smooth interpolation
      smoothedVolumeRef.current += (volume - smoothedVolumeRef.current) * 0.1;
      const v = smoothedVolumeRef.current;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Base Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 300);
      
      if (isActive) {
        // Active State: Blue/Cyan/Purple pulsing
        gradient.addColorStop(0, `rgba(168, 199, 250, ${0.8 + (v / 255) * 0.2})`); // Core
        gradient.addColorStop(0.3, `rgba(66, 133, 244, ${0.4 + (v / 255) * 0.3})`); // Mid
        gradient.addColorStop(0.7, `rgba(168, 85, 247, ${0.1 + (v / 255) * 0.2})`); // Outer
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        // Idle State: Dim Grey
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Orbital Rings (Only when active)
      if (isActive) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + (v/255) * 0.4})`;
        ctx.lineWidth = 2;
        // Radius reacts to volume
        const radius = 100 + (v * 0.5);
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.1 + (v/255) * 0.3})`;
        ctx.lineWidth = 1;
        ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [volume, isActive]);

  useEffect(() => {
    // Handle resize with RAF throttling
    let rafId: number | null = null
    const handleResize = () => {
      if (rafId) return // Already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth
          canvasRef.current.height = window.innerHeight
        }
      })
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => {
      window.removeEventListener('resize', handleResize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};