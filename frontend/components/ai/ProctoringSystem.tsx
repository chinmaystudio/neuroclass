import React, { useRef, useState, useEffect } from 'react';
import { Shield } from '../ui/icons-compat';
import { useNavigate } from 'react-router-dom';
import { LocalMLService } from '../../services/ml/LocalMLService';
import { CameraService } from '../../services/ml/CameraService';
import { logMalpracticeDetected } from '../../database/analytics';
import { Button, Card, CardHeader, PageHeader, useToast } from '../ui';

export const ProctoringSystem: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
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
      toast.error(err.message || "The camera couldn’t be started.");
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
    <>
      <PageHeader
        title="Proctoring"
        description="Proctoring runs inside each test. Choose the checks in a test’s Security and proctoring settings, then use Monitor on a live test to follow it."
        actions={<Button variant="outline" onClick={() => navigate('/teacher/tests')}>Go to tests</Button>}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card as="section" padding="none" aria-labelledby="camcheck-heading" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-5 py-4">
            <div>
              <h2 id="camcheck-heading" className="text-card text-ink">Try the camera checks</h2>
              <p className="text-support text-ink-2">See what students’ devices detect, using your own camera. Nothing is recorded or uploaded.</p>
            </div>
            <Button
              variant={isActive ? 'outline' : 'primary'}
              loading={isModelsLoading && !isActive}
              onClick={isActive ? stopMonitoring : () => void startMonitoring()}
            >
              {isModelsLoading && !isActive ? 'Loading detection' : isActive ? 'Stop camera' : 'Start camera'}
            </Button>
          </div>
          <div className="relative aspect-video w-full bg-black">
            <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            <canvas ref={canvasOverlayRef} className="pointer-events-none absolute inset-0 z-10" />
            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
                <Shield size={32} />
                <p className="text-body">Camera is off</p>
                <p className="max-w-sm text-support text-white/90">Start the camera to preview face, gaze and object detection.</p>
              </div>
            )}
            {isAnalyzing && (
              <p role="status" className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-support text-white">Analysing on this device</p>
            )}
          </div>
        </Card>

        <Card as="section" aria-labelledby="checks-heading">
          <CardHeader title={<span id="checks-heading">What’s checked</span>} />
          <dl className="mt-4 flex flex-col gap-4 text-body">
            <div><dt className="font-medium text-ink">Objects</dt><dd className="text-support text-ink-2">Phones, books and other devices in view.</dd></div>
            <div><dt className="font-medium text-ink">Face and gaze</dt><dd className="text-support text-ink-2">Whether the student is present and looking at the screen.</dd></div>
            <div><dt className="font-medium text-ink">Other people</dt><dd className="text-support text-ink-2">More than one face, or someone talking.</dd></div>
          </dl>
          <p className="mt-4 border-t border-line-2 pt-4 text-support text-ink-2">Signals help you review an attempt. Students are never failed automatically, and they can appeal.</p>
        </Card>
      </div>
    </>
  );
};
