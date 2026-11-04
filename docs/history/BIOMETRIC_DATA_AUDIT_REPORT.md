# Biometric Data Audit Report

I have completed a full trace of the face data pipeline across the Cloudflare Pages frontend, Vercel API gateway, Render AI service, and Supabase database.

## Browser Capture and Cache

The browser captures frames from the webcam directly into a temporary `<canvas>` element in memory. It converts the canvas to a JPEG Blob and immediately attaches it to a `FormData` request. The `sendAttendanceFrame` and `uploadFaceSamples` functions send this request to the Vercel backend over a secure HTTPS connection. 

A thorough audit of the frontend repository confirms that `localStorage` is only used for theme settings, role strings, and UI preferences. Neither images nor biometric embeddings are ever saved to `localStorage`, `sessionStorage`, or IndexedDB. No biometric data is stored in the browser cache.

## Vercel API Gateway

The Vercel API acts as a stateless passthrough for the image data. The Vercel routes (`/api/attendance/frame` and `/api/students/face-registration`) receive the JPEG image and validate the teacher's Supabase JSON Web Token (JWT). After authentication, Vercel forwards the image as a multipart payload directly to the Render AI service. Vercel does not save the image to disk or to Supabase. It simply waits for the Render service to return a JSON array of matched student IDs and bounding boxes.

## Render AI Service

The actual biometric processing happens entirely in memory on the Render instance. The Render service decodes the incoming JPEG into memory, where the InsightFace model extracts the 512-dimensional ArcFace embedding. 

For attendance operations, the embedding is compared against the FAISS index in memory. The image and the extracted embedding are discarded immediately after the frame response is sent back to Vercel. For enrollment operations, the embeddings are averaged into a centroid prototype and saved to the local FAISS index for fast matching, as well as to Supabase for persistent storage. The original enrollment images are discarded.

## Supabase Database

Supabase stores the mathematical representation of the face, not the photograph itself. It stores the 512-dimensional centroid vector in the `face_embeddings` table and the attendance log in the `attendance` table. Supabase does not store the raw JPEG photos anywhere in its storage buckets or relational tables.

## Conclusion

Your face data (the actual JPEG image) only exists for a fraction of a second. It is held in the browser's RAM, sent securely over HTTPS to Vercel, forwarded to Render, converted into a numerical vector, and then permanently deleted. The browser cache remains completely clean of any biometric information.
