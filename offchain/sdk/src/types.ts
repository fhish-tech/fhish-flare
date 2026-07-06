export interface FhishConfig {
  gatewayAddress?: string;
  gatewayContractAddress?: string;
  networkPublicKey?: string;
  chainId?: number;
  kmsAddress?: string;
  aclAddress?: string;
}

export interface FhishPermit {
  publicKey: string;
  signature: string;
  privateKey: string;
}
