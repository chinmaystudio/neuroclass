import React, { useEffect, useState } from 'react';

const INTRO_STORAGE_KEY = 'neuroclass-brand-intro-seen';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export const BrandIntro: React.FC = () => {
  const [isVisible, setIsVisible] = useState(() => {
    if (!canUseStorage()) return true;
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) !== '1';
  });
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!isVisible) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      window.sessionStorage?.setItem(INTRO_STORAGE_KEY, '1');
      setIsVisible(false);
      return undefined;
    }

    const hideIntro = () => {
      setIsExiting(true);
      window.setTimeout(() => {
        window.sessionStorage?.setItem(INTRO_STORAGE_KEY, '1');
        setIsVisible(false);
      }, 380);
    };

    const timer = window.setTimeout(hideIntro, 3620);
    return () => window.clearTimeout(timer);
  }, [isVisible]);

  if (!isVisible) return null;

  const skipIntro = () => {
    setIsExiting(true);
    window.setTimeout(() => {
      window.sessionStorage?.setItem(INTRO_STORAGE_KEY, '1');
      setIsVisible(false);
    }, 180);
  };

  return (
    <div
      className={`brand-intro ${isExiting ? 'brand-intro--exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="NeuroClass brand introduction"
    >
      <div className="brand-intro__ambient brand-intro__ambient--one" />
      <div className="brand-intro__ambient brand-intro__ambient--two" />
      <div className="brand-intro__grid" aria-hidden="true" />
      <div className="brand-intro__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="brand-intro__content">
        <div className="brand-intro__logo-shell">
          <div className="brand-intro__logo-trace" aria-hidden="true" />
          <img className="brand-intro__logo" src="/logo-dark.png" alt="" />
        </div>
        <p className="brand-intro__name">NEUROCLASS</p>
        <p className="brand-intro__product">AN ORYNEX PRODUCT</p>
        <div className="brand-intro__divider" aria-hidden="true" />
        <p className="brand-intro__slogan">Intelligence for the Classroom</p>
      </div>

      <button type="button" className="brand-intro__skip" onClick={skipIntro}>
        Skip intro
      </button>
    </div>
  );
};

export default BrandIntro;

