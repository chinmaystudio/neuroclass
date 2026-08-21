import { execSync } from 'child_process';
import { mkdirSync, cpSync, writeFileSync } from 'fs';

console.log('=== Vercel Build: Starting ===');

// Build frontend with Vite
console.log('Building frontend with Vite...');
execSync('npx vite build', { stdio: 'inherit' });

// Create Vercel Build Output API structure
console.log('Creating Vercel Build Output structure...');
mkdirSync('.vercel/output/static', { recursive: true });
cpSync('dist', '.vercel/output/static', { recursive: true });

const backendUrl = (process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
const routes = [
  { handle: 'filesystem' }
];

if (backendUrl && !backendUrl.includes('localhost') && !backendUrl.includes('127.0.0.1')) {
  console.log(`Adding API proxy rewrite rule to ${backendUrl}...`);
  routes.push({ src: '/api/(.*)', dest: `${backendUrl}/api/$1` });
}

routes.push({ src: '/(.*)', dest: '/index.html' });

writeFileSync('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes
}, null, 2));

console.log('=== Vercel Build: Complete ===');
