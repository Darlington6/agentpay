/**
 * Bridge ETH from Ethereum Sepolia → Base Sepolia
 * Uses the official Optimism portal — no browser wallet needed.
 *
 * Usage: node scripts/bridge-to-sepolia.js
 */

import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// Official Base Sepolia L1StandardBridge on Ethereum Sepolia
const L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const BRIDGE_ABI = [
  "function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable",
];
const AMOUNT = ethers.parseEther("0.05");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const bridge = new ethers.Contract(L1_BRIDGE, BRIDGE_ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log("Wallet:", wallet.address);
  console.log("Sepolia balance:", ethers.formatEther(balance), "ETH");

  if (balance < AMOUNT) {
    throw new Error(`Insufficient balance. Have ${ethers.formatEther(balance)} ETH, need 0.05`);
  }

  console.log("\nBridging 0.05 ETH to Base Sepolia...");
  const tx = await bridge.depositETH(200000, "0x", { value: AMOUNT });

  console.log("Tx submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();
  console.log("✓ Done! ETH will arrive on Base Sepolia in ~2 minutes.");
  console.log(`Track it: https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
