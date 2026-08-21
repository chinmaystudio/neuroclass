import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { CameraService } from '../../services/ml/CameraService';
import { LocalMLService } from '../../services/ml/LocalMLService';

interface JoinClassWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const JoinClassWizard: React.FC<JoinClassWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [joinCode, setJoinCode] = useState('');
  
  // Existing registered face data (reuses face descriptor across all classes)
  const [existingFaceData, setExistingFaceData] = useState<{
    descriptor: any;
    samples: string[];
  } | null>(null);

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
    try {
      const { data: existingProfiles } = await supabase
        .from('students')
        .select('face_descriptor, face_samples, roll_number, phone, name')
        .eq('user_id', user!.id)
        .not('face_descriptor', 'is', null);

      if (existingProfiles && existingProfiles.length > 0) {
        const profileWithFace = existingProfiles.find(p => p.face_descriptor != null);
        if (profileWithFace) {
          const parsedSamples = Array.isArray(profileWithFace.face_samples) ? profileWithFace.face_samples : [];
          setExistingFaceData({
            descriptor: profileWithFace.face_descriptor,
            samples: parsedSamples,
          });

          setStudentDetails(prev => ({
            ...prev,
            name: prev.name || profileWithFace.name || '',
            rollNumber: prev.rollNumber || profileWithFace.roll_number || '',
            phoneNumber: prev.phoneNumber || profileWithFace.phone || '',
            faceSamples: parsedSamples.length > 0 ? parsedSamples : prev.faceSamples,
          }));
        }
      }
    } catch (e) {
      console.error('Error fetching existing face data:', e);
    }
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
    setExistingFaceData(null);
    setError(null);
  };

  const handleJoinClassroom = async () => {
    if (!user) {
      setError('You must be logged in.');
      return;
    }

    // Determine face descriptor: use existing if available and not re-scanned
    let finalDescriptor = existingFaceData?.descriptor || null;
    let finalSamples = studentDetails.faceSamples;

    if (!finalDescriptor && studentDetails.faceSamples.length < 5) {
      setError('Please capture all 5 face samples first or enable your camera.');
      return;
    }

    setIsRegistering(true);
    setError(null);
    
    try {
      // If camera was used to capture new face samples, extract updated descriptor
      if (videoRef.current && isCapturing) {
        await LocalMLService.loadModels();
        const newDescriptor = await LocalMLService.getFaceDescriptor(videoRef.current);
        if (newDescriptor) {
          finalDescriptor = JSON.stringify(Array.from(newDescriptor));
        }
      }

      if (!finalDescriptor) {
        throw new Error('Face descriptor missing. Please capture your face samples.');
      }

      // 1. Lookup Classroom
      const sanitizedCode = joinCode.trim().toUpperCase();
      const { data: classroom, error: classErr } = await supabase
        .from('classrooms')
        .select('*')
        .eq('code', sanitizedCode)
        .single();
      
      if (classErr || !classroom) {
        throw new Error('Classroom not found. Please verify the 6-character code.');
      }

      // 2. Insert into Students table for this classroom
      const { error: enrollErr } = await supabase
        .from('students')
        .insert({
          classroom_id: classroom.id,
          user_id: user.id,
          name: studentDetails.name,
          roll_number: studentDetails.rollNumber,
          phone: studentDetails.phoneNumber,
          email: user.email || '',
          face_samples: finalSamples,
          face_descriptor: typeof finalDescriptor === 'string' ? finalDescriptor : JSON.stringify(finalDescriptor),
          joined_at: new Date().toISOString()
        });
      
      if (enrollErr) {
        if (enrollErr.message?.includes('unique') || enrollErr.code === '23505') {
          throw new Error('You are already enrolled in this classroom.');
        }
        throw enrollErr;
      }

      // 3. Update all student profiles for this user with the unified face descriptor
      await supabase
        .from('students')
        .update({
          face_descriptor: typeof finalDescriptor === 'string' ? finalDescriptor : JSON.stringify(finalDescriptor),
          face_samples: finalSamples,
        })
        .eq('user_id', user.id);

      // 4. Update Classroom student count
      await supabase
        .from('classrooms')
        .update({ students: (classroom.students || 0) + 1 })
        .eq('id', classroom.id);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-xl bg-white dark:bg-[#0a0a0a] rounded-[36px] border border-slate-200 dark:border-white/10 p-8 md:p-10 shadow-2xl overflow-hidden relative"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button 
                onClick={() => { setError(null); setStep(step - 1); }}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Join Classroom</h3>
          </div>

          <button onClick={() => { stopCamera(); onClose(); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-white/10">
              <motion.div 
                className="h-full bg-purple-600"
                initial={{ width: 0 }}
                animate={{ width: step >= i ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classroom Code</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3" 
                    maxLength={6}
                    className="w-full mt-2 px-6 py-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 font-mono tracking-widest text-center text-xl"
                  />
                </div>

                {existingFaceData && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <ShieldCheck size={18} className="shrink-0" />
                    <span>Registered Face-ID Detected — Will automatically apply your Face-ID profile across this class.</span>
                  </div>
                )}

                <button 
                  onClick={() => { setError(null); if (joinCode.length === 6) setStep(2); else setError('Enter a valid 6-character code.'); }}
                  className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-500/20 hover:bg-purple-500 transition-all flex items-center justify-center gap-2"
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                  <input 
                    type="text" 
                    value={studentDetails.name}
                    onChange={(e) => setStudentDetails({...studentDetails, name: e.target.value})}
                    className="w-full mt-2 px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent outline-none focus:border-purple-500/50 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Roll Number / Student ID</label>
                  <input 
                    type="text" 
                    value={studentDetails.rollNumber}
                    onChange={(e) => setStudentDetails({...studentDetails, rollNumber: e.target.value})}
                    className="w-full mt-2 px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent outline-none focus:border-purple-500/50 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone Number (Optional)</label>
                  <input 
                    type="tel" 
                    value={studentDetails.phoneNumber}
                    onChange={(e) => setStudentDetails({...studentDetails, phoneNumber: e.target.value})}
                    className="w-full mt-2 px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent outline-none focus:border-purple-500/50 text-sm font-medium"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setStep(1)} 
                    className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button 
                    onClick={() => { setError(null); if (studentDetails.name && studentDetails.rollNumber) setStep(3); else setError('Name and Roll Number are required.'); }}
                    className="flex-1 py-4 rounded-2xl bg-purple-600 text-white font-bold uppercase tracking-widest text-xs"
                  >
                    {existingFaceData ? 'Confirm Biometrics' : 'Biometrics'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-6">
                {existingFaceData && !isCapturing ? (
                  <div className="p-6 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-center space-y-4">
                    <ShieldCheck size={40} className="mx-auto text-purple-500" />
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">Unified Face-ID Ready</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Your registered face biometric profile will be linked automatically to this classroom.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleClearFaceData}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={14} /> Re-scan Face
                      </button>

                      <button
                        onClick={handleJoinClassroom}
                        disabled={isRegistering}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-1.5"
                      >
                        {isRegistering ? 'Joining...' : <><CheckCircle2 size={16} /> Complete Join</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-1">Face-ID Enrollment</p>
                      <p className="text-xs text-slate-500">Capture 5 varied angles of your face. Once saved, this Face ID applies to all your classes.</p>
                    </div>

                    <div className="relative aspect-video bg-black rounded-[24px] overflow-hidden border border-white/10 shadow-inner flex items-center justify-center">
                      {!isCapturing ? (
                        <button 
                          onClick={startCapture}
                          className="flex flex-col items-center gap-3 text-white/50 hover:text-white transition-colors p-8"
                        >
                          <Camera size={48} className="opacity-50" />
                          <span className="text-xs font-bold uppercase tracking-widest">Enable Camera</span>
                        </button>
                      ) : (
                        <>
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                          <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                          <div className="absolute inset-0 pointer-events-none border-[4px] border-purple-500/30 rounded-[24px]" />
                        </>
                      )}
                    </div>

                    {isCapturing && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="flex-1 aspect-square rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden relative">
                              {studentDetails.faceSamples[i] ? (
                                <img src={studentDetails.faceSamples[i]} className="w-full h-full object-cover" alt={`Sample ${i}`} />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                  <Camera size={16} className="opacity-30" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex gap-3">
                          <button 
                            onClick={handleClearFaceData}
                            className="px-4 py-3.5 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"
                            title="Clear captured face data"
                          >
                            <Trash2 size={14} /> Clear Data
                          </button>

                          {studentDetails.faceSamples.length < 5 ? (
                            <button 
                              onClick={captureSample}
                              className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/20 font-bold uppercase tracking-widest text-xs"
                            >
                              Capture Sample ({studentDetails.faceSamples.length}/5)
                            </button>
                          ) : (
                            <button 
                              onClick={handleJoinClassroom}
                              disabled={isRegistering}
                              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/30"
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
                <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex justify-between items-center">
                  <button 
                    onClick={() => { stopCamera(); setStep(2); }} 
                    className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5"
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
