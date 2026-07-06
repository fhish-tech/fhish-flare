export interface FheType {
  type: 'ebool' | 'euint8' | 'euint16' | 'euint32' | 'euint64' | 'euint128' | 'euint256';
}

export interface ComputationRequest {
  lhs: string;
  rhs?: string;
  scalar?: string | number;
  type: FheType['type'];
  proof?: string;
}

export interface ComputationResult {
  requestId: string;
  result: string;
  handle: string;
  operation: string;
  type: FheType['type'];
  timestamp: number;
}

export interface CiphertextStore {
  [handle: string]: {
    ciphertext: Uint8Array;
    type: FheType['type'];
    createdAt: number;
  };
}

export interface ServerKeyStore {
  [type: string]: any;
}

export interface ComputationJob {
  id: string;
  operation: string;
  inputs: string[];
  type: FheType['type'];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}
