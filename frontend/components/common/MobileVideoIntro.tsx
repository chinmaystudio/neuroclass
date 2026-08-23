import React, { useEffect, useRef, useState } from 'react';

const INTRO_STORAGE_KEY = 'neuroclass-mobile-video-intro-seen';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export const MobileVideoIntro: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(() => {
    if (!canUseStorage()) return true;
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) !== '1';
  });
  const [isExiting, setIsExiting] = useState(false);

  const finishIntro = () => {
    if (isExiting) return;
    setIsExiting(true);
    window.setTimeout(() => {
      window.sessionStorage?.setItem(INTRO_STORAGE_KEY, '1');
      setIsVisible(false);
    }, 320);
  };

  useEffect(() => {
    if (!isVisible) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      finishIntro();
      return undefined;
    }

    const fallbackTimer = window.setTimeout(finishIntro, 7_350);
    const video = videoRef.current;
    const playPromise = video?.play();
    playPromise?.catch(() => {
      // Autoplay can be restricted by a browser; the fallback timer still dismisses the overlay.
    });

    return () => window.clearTimeout(fallbackTimer);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`mobile-video-intro ${isExiting ? 'mobile-video-intro--exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="NeuroClass introduction"
    >
      <video
        ref={videoRef}
        className="mobile-video-intro__video"
        src="/neuroclass-mobile-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finishIntro}
        aria-hidden="true"
      />
      <div className="mobile-video-intro__veil" aria-hidden="true" />
      <button type="button" className="mobile-video-intro__skip" onClick={finishIntro}>
        Skip intro
      </button>
    </div>
  );
};

export default MobileVideoIntro;

