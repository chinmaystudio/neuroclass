/**
 * Camera Utility for AI Modules
 */
export const CameraService = {
  /**
   * Starts the camera and returns the stream.
   */
  async startCamera(constraints: MediaStreamConstraints = { 
    video: { 
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false 
  }): Promise<MediaStream> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support camera access or you are in an insecure context.");
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error("Camera permission was denied. Please check your browser settings and allow camera access for this site.");
      }
      console.error("Camera Access Error:", error);
      throw error;
    }
  },

  /**
   * Captures a base64 frame from a video element with safety checks.
   */
  captureFrame(video: HTMLVideoElement): string {
    // Ensure video dimensions are valid
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    // Check if video is actually generating a frame
    if (video.readyState < 2) {
      console.warn("[CameraService] Video not ready for capture");
      return "";
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return "";
    
    ctx.drawImage(video, 0, 0, width, height);
    
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Slightly lower quality for smaller payloads
      const parts = dataUrl.split(',');
      if (parts.length < 2) return "";
      
      const base64 = parts[1];
      // Basic sanity check on depth: if shorter than 100 bytes, it's likely a blank/invalid frame
      if (base64.length < 100) {
        console.warn("[CameraService] Captured frame appears empty or too small");
        return "";
      }
      return base64;
    } catch (e) {
      console.error("[CameraService] Frame capture error:", e);
      return "";
    }
  },

  /**
   * Stops all tracks of a stream.
   */
  stopCamera(stream: MediaStream | null) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }
};
