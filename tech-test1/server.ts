import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // In-memory store for local demo
  const tests: any[] = [];

  // API Routes
  app.get('/api/tests', (req, res) => {
    res.json(tests);
  });

  app.post('/api/tests', (req, res) => {
    const newTest = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...req.body
    };
    tests.push(newTest);
    res.status(201).json(newTest);
  });

  app.get('/api/tests/:id', (req, res) => {
    const test = tests.find(t => t.id === req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  });

  app.put('/api/tests/:id', (req, res) => {
    const index = tests.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Test not found' });
    tests[index] = { ...tests[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(tests[index]);
  });

  app.delete('/api/tests/:id', (req, res) => {
    const index = tests.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Test not found' });
    tests.splice(index, 1);
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
