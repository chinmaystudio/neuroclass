import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const mouseRef = useRef({ x: -1000, y: -1000, radius: 200 });

  useEffect(() => {
    // Disable on mobile or reduced motion for max performance & battery life
    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isMobile || prefersReducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let isVisible = true;

    // Optimized density settings (fewer particles = higher frame rates)
    const gap = theme === 'dark' ? 120 : 140; 
    const mouseStrength = 0.3;
    const friction = 0.95;
    const ease = 0.04;

    class Particle {
      x: number;
      y: number;
      originX: number;
      originY: number;
      size: number;
      vx: number;
      vy: number;
      color: string;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.size = Math.random() * 1.5 + 0.5;
        this.vx = 0;
        this.vy = 0;

        const colors = theme === 'dark' 
          ? ['#6366f1', '#3b82f6', '#8b5cf6'] 
          : ['#3b82f6', '#4f46e5', '#8b5cf6'];
        
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseRef.current.radius) {
          const force = (mouseRef.current.radius - distance) / mouseRef.current.radius;
          this.vx += (dx / (distance || 1)) * force * mouseStrength * 5;
          this.vy += (dy / (distance || 1)) * force * mouseStrength * 5;
        }

        this.vx += (this.originX - this.x) * ease;
        this.vy += (this.originY - this.y) * ease;
        this.vx *= friction;
        this.vy *= friction;

        this.x += this.vx;
        this.y += this.vy;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = theme === 'dark' ? 0.3 : 0.25;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let y = 0; y < canvas.height + gap; y += gap) {
        for (let x = 0; x < canvas.width + gap; x += gap) {
          particles.push(new Particle(x, y));
        }
      }
    };

    let lastTime = 0;
    const fpsInterval = 1000 / 30; // Cap at 30fps for smooth performance & lower power usage

    const animate = (currentTime: number) => {
      if (!isVisible) return;
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = currentTime - lastTime;
      if (elapsed < fpsInterval) return;
      lastTime = currentTime - (elapsed % fpsInterval);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    };

    init();
    animationFrameId = requestAnimationFrame(animate);

    window.addEventListener('resize', init, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none hidden md:block transition-opacity duration-500"
    />
  );
};

export default ParticleBackground;

