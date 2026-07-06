import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VOTING_ABI } from "./abi";
import { VOTING_ADDRESS, RELAYER_URL } from "./wagmi";

export default function App() {
  const { address, isConnected } = useAccount();
  const [choice, setChoice] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  useWaitForTransactionReceipt({ hash: txHash });

  const candidates = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "getCandidates" });
  const isOpen = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "open" });
  const revealed = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "revealed" });
  const results = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "getResults" });
  const voterCount = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "voterCount" });
  const admin = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "admin" });
  const hasVoted = useReadContract({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "hasVoted", args: address ? [address] : undefined });

  const list = (candidates.data as string[]) || [];
  const isAdmin = admin.data && address && (admin.data as string).toLowerCase() === address.toLowerCase();

  async function castVote() {
    if (choice === null) return;
    try {
      setStatus("🔒 Encrypting your ballot in the relayer (FHE)…");
      // The relayer encrypts a one-hot ballot with the FHE public key and returns the on-chain handles.
      const r = await fetch(`${RELAYER_URL}/encrypt-ballot`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, n: list.length }),
      });
      const { handles } = await r.json();
      setStatus("✍️ Confirm the transaction in your wallet…");
      const hash = await writeContractAsync({
        address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "vote", args: [handles, "0x"],
      });
      setTxHash(hash);
      setStatus(`✅ Confidential vote submitted! Only the final tally will ever be revealed. tx: ${hash.slice(0, 12)}…`);
    } catch (e: any) {
      setStatus(`❌ ${e.shortMessage || e.message}`);
    }
  }

  async function closeVoting() {
    try {
      setStatus("Closing voting…");
      const hash = await writeContractAsync({ address: VOTING_ADDRESS, abi: VOTING_ABI, functionName: "close" });
      setTxHash(hash);
      setStatus(`Voting closed. The relayer will decrypt & post the tallies shortly. tx: ${hash.slice(0, 12)}…`);
    } catch (e: any) { setStatus(`❌ ${e.shortMessage || e.message}`); }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div>
            <h1 style={S.h1}>fhish · Confidential Voting</h1>
            <p style={S.sub}>Fully Homomorphic Encryption on Flare Coston2 · your ballot stays secret</p>
          </div>
          <ConnectButton />
        </div>

        {!isConnected ? (
          <p style={S.muted}>Connect a wallet to vote. You'll need Coston2 C2FLR (faucet.flare.network).</p>
        ) : (
          <>
            <div style={S.metaRow}>
              <span>Voters: <b>{voterCount.data?.toString() ?? "…"}</b></span>
              <span>Status: <b>{isOpen.data ? "🟢 open" : "🔴 closed"}</b></span>
            </div>

            {isOpen.data && !hasVoted.data && (
              <>
                <div style={S.candidates}>
                  {list.map((c, i) => (
                    <button key={i} onClick={() => setChoice(i)} style={{ ...S.candidate, ...(choice === i ? S.candidateSel : {}) }}>
                      {c}
                    </button>
                  ))}
                </div>
                <button onClick={castVote} disabled={choice === null} style={S.vote}>🔒 Vote confidentially</button>
              </>
            )}
            {hasVoted.data && <p style={S.ok}>✓ You've cast your confidential ballot.</p>}
            {!isOpen.data && !revealed.data && <p style={S.muted}>Voting closed — decrypting the tally…</p>}

            {revealed.data && (
              <div style={S.results}>
                <h3>Final tally</h3>
                {list.map((c, i) => (
                  <div key={i} style={S.resultRow}><span>{c}</span><b>{(results.data as bigint[])?.[i]?.toString() ?? "0"}</b></div>
                ))}
              </div>
            )}

            {isAdmin && isOpen.data && <button onClick={closeVoting} style={S.close}>Close voting (admin)</button>}
            {status && <p style={S.status}>{status}</p>}
          </>
        )}
        <p style={S.foot}>
          Relayer: <code>{RELAYER_URL}</code> · Contract:{" "}
          <a href={`https://coston2-explorer.flare.network/address/${VOTING_ADDRESS}`} target="_blank">{VOTING_ADDRESS.slice(0, 10)}…</a>
        </p>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0e14", color: "#e6e6e6", fontFamily: "ui-sans-serif, system-ui" },
  card: { width: 520, maxWidth: "92vw", background: "#141922", border: "1px solid #232a36", borderRadius: 16, padding: 28 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  h1: { margin: 0, fontSize: 22 }, sub: { margin: "4px 0 0", color: "#8b97a8", fontSize: 13 },
  muted: { color: "#8b97a8" }, ok: { color: "#5ad19a" },
  metaRow: { display: "flex", gap: 20, color: "#b7c0ce", fontSize: 14, marginBottom: 16 },
  candidates: { display: "grid", gap: 10, marginBottom: 16 },
  candidate: { padding: "14px 16px", borderRadius: 10, border: "1px solid #2b3444", background: "#1a2130", color: "#e6e6e6", cursor: "pointer", textAlign: "left", fontSize: 15 },
  candidateSel: { borderColor: "#e8622c", background: "#2a1c16" },
  vote: { width: "100%", padding: 14, borderRadius: 10, border: "none", background: "#e8622c", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 },
  close: { width: "100%", padding: 12, marginTop: 12, borderRadius: 10, border: "1px solid #2b3444", background: "transparent", color: "#b7c0ce", cursor: "pointer" },
  results: { marginTop: 8, background: "#0f141d", borderRadius: 10, padding: 16 },
  resultRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1c2430" },
  status: { marginTop: 14, fontSize: 13, color: "#b7c0ce", wordBreak: "break-all" },
  foot: { marginTop: 20, fontSize: 11, color: "#5b6675", wordBreak: "break-all" },
};
