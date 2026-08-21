// Server-side Analytics Helper (No-op / Safe Server Logger)

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || process.env.VITE_GA_MEASUREMENT_ID;

export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    console.log("[Backend Analytics] GA4 Measurement ID configured:", GA_MEASUREMENT_ID);
  }
};

export const logPageView = (path: string) => {
  console.log(`[Backend Analytics] Pageview: ${path}`);
};

export const logEvent = (category: string, action: string, label?: string) => {
  console.log(`[Backend Analytics] Event: ${category} -> ${action} (${label || 'N/A'})`);
};

export const logMalpracticeDetected = (type: string, reason: string) => {
  console.log(`[Backend Analytics] Malpractice: ${type} - ${reason}`);
};

export const logClassroomCreated = (className: string) => {
  console.log(`[Backend Analytics] Classroom Created: ${className}`);
};
