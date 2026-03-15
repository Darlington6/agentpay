import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import dotenv from "dotenv";
dotenv.config();

// Only use PRIVATE_KEY if it looks like a valid 64-char hex string
const key = process.env.PRIVATE_KEY;
const accounts = key && /^[0-9a-fA-F]{64}$/.test(key.replace(/^0x/, ""))
  ? [`0x${key.replace(/^0x/, "")}`]
  : [];

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.24",
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
    base: {
      type: "http",
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts,
    },
    "base-sepolia": {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts,
    },
  },
});
