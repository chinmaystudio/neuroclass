import React, { useRef, useState, useEffect } from 'react';
import { Shield, Activity, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LocalMLService } from '../../services/ml/LocalMLService';
import { CameraService } from '../../services/ml/CameraService';
import { logMalpracticeDetected } from '../../database/analytics';

export const ProctoringSystem: React.FC = () => {
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && activeRef.current) {
        logMalpracticeDetected('NONE', 'Warning: Browser tab focus lost (Possible tab switching)');
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => window.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const [isActive, setIsActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  // HUD Persistence
  const lastViolationRef = useRef<any>(null);
  const violationExpiryRef = useRef<number>(0);

  // Temporal smoothing refs
  const incidentBuffer = useRef<{ [key: string]: number }>({});
  
  // Specific thresholds ported from proctor_engine.py configuration
  const GET_THRESHOLD = (type: string) => {
    switch (type) {
      case 'GAZE': return 4;    // ~1 second at 4fps
      case 'TALKING': return 6; // ~1.5 seconds 
      case 'ABSENCE': return 12; // ~3 seconds
      case 'OBJECT': return 2;   // Fast flag
      case 'MULTI_FACE': return 2;
      default: return 3;
    }
  };

  useEffect(() => {
    const load = async () => {
      setIsModelsLoading(true);
      await LocalMLService.loadModels();
      setIsModelsLoading(false);
    };
    load();
  }, []);

  const activeRef = useRef(false);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);
  const lastCleanLogTime = useRef<number>(0);

  const drawOverlay = (result: any) => {
    if (!canvasOverlayRef.current || !videoRef.current) return;
    const canvas = canvasOverlayRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (result && result.isMalpractice && result.boundingBoxes) {
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;

      result.boundingBoxes.forEach((box: any) => {
        const drawX = box.x * scaleX;
        const drawY = box.y * scaleY;
        const drawW = box.width * scaleX;
        const drawH = box.height * scaleY;

        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(drawX, drawY, drawW, drawH);
        
        ctx.fillStyle = '#f43f5e';
        const label = box.label;
        ctx.font = 'bold 11px Inter, sans-serif';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(drawX, drawY - 20, textWidth + 15, 20);

        ctx.fillStyle = 'white';
        ctx.fillText(label, drawX + 7, drawY - 6);

        ctx.beginPath();
        ctx.arc(drawX + drawW/2, drawY + drawH/2, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.fill();
        ctx.stroke();
      });
    }
  };

  const startMonitoring = async () => {
    try {
      const stream = await CameraService.startCamera();
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsActive(true);
      activeRef.current = true;

      const runAnalysis = async () => {
        if (!activeRef.current || !videoRef.current) return;
        
        if (isAnalyzing) {
           intervalRef.current = setTimeout(runAnalysis, 150);
           return;
        }

        setIsAnalyzing(true);
        try {
          const result = await LocalMLService.detectMalpractice(videoRef.current);
          const now = Date.now();
          
          if (result.isMalpractice) {
            lastViolationRef.current = result;
            violationExpiryRef.current = now + 4000;
            drawOverlay(result);
            
            incidentBuffer.current[result.type] = (incidentBuffer.current[result.type] || 0) + 1;
            
            if (incidentBuffer.current[result.type] >= GET_THRESHOLD(result.type)) {
              logMalpracticeDetected(result.type, result.reason);
            }
          } else {
            if (lastViolationRef.current && now < violationExpiryRef.current) {
               drawOverlay(lastViolationRef.current);
            } else {
              if (canvasOverlayRef.current) {
                const ctx = canvasOverlayRef.current.getContext('2d');
                ctx?.clearRect(0, 0, canvasOverlayRef.current.width, canvasOverlayRef.current.height);
              }
              lastViolationRef.current = null;
            }

            Object.keys(incidentBuffer.current).forEach(k => {
              if (incidentBuffer.current[k] > 0) incidentBuffer.current[k]--;
            });
          }

          if (now - lastCleanLogTime.current > 1000) {
              lastCleanLogTime.current = now;
          }
        } catch (e) {
          console.error(e);
        }
        setIsAnalyzing(false);
        
        if (activeRef.current) {
           intervalRef.current = setTimeout(runAnalysis, 250); 
        }
      };
      
      runAnalysis();
    } catch (err: any) {
      alert(err.message || "Proctoring failed to start camera.");
    }
  };

  const stopMonitoring = () => {
    CameraService.stopCamera(streamRef.current);
    activeRef.current = false;
    if (intervalRef.current) clearTimeout(intervalRef.current);
    setIsActive(false);
    setIsAnalyzing(false);
    // Clear overlay
    if (canvasOverlayRef.current) {
      const ctx = canvasOverlayRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasOverlayRef.current.width, canvasOverlayRef.current.height);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8 bg-white dark:bg-slate-950 rounded-[40px] border border-slate-200 dark:border-white/5 max-w-[1200px] mx-auto w-full">
        <div className="w-full flex justify-between items-center bg-slate-50 dark:bg-white/5 p-6 rounded-3xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 dark:text-white">Proctor Engine v4.0</h3>
              <p className="text-[10px] opacity-40 uppercase tracking-widest font-mono text-slate-500 dark:text-slate-400 italic">Standalone Offline Analysis Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isModelsLoading && <div className="text-[9px] font-bold text-blue-500 animate-pulse uppercase tracking-widest">Warming Engines...</div>}
            <button 
              onClick={isActive ? stopMonitoring : startMonitoring}
              className={`flex items-center gap-2 px-10 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all transform active:scale-95 ${isActive ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-500'}`}
            >
              {isActive ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {isActive ? 'Disable Guard' : 'Launch HUD'}
            </button>
          </div>
        </div>

        <div className="relative w-full aspect-video bg-black rounded-[40px] overflow-hidden border-8 border-slate-100 dark:border-white/5 shadow-2xl group">
           <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-30 blur-md grayscale'}`} />
           <canvas ref={canvasOverlayRef} className="absolute inset-0 z-10 pointer-events-none" />
           
           <AnimatePresence>
            {isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-md text-white/60 px-6 py-3 rounded-full border border-white/10"
              >
                <Activity size={14} className="animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">OFFLINE ANALYSIS ACTIVE: {new Date().toLocaleTimeString()}</span>
              </motion.div>
            )}
           </AnimatePresence>

           {isActive && (
             <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-500/5 to-transparent opacity-30" />
                <div className="absolute top-10 left-10 w-20 h-20 border-t-2 border-l-2 border-blue-500/40 rounded-tl-3xl" />
                <div className="absolute top-10 right-10 w-20 h-20 border-t-2 border-r-2 border-blue-500/40 rounded-tr-3xl" />
                <div className="absolute bottom-10 left-10 w-20 h-20 border-b-2 border-l-2 border-blue-500/40 rounded-bl-3xl" />
                <div className="absolute bottom-10 right-10 w-20 h-20 border-b-2 border-r-2 border-blue-500/40 rounded-br-3xl" />
             </div>
           )}
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Target: Objects</h4>
              <p className="text-xs font-light">Detects phones, headphones, books, and unauthorized hardware instantly.</p>
           </div>
           <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Target: Biometrics</h4>
              <p className="text-xs font-light">Monitors lateral gaze, suspicious looking down, and face accessibility.</p>
           </div>
           <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Target: Interaction</h4>
              <p className="text-xs font-light">Identifies speech patterns, communication, and multi-person presence.</p>
           </div>
        </div>
    </div>
  );
};
