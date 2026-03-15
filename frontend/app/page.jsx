"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEther, formatEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/lib/contract";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  function handleConnect() {
    if (typeof window === "undefined") return;
    if (!window.ethereum) {
      alert("No wallet detected. Please enable Brave Wallet or install a browser wallet extension.");
      return;
    }
    connect({ connector: injected() });
  }
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [inputError, setInputError] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function parseEthAmount(val) {
    return parseEther((val || "0").replace(/,/g, ""));
  }

  const [form, setForm] = useState({
    agentAddress: "",
    maxPerTx: "",
    dailyLimit: "",
    approvedRecipients: "",
  });

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payments, setPayments] = useState([]);

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: "Payment",
    onLogs(logs) {
      const newPayments = logs.map((log) => ({
        txHash: log.transactionHash,
        to: log.args.to,
        amount: log.args.amount,
        memo: log.args.memo,
      }));
      setPayments((prev) => [...newPayments, ...prev].slice(0, 20));
    },
    enabled: !!CONTRACT_ADDRESS,
  });

  const { data: policy } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getPolicy",
    args: [address],
    query: { enabled: !!address && !!CONTRACT_ADDRESS },
  });

  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getContractBalance",
    query: { enabled: !!CONTRACT_ADDRESS },
  });

  function handleSetPolicy() {
    setInputError("");
    try {
      const recipients = form.approvedRecipients
        ? form.approvedRecipients.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "setPolicy",
        args: [
          form.agentAddress,
          parseEthAmount(form.maxPerTx),
          parseEthAmount(form.dailyLimit),
          recipients,
        ],
      });
    } catch (e) {
      setInputError(e.shortMessage || e.message);
    }
  }

  function handleDeposit() {
    setInputError("");
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "deposit",
        value: parseEthAmount(depositAmount),
      });
    } catch (e) {
      setInputError(e.shortMessage || e.message);
    }
  }

  function handleWithdraw() {
    setInputError("");
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setInputError("Enter a withdrawal amount greater than 0.");
      return;
    }
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "withdraw",
        args: [parseEthAmount(withdrawAmount)],
      });
    } catch (e) {
      setInputError(e.shortMessage || e.message);
    }
  }

  function handleDeactivate() {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "deactivatePolicy",
    });
  }

  function handleReactivate() {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "reactivatePolicy",
    });
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AgentPay</h1>
            <p className="text-gray-400 text-sm">AI agent spending policies on Base</p>
          </div>
          {mounted && isConnected ? (
            <button
              onClick={() => disconnect()}
              className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleConnect}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Connect Wallet
              </button>
              {connectError && (
                <p className="text-red-400 text-xs">{connectError.message}</p>
              )}
            </div>
          )}
        </div>

        {mounted && !isConnected && (
          <div className="bg-gray-900 rounded-xl p-6 text-center text-gray-400">
            Connect your wallet to manage agent spending policies.
          </div>
        )}

        {mounted && isConnected && (
          <>
            {/* Current Policy */}
            {policy && policy.agent !== "0x0000000000000000000000000000000000000000" && policy.maxPerTx !== undefined && (
              <div className="bg-gray-900 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Active Policy</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${policy.active ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"}`}>
                    {policy.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-400">Agent:</span> <span className="font-mono">{policy.agent}</span></p>
                  <p><span className="text-gray-400">Max per tx:</span> {formatEther(policy.maxPerTx)} ETH</p>
                  <p><span className="text-gray-400">Daily limit:</span> {formatEther(policy.dailyLimit)} ETH</p>
                  <p><span className="text-gray-400">Spent today:</span> {formatEther(policy.spentToday)} ETH</p>
                  <p><span className="text-gray-400">Remaining today:</span> {formatEther(policy.remainingToday)} ETH</p>
                </div>
                <div className="flex gap-2 pt-2">
                  {policy.active ? (
                    <button onClick={handleDeactivate} className="text-sm bg-red-900 hover:bg-red-800 px-3 py-1.5 rounded-lg">
                      Pause Policy
                    </button>
                  ) : (
                    <button onClick={handleReactivate} className="text-sm bg-green-900 hover:bg-green-800 px-3 py-1.5 rounded-lg">
                      Resume Policy
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Contract Balance */}
            {balance !== undefined && (
              <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Contract Balance</span>
                <span className="font-mono font-semibold">{formatEther(balance)} ETH</span>
              </div>
            )}

            {/* Set Policy */}
            <div className="bg-gray-900 rounded-xl p-6 space-y-4">
              <h2 className="font-semibold">Set Spending Policy</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Agent Address</label>
                  <input
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0x..."
                    value={form.agentAddress}
                    onChange={(e) => setForm({ ...form, agentAddress: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Max per transaction (ETH)</label>
                    <input
                      className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0.1"
                      value={form.maxPerTx}
                      onChange={(e) => setForm({ ...form, maxPerTx: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Daily limit (ETH)</label>
                    <input
                      className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0.5"
                      value={form.dailyLimit}
                      onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Approved Recipients (comma-separated, blank = anyone)</label>
                  <input
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0x..., 0x..."
                    value={form.approvedRecipients}
                    onChange={(e) => setForm({ ...form, approvedRecipients: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleSetPolicy}
                  disabled={isPending || isConfirming}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {isPending ? "Confirming..." : isConfirming ? "Processing..." : "Set Policy"}
                </button>
              </div>
            </div>

            {/* Deposit */}
            <div className="bg-gray-900 rounded-xl p-6 space-y-3">
              <h2 className="font-semibold">Deposit ETH</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Amount in ETH"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <button
                  onClick={handleDeposit}
                  disabled={isPending || isConfirming}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Deposit
                </button>
              </div>
            </div>

            {/* Withdraw */}
            <div className="bg-gray-900 rounded-xl p-6 space-y-3">
              <h2 className="font-semibold">Withdraw ETH</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Amount in ETH"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <button
                  onClick={handleWithdraw}
                  disabled={isPending || isConfirming}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Withdraw
                </button>
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-6 space-y-3">
                <h2 className="font-semibold">Recent Payments</h2>
                <div className="space-y-2">
                  {payments.map((p, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-gray-300 truncate">→ {p.to}</p>
                        <p className="text-gray-500 text-xs truncate">{p.memo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-green-400">{formatEther(p.amount)} ETH</p>
                        <a
                          href={`https://sepolia.basescan.org/tx/${p.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                        >
                          tx
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {(inputError || writeError) && (
              <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 text-sm text-red-300">
                {inputError || writeError?.shortMessage || writeError?.message}
              </div>
            )}

            {/* Tx status */}
            {isSuccess && (
              <div className="bg-green-900/50 border border-green-700 rounded-xl p-4 text-sm text-green-300">
                Transaction confirmed!{" "}
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View on Basescan
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
