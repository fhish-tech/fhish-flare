import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  initFhe,
  isInitialized,
  fheAdd,
  fheSub,
  fheMul,
  fheEq,
  fheNe,
  fheGt,
  fheGe,
  fheLt,
  fheLe,
  fheIfThenElse,
  fheNeg,
  trivialEncrypt
} from '../services/fhe.js';
import type { FheType, ComputationResult } from '../types/index.js';

const router = Router();

const typeMap: Record<string, FheType['type']> = {
  'bool': 'ebool',
  'ebool': 'ebool',
  'uint8': 'euint8',
  'euint8': 'euint8',
  'uint16': 'euint16',
  'euint16': 'euint16',
  'uint32': 'euint32',
  'euint32': 'euint32',
  'uint64': 'euint64',
  'euint64': 'euint64',
  'uint128': 'euint128',
  'euint128': 'euint128',
  'uint256': 'euint256',
  'euint256': 'euint256',
};

function parseType(type: string): FheType['type'] {
  return typeMap[type.toLowerCase()] || 'euint32';
}

function handleResult(requestId: string, result: string, operation: string, type: string): ComputationResult {
  const handle = '0x' + Buffer.from(JSON.stringify({ requestId, result })).toString('hex').slice(0, 64).padEnd(64, '0');
  return {
    requestId,
    result,
    handle: result,
    operation,
    type: parseType(type),
    timestamp: Date.now()
  };
}

router.post('/init', async (_req: Request, res: Response) => {
  try {
    const wasmPath = _req.query.wasm as string;
    await initFhe(wasmPath);
    res.json({ status: 'initialized', message: 'FHE service ready' });
  } catch (error: any) {
    console.error('[FHE Routes] Init error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', (_req: Request, res: Response) => {
  res.json({ initialized: isInitialized() });
});

router.post('/add', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    console.log(`[FHE Routes] add: lhs=${lhs?.slice(0, 20)}..., rhs=${rhs?.slice(0, 20)}..., type=${type}`);
    
    const result = fheAdd(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'add', type));
  } catch (error: any) {
    console.error('[FHE Routes] Add error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sub', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    console.log(`[FHE Routes] sub: lhs=${lhs?.slice(0, 20)}..., rhs=${rhs?.slice(0, 20)}..., type=${type}`);
    
    const result = fheSub(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'sub', type));
  } catch (error: any) {
    console.error('[FHE Routes] Sub error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/mul', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    console.log(`[FHE Routes] mul: lhs=${lhs?.slice(0, 20)}..., rhs=${rhs?.slice(0, 20)}..., type=${type}`);
    
    const result = fheMul(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'mul', type));
  } catch (error: any) {
    console.error('[FHE Routes] Mul error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/eq', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheEq(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'eq', type));
  } catch (error: any) {
    console.error('[FHE Routes] Eq error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ne', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheNe(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'ne', type));
  } catch (error: any) {
    console.error('[FHE Routes] Ne error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/gt', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheGt(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'gt', type));
  } catch (error: any) {
    console.error('[FHE Routes] Gt error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ge', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheGe(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'ge', type));
  } catch (error: any) {
    console.error('[FHE Routes] Ge error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/lt', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheLt(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'lt', type));
  } catch (error: any) {
    console.error('[FHE Routes] Lt error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/le', (req: Request, res: Response) => {
  try {
    const { lhs, rhs, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheLe(lhs, rhs, parseType(type));
    res.json(handleResult(requestId, result, 'le', type));
  } catch (error: any) {
    console.error('[FHE Routes] Le error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ifthenelse', (req: Request, res: Response) => {
  try {
    const { control, ifTrue, ifFalse, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    console.log(`[FHE Routes] ifthenelse: control=${control?.slice(0, 20)}..., type=${type}`);
    
    const result = fheIfThenElse(control, ifTrue, ifFalse, parseType(type));
    res.json(handleResult(requestId, result, 'ifthenelse', type));
  } catch (error: any) {
    console.error('[FHE Routes] IfThenElse error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/neg', (req: Request, res: Response) => {
  try {
    const { ct, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    const result = fheNeg(ct, parseType(type));
    res.json(handleResult(requestId, result, 'neg', type));
  } catch (error: any) {
    console.error('[FHE Routes] Neg error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/trivial-encrypt', (req: Request, res: Response) => {
  try {
    const { value, type = 'euint32' } = req.body;
    const requestId = uuidv4();
    
    console.log(`[FHE Routes] trivial-encrypt: value=${value}, type=${type}`);
    
    const result = trivialEncrypt(value, parseType(type));
    res.json(handleResult(requestId, result, 'trivial-encrypt', type));
  } catch (error: any) {
    console.error('[FHE Routes] TrivialEncrypt error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch-add', async (req: Request, res: Response) => {
  try {
    const { operands, type = 'euint32' } = req.body;
    
    if (!Array.isArray(operands) || operands.length < 2) {
      res.status(400).json({ error: 'Need at least 2 operands' });
      return;
    }
    
    console.log(`[FHE Routes] batch-add: ${operands.length} operands, type=${type}`);
    
    let result = operands[0];
    for (let i = 1; i < operands.length; i++) {
      result = fheAdd(result, operands[i], parseType(type));
    }
    
    const requestId = uuidv4();
    res.json(handleResult(requestId, result, 'batch-add', type));
  } catch (error: any) {
    console.error('[FHE Routes] BatchAdd error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
