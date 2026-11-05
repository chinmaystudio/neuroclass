import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, ArrowLeft, Trash2 } from '../ui/icons-compat';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { CameraService } from '../../services/ml/CameraService';

interface JoinClassWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const JoinClassWizard: React.FC<JoinClassWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [joinCode, setJoinCode] = useState('');
  

  // Registration Data
  const [studentDetails, setStudentDetails] = useState({
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
    rollNumber: '',
    phoneNumber: '',
    faceSamples: [] as string[]
  });

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check if student already registered face data in another class
  useEffect(() => {
    if (user && isOpen) {
      fetchExistingFaceData();
    }
  }, [user, isOpen]);

  // Stop camera when closing or changing steps away from step 3
  useEffect(() => {
    if (!isOpen || step !== 3) {
      stopCamera();
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const fetchExistingFaceData = async () => {
    // Legacy browser descriptor reuse is intentionally disabled. Each classroom
    // registration sends fresh image samples to the authenticated Vercel gateway.
  };

  const startCapture = async () => {
    try {
      setIsCapturing(true);
      const newStream = await CameraService.startCamera();
      setStream(newStream);
    } catch {
      setIsCapturing(false);
      setError('Camera access denied or device unavailable.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const captureSample = () => {
    if (videoRef.current && canvasRef.current) {
      const frame = CameraService.captureFrame(videoRef.current);
      if (!frame) return;
      
      setStudentDetails(prev => ({
        ...prev,
        faceSamples: [...prev.faceSamples, `data:image/jpeg;base64,${frame}`].slice(-5)
      }));
    }
  };

  const handleClearFaceData = () => {
    setStudentDetails(prev => ({ ...prev, faceSamples: [] }));
    setError(null);
  };

  const handleJoinClassroom = async () => {
    if (!user) {
      setError('You must be logged in.');
      return;
    }
    if (studentDetails.faceSamples.length < 5) {
      setError('Please capture all 5 face samples first.');
      return;
    }

    setIsRegistering(true);
    setError(null);
    
    try {
      // Joining goes through a database function: it validates the code, links
      // this account and updates the roster count. Students cannot browse
      // classrooms or write roster rows directly.
      const { data: joined, error: joinErr } = await (supabase as any).rpc('nc_join_classroom', {
        p_code: joinCode.trim().toUpperCase(),
        p_name: studentDetails.name,
        p_roll_number: studentDetails.rollNumber || null,
        p_phone: studentDetails.phoneNumber || null,
      });
      const enrollment = Array.isArray(joined) ? joined[0] : joined;
      if (joinErr || !enrollment?.student_id) {
        throw new Error(joinErr?.message || 'Unable to join this classroom. Please try again.');
      }

      if (studentDetails.faceSamples.length > 0) {
        const { uploadFaceSamples } = await import('../../services/api/faceRegistration');
        const blobs = await Promise.all(studentDetails.faceSamples.map(async (dataUrl) => (await fetch(dataUrl)).blob()));
        await uploadFaceSamples(enrollment.student_id, enrollment.classroom_id, blobs);
      }

      stopCamera();
      onSuccess();
      onClose();
      setStep(1);
    } catch (e: any) {
      setError(e.message || 'Enrollment failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-xl bg-surface rounded-card border border-line p-8 md:p-10 shadow-raised overflow-hidden relative"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button 
                onClick={() => { setError(null); setStep(step - 1); }}
                className="p-2 rounded-full hover:bg-surface-2 text-ink-2 hover:text-ink transition-colors"
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h3 className="text-2xl font-bold tracking-tight text-ink ">Join Classroom</h3>
          </div>

          <button onClick={() => { stopCamera(); onClose(); }} className="text-ink-2 hover:text-ink transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-2 ">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: step >= i ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-card bg-danger-bg border border-danger/30 text-danger-ink text-xs font-semibold">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-6">
                <div>
                  <label className="text-meta font-bold text-ink-2">Classroom Code</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3" 
                    maxLength={6}
                    className="w-full mt-2 px-6 py-5 rounded-card bg-surface-2 border border-line text-ink outline-none focus:ring-2 focus:ring-primary font-mono text-center text-xl"
                  />
                </div>

                {false && (
                  <div className="p-4 rounded-card bg-success-bg border border-success/30 flex items-center gap-3 text-success-ink text-xs font-semibold">
                    <ShieldCheck size={18} className="shrink-0" />
                    <span>Registered Face-ID Detected — Will automatically apply your Face-ID profile across this class.</span>
                  </div>
                )}

                <button 
                  onClick={() => { setError(null); if (joinCode.length === 6) setStep(2); else setError('Enter a valid 6-character code.'); }}
                  className="w-full py-4 rounded-card bg-primary text-on-primary font-bold text-xs shadow-raised hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                >
                  Next Step <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-4">
                <div>
                  <label className="text-meta font-bold text-ink-2">Full Name</label>
                  <input 
                    type="text" 
                    value={studentDetails.name}
                    onChange={(e) => setStudentDetails({...studentDetails, name: e.target.value})}
                    className="w-full mt-2 px-6 py-4 rounded-card bg-surface-2 border border-transparent outline-none focus:border-primary text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="text-meta font-bold text-ink-2">Roll Number / Student ID</label>
                  <input 
                    type="text" 
                    value={studentDetails.rollNumber}
                    onChange={(e) => setStudentDetails({...studentDetails, rollNumber: e.target.value})}
                    className="w-full mt-2 px-6 py-4 rounded-card bg-surface-2 border border-transparent outline-none focus:border-primary text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="text-meta font-bold text-ink-2">Phone Number (Optional)</label>
                  <input 
                    type="tel" 
                    value={studentDetails.phoneNumber}
                    onChange={(e) => setStudentDetails({...studentDetails, phoneNumber: e.target.value})}
                    className="w-full mt-2 px-6 py-4 rounded-card bg-surface-2 border border-transparent outline-none focus:border-primary text-sm font-medium"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setStep(1)} 
                    className="flex-1 py-4 rounded-card bg-surface-2 text-ink font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button 
                    onClick={() => { setError(null); if (studentDetails.name && studentDetails.rollNumber) setStep(3); else setError('Name and Roll Number are required.'); }}
                    className="flex-1 py-4 rounded-card bg-primary text-on-primary font-bold text-xs"
                  >
                    Biometrics
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-6">
                {false ? (
                  <div className="p-6 rounded-card bg-primary-light border border-primary-soft text-center space-y-4">
                    <ShieldCheck size={40} className="mx-auto text-primary" />
                    <div>
                      <h4 className="text-lg font-bold text-ink ">Unified Face-ID Ready</h4>
                      <p className="text-xs text-ink-2 mt-1">
                        Your registered face biometric profile will be linked automatically to this classroom.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleClearFaceData}
                        className="flex-1 py-3 rounded-button bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={14} /> Re-scan Face
                      </button>

                      <button
                        onClick={handleJoinClassroom}
                        disabled={isRegistering}
                        className="flex-1 py-3 rounded-button bg-success hover:bg-success text-on-primary font-bold text-xs shadow-raised flex items-center justify-center gap-1.5"
                      >
                        {isRegistering ? 'Joining...' : <><CheckCircle2 size={16} /> Complete Join</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-xs font-bold text-primary mb-1">Face-ID Enrollment</p>
                      <p className="text-xs text-ink-2">Capture 5 varied angles of your face. Once saved, this Face ID applies to all your classes.</p>
                    </div>

                    <div className="relative aspect-video bg-black rounded-card overflow-hidden border border-line shadow-inner flex items-center justify-center">
                      {!isCapturing ? (
                        <button 
                          onClick={startCapture}
                          className="flex flex-col items-center gap-3 text-white hover:text-white transition-colors p-8"
                        >
                          <Camera size={48} className="opacity-50" />
                          <span className="text-xs font-bold ">Enable Camera</span>
                        </button>
                      ) : (
                        <>
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                          <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                          <div className="absolute inset-0 pointer-events-none border-[4px] border-primary-soft rounded-card" />
                        </>
                      )}
                    </div>

                    {isCapturing && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="flex-1 aspect-square rounded-button bg-surface-2 border border-line overflow-hidden relative">
                              {studentDetails.faceSamples[i] ? (
                                <img src={studentDetails.faceSamples[i]} className="w-full h-full object-cover" alt={`Sample ${i}`} />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-ink-2">
                                  <Camera size={16} className="opacity-30" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex gap-3">
                          <button 
                            onClick={handleClearFaceData}
                            className="px-4 py-3.5 rounded-card bg-danger-bg text-danger-ink hover:bg-danger-bg text-xs font-bold flex items-center gap-1.5"
                            title="Clear captured face data"
                          >
                            <Trash2 size={14} /> Clear Data
                          </button>

                          {studentDetails.faceSamples.length < 5 ? (
                            <button 
                              onClick={captureSample}
                              className="flex-1 py-3.5 rounded-card bg-surface border border-line font-bold text-xs"
                            >
                              Capture Sample ({studentDetails.faceSamples.length}/5)
                            </button>
                          ) : (
                            <button 
                              onClick={handleJoinClassroom}
                              disabled={isRegistering}
                              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-card bg-success hover:bg-success text-on-primary font-bold text-xs shadow-raised "
                            >
                              {isRegistering ? 'Registering...' : <><CheckCircle2 size={16} /> Save Face ID & Join</>}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Back Button for Step 3 */}
                <div className="pt-2 border-t border-line flex justify-between items-center">
                  <button 
                    onClick={() => { stopCamera(); setStep(2); }} 
                    className="text-xs font-bold text-ink-2 hover:text-ink flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} /> Back to Details
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
