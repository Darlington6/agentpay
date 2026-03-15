/**
 * AgentPay — AI Agent Payment Script
 *
 * This script is the "agent" side: it reads a spending policy from the
 * AgentPayPolicy contract and executes on-chain payments within the
 * human-defined limits.
 *
 * Usage:
 *   node agent/pay.js --owner <owner-address> --to <recipient> --amount <eth> --memo "reason"
 *
 * Environment variables required:
 *   AGENT_PRIVATE_KEY  — private key of the agent's wallet
 *   BASE_SEPOLIA_RPC_URL (or BASE_RPC_URL for mainnet)
 *   CONTRACT_ADDRESS
 */

import { ethers } from "ethers";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace("--", "")] = args[i + 1];
}

const { owner, to, amount, memo = "agent payment" } = flags;

if (!owner || !to || !amount) {
  console.error("Usage: node agent/pay.js --owner <addr> --to <addr> --amount <eth> --memo <string>");
  process.exit(1);
}

async function main() {
  const rpcUrl = process.env.LOCAL_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL || "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const agentKey = process.env.AGENT_PRIVATE_KEY;
  if (!agentKey) {
    throw new Error("AGENT_PRIVATE_KEY not set in .env");
  }
  const agent = new ethers.Wallet(agentKey, provider);

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS not set in .env");
  }

  // Load ABI
  const abiPath = join(__dirname, "../artifacts/contracts/AgentPayPolicy.sol/AgentPayPolicy.json");
  const artifact = JSON.parse(await readFile(abiPath, "utf8"));
  const contract = new ethers.Contract(contractAddress, artifact.abi, agent);

  // Read policy before paying
  const policy = await contract.getPolicy(owner);
  console.log("\n── Policy Check ──────────────────────────");
  console.log("Agent:          ", policy.agent);
  console.log("Max per tx:     ", ethers.formatEther(policy.maxPerTx), "ETH");
  console.log("Daily limit:    ", ethers.formatEther(policy.dailyLimit), "ETH");
  console.log("Spent today:    ", ethers.formatEther(policy.spentToday), "ETH");
  console.log("Remaining today:", ethers.formatEther(policy.remainingToday), "ETH");
  console.log("Active:         ", policy.active);
  console.log("──────────────────────────────────────────\n");

  if (!policy.active) {
    throw new Error("Policy is paused by the owner. Payment blocked.");
  }

  const weiAmount = ethers.parseEther(amount);

  console.log(`Sending ${amount} ETH to ${to}...`);
  console.log(`Memo: ${memo}`);

  const tx = await contract.pay(owner, to, weiAmount, memo);
  console.log("Tx submitted:", tx.hash);

  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
  console.log(`Basescan: https://sepolia.basescan.org/tx/${tx.hash}`);
}

function decodeError(err) {
  // Try ethers built-in reason first
  if (err.reason) return err.reason;

  // Decode known custom errors by their 4-byte selector
  const data = err.data || err.error?.data;
  if (data && typeof data === "string" && data.length >= 10) {
    const iface = new ethers.Interface([
      "error Unauthorized()",
      "error PolicyNotActive()",
      "error ExceedsPerTxLimit(uint256 requested, uint256 limit)",
      "error ExceedsDailyLimit(uint256 requested, uint256 remaining)",
      "error RecipientNotApproved(address to)",
      "error InsufficientBalance(uint256 balance, uint256 requested)",
      "error TransferFailed()",
    ]);
    try {
      const decoded = iface.parseError(data);
      if (!decoded) return err.message;
      switch (decoded.name) {
        case "Unauthorized":
          return "Payment blocked: this agent is not authorized for that owner.";
        case "PolicyNotActive":
          return "Payment blocked: the owner has paused their policy.";
        case "ExceedsPerTxLimit":
          return `Payment blocked: ${ethers.formatEther(decoded.args[0])} ETH exceeds the per-tx limit of ${ethers.formatEther(decoded.args[1])} ETH.`;
        case "ExceedsDailyLimit":
          return `Payment blocked: ${ethers.formatEther(decoded.args[0])} ETH exceeds the remaining daily limit of ${ethers.formatEther(decoded.args[1])} ETH.`;
        case "RecipientNotApproved":
          return `Payment blocked: recipient ${decoded.args[0]} is not on the approved list.`;
        case "InsufficientBalance":
          return `Payment blocked: contract only has ${ethers.formatEther(decoded.args[0])} ETH, but ${ethers.formatEther(decoded.args[1])} ETH was requested.`;
        case "TransferFailed":
          return "Payment blocked: ETH transfer failed on-chain.";
        default:
          return decoded.name;
      }
    } catch (_) {}
  }
  return err.message;
}

main().catch((err) => {
  console.error("\nPayment failed:", decodeError(err));
  process.exit(1);
});
