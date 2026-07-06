import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import fheRoutes from './routes/fhe.js';
import { initFhe, isInitialized } from './services/fhe.js';

const PORT = process.env.PORT || 8082;
const WASM_PORT = process.env.WASM_PORT || 8083;

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/fhe', fheRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'fhish-coprocessor',
    fheInitialized: isInitialized(),
    uptime: process.uptime()
  });
});

app.get('/ready', (_req: Request, res: Response) => {
  if (isInitialized()) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, message: 'FHE not initialized' });
  }
});

async function start() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         FHISH COPROCESSOR SERVICE ★                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  
  console.log(`\n[COPROCESSOR] Initializing FHE service (WASM port ${WASM_PORT})...`);
  
  try {
    await initFhe(parseInt(WASM_PORT, 10));
    console.log('[COPROCESSOR] ✓ FHE initialized successfully');
  } catch (error: any) {
    console.error('[COPROCESSOR] ✗ FHE init failed:', error.message);
    console.error('[COPROCESSOR] Stack:', error.stack);
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log(`\n[COPROCESSOR] ★ Server running on http://localhost:${PORT}`);
    console.log(`[COPROCESSOR] Endpoints:`);
    console.log(`  GET  /health             - Health check`);
    console.log(`  GET  /ready              - Readiness check`);
    console.log(`  POST /fhe/init           - Initialize FHE`);
    console.log(`  GET  /fhe/status        - Check FHE status`);
    console.log(`  POST /fhe/add            - FHE Addition`);
    console.log(`  POST /fhe/sub            - FHE Subtraction`);
    console.log(`  POST /fhe/mul            - FHE Multiplication`);
    console.log(`  POST /fhe/eq             - FHE Equality`);
    console.log(`  POST /fhe/ne             - FHE Not Equal`);
    console.log(`  POST /fhe/gt             - FHE Greater Than`);
    console.log(`  POST /fhe/ge             - FHE Greater or Equal`);
    console.log(`  POST /fhe/lt             - FHE Less Than`);
    console.log(`  POST /fhe/le             - FHE Less or Equal`);
    console.log(`  POST /fhe/ifthenelse     - FHE Conditional`);
    console.log(`  POST /fhe/neg            - FHE Negation`);
    console.log(`  POST /fhe/trivial-encrypt - Plaintext encryption`);
    console.log(`  POST /fhe/batch-add      - Batch addition`);
  });
}

start().catch((err) => {
  console.error('[COPROCESSOR] Failed to start:', err);
  process.exit(1);
});
