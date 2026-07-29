import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const mouseRef = useRef({ x: -1000, y: -1000, radius: 300 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    
    // Density settings
    const gap = theme === 'dark' ? 68 : 84; 
    const mouseStrength = 0.4;
    const friction = 0.96;
    const ease = 0.03;

    class Particle {
      x: number;
      y: number;
      originX: number;
      originY: number;
      size: number;
      vx: number;
      vy: number;
      color: string;
      density: number;
      z: number; // For parallax

      constructor(x: number, y: number) {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.originX = x;
        this.originY = y;
        this.size = Math.random() * 1.5 + 0.5;
        this.vx = 0;
        this.vy = 0;
        this.z = Math.random() * 2 + 1;
        
        const colors = theme === 'dark' 
          ? ['#6366f1', '#3b82f6', '#8b5cf6', '#4f46e5'] 
          : ['#3b82f6', '#4f46e5', '#8b5cf6', '#e2e8f0'];
        
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.density = (Math.random() * 20) + 1;
      }

      update() {
        // Parallax effect based on mouseRef
        const parallaxX = (mouseRef.current.x - canvas!.width / 2) * 0.01 * this.z;
        const parallaxY = (mouseRef.current.y - canvas!.height / 2) * 0.01 * this.z;

        const time = Date.now() * 0.0008;
        const driftX = Math.sin(time + this.originY * 0.01) * 2;
        const driftY = Math.cos(time + this.originX * 0.01) * 2;

        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mouseRef.current.radius) {
          const force = (mouseRef.current.radius - distance) / mouseRef.current.radius;
          this.vx += (dx / distance) * force * this.density * mouseStrength;
          this.vy += (dy / distance) * force * this.density * mouseStrength;
        }

        this.vx += (this.originX + driftX + parallaxX - this.x) * ease;
        this.vy += (this.originY + driftY + parallaxY - this.y) * ease;

        this.vx *= friction;
        this.vy *= friction;

        this.x += this.vx;
        this.y += this.vy;
      }

      draw() {
        if (!ctx) return;
        
        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const opacity = Math.max(0.1, 1 - (distance / (mouseRef.current.radius * 3)));
        const sizeBonus = distance < mouseRef.current.radius ? (1 - distance / mouseRef.current.radius) * 1 : 0;
        
        ctx.fillStyle = this.color;
        ctx.globalAlpha = theme === 'dark' ? opacity * 0.4 : opacity * 0.2;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, (this.size + sizeBonus), 0, Math.PI * 2);
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

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw subtle background waves
      const time = Date.now() * 0.0005;
      const gradient = ctx.createRadialGradient(
        canvas.width / 2 + Math.sin(time) * 100, 
        canvas.height / 2 + Math.cos(time) * 100, 
        0,
        canvas.width / 2, 
        canvas.height / 2, 
        canvas.width 
      );
      
      if (theme === 'dark') {
        gradient.addColorStop(0, 'rgba(30, 41, 59, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.02)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
      }
    };

    init();
    animate();

    window.addEventListener('resize', init);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none transition-opacity duration-1000"
    />
  );
};

export default ParticleBackground;
