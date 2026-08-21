import React, { useState } from 'react';
import { Monitor, Users, Clock, ShieldAlert, CheckCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { LocalMLService } from '../../services/ml/LocalMLService';
import { CameraService } from '../../services/ml/CameraService';

interface TestAnalysisProps {
  testType: 'online' | 'offline';
}

export const TestAnalysisSystem: React.FC<TestAnalysisProps> = ({ testType }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const incidentBuffer = React.useRef<{ [key: string]: number }>({});

  React.useEffect(() => {
    LocalMLService.loadModels();
  }, []);

  const activeRef = React.useRef(false);
  const analysisTimeoutRef = React.useRef<any>(null);

  const startAnalysis = async () => {
    try {
      const stream = await CameraService.startCamera();
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsMonitoring(true);
      activeRef.current = true;

      const runAnalysis = async () => {
        if (!activeRef.current || !videoRef.current) return;
        
        try {
          const result = await LocalMLService.detectMalpractice(videoRef.current);
          
          // Temporal smoothing: require 2 consecutive frames for GAZE/TALKING
          if (result.isMalpractice) {
            const bufferKey = `test_${result.type}`;
            incidentBuffer.current[bufferKey] = (incidentBuffer.current[bufferKey] || 0) + 1;
            
            // Log only if threshold met or it's a critical violation
            if (incidentBuffer.current[bufferKey] >= 2 || (result.type !== 'GAZE' && result.type !== 'TALKING')) {
              setSessionLogs(prev => {
                const now = Date.now();
                const lastLog = prev[0];
                
                // Throttle same violation logging to every 5 seconds
                if (lastLog && lastLog.detail === result.reason && now - lastLog.rawTime < 5000) {
                   return prev;
                }
                
                let screenshotUrl = '';
                try {
                  if (videoRef.current) {
                    const frame = CameraService.captureFrame(videoRef.current);
                    if (frame) {
                      screenshotUrl = `data:image/jpeg;base64,${frame}`;
                    }
                  }
                } catch (captureErr) {
                  console.error('Frame capture failed during analysis:', captureErr);
                }

                return [{
                  time: new Date().toLocaleTimeString(),
                  rawTime: now,
                  type: 'Violation',
                  detail: result.reason,
                  category: result.type,
                  confidence: result.confidence,
                  screenshot: screenshotUrl
                }, ...prev];
              });
              
              // Reset buffer for this type after logging
              incidentBuffer.current[bufferKey] = 0;
            }
          } else {
            incidentBuffer.current = {};
          }
        } catch (e) {
          console.error(e);
        }

        if (activeRef.current) {
          analysisTimeoutRef.current = setTimeout(runAnalysis, 1000);
        }
      };

      runAnalysis();
    } catch (e: any) {
      alert(e.message || "Failed to start AI surveillance.");
    }
  };

  const stopAnalysis = () => {
    CameraService.stopCamera(streamRef.current);
    activeRef.current = false;
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    setIsMonitoring(false);
  };

  return (
    <div className="p-10 bg-slate-900 rounded-[40px] border border-white/5 text-white space-y-10 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center group">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              {testType === 'online' ? <Monitor size={24} /> : <Users size={24} />}
            </div>
            {testType.toUpperCase()} TEST SURVEILLANCE
          </h2>
          <p className="text-[11px] opacity-40 uppercase tracking-widest mt-2 font-mono">Live AI-Powered Integrity Engine</p>
        </div>
        <button 
          onClick={isMonitoring ? stopAnalysis : startAnalysis}
          className={`px-12 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] transition-all transform active:scale-95 shadow-2xl ${isMonitoring ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'}`}
        >
          {isMonitoring ? 'Stop Monitoring' : 'Start Secure Guard'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div className="relative aspect-video bg-black rounded-[48px] overflow-hidden border-[12px] border-white/5 shadow-[0_0_50px_rgba(37,99,235,0.1)]">
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-all duration-700 ${isMonitoring ? 'opacity-100' : 'opacity-30 grayscale blur-sm'}`} />
            
            <AnimatePresence>
              {isMonitoring && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-rose-600 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest animate-pulse">
                  <Clock size={10} /> Live Monitoring Active
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] opacity-40 uppercase tracking-widest mb-1">Total Flags</p>
                <p className="text-2xl font-bold">{sessionLogs.filter(l => l.type === 'Violation').length}</p>
             </div>
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] opacity-40 uppercase tracking-widest mb-1">Status</p>
                <p className="text-lg font-bold text-emerald-500">SECURE</p>
             </div>
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[8px] opacity-40 uppercase tracking-widest mb-1">Integrity</p>
                <p className="text-lg font-bold">99.8%</p>
             </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-[24px] border border-white/5 p-6 flex flex-col h-[500px]">
          <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6 flex items-center gap-2">
            <ShieldAlert size={14} className="text-rose-500" /> Malpractice Reports
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
            {sessionLogs.map((log, i) => (
              <div key={`${log.rawTime}-${i}`} className="p-4 bg-black/40 rounded-2xl border border-rose-500/20 space-y-3">
                <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest">
                  <span className="text-rose-500">Doubtful Activity</span>
                  <span className="opacity-40">{log.time}</span>
                </div>
                <p className="text-[10px] text-white/70 leading-relaxed">{log.detail}</p>
                <img src={log.screenshot} className="w-full rounded-lg border border-white/10" alt="Incident Capture" />
              </div>
            ))}
            {sessionLogs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 gap-2">
                <CheckCircle size={32} />
                <p className="text-[10px] font-bold uppercase tracking-widest">No violations detected</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
