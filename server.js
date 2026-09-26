import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import crearPedidoHandler from './netlify/functions/crear-pedido.js';

const app = express();
// Dev server in AI Studio must listen strictly on port 3000
const PORT = 3000;

app.use(express.json());

// Emulador local para Netlify Function en preview/desarrollo
app.post('/.netlify/functions/crear-pedido', async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const webReq = new Request(url, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        ...(req.headers['x-forwarded-for'] ? { 'x-forwarded-for': req.headers['x-forwarded-for'] } : {})
      },
      body: JSON.stringify(req.body)
    });
    const webRes = await crearPedidoHandler(webReq);
    const bodyText = await webRes.text();
    res.status(webRes.status);
    webRes.headers.forEach((val, key) => res.set(key, val));
    res.send(bodyText);
  } catch (err) {
    console.error('[LOCAL SERVER] Error ejecutando crear-pedido:', err);
    res.status(500).json({ success: false, code: 'INTERNAL', error: err.message });
  }
});

// Serve static assets and files from the root directory
app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Alfa Materiales server running on http://0.0.0.0:${PORT}`);
});
