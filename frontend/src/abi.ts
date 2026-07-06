export const VOTING_ABI = [
  { type: "function", name: "getCandidates", stateMutability: "view", inputs: [], outputs: [{ type: "string[]" }] },
  { type: "function", name: "candidateCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "hasVoted", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "voterCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "open", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "revealed", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "admin", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "getResults", stateMutability: "view", inputs: [], outputs: [{ type: "uint32[]" }] },
  { type: "function", name: "vote", stateMutability: "nonpayable", inputs: [{ name: "encVotes", type: "bytes32[]" }, { name: "proof", type: "bytes" }], outputs: [] },
  { type: "function", name: "close", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;
