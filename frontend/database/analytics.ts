import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = (import.meta as any).env.VITE_GA_MEASUREMENT_ID;

export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log("[Analytics] Initialized GA4");
  } else {
    console.warn("[Analytics] Measurement ID missing, GA4 disabled");
  }
};

export const logPageView = (path: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.send({ hitType: "pageview", page: path });
  }
};

export const logEvent = (category: string, action: string, label?: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category,
      action,
      label,
    });
  }
};

export const logMalpracticeDetected = (type: string, reason: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category: "Proctoring",
      action: "Malpractice Detected",
      label: `${type}: ${reason}`,
    });
  }
};

export const logClassroomCreated = (className: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category: "Management",
      action: "Classroom Created",
      label: className,
    });
  }
};
