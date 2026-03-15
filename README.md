# AgentPay

**Programmable spending policies for AI agents on Base.**

AgentPay lets humans define strict ETH spending rules that AI agents must operate within — per-transaction limits, daily caps, and recipient whitelists — all enforced on-chain by a smart contract. No trust required.

## The Problem

AI agents need to spend money autonomously (subscriptions, APIs, services). But giving an agent an unrestricted wallet is dangerous. AgentPay solves this by putting a human-controlled policy between the agent and the funds.

## How It Works

```
Human → sets policy (maxPerTx, dailyLimit, agentAddress) → deposits ETH
Agent → calls pay() → contract enforces limits → ETH transfers to recipient
```

1. **Human** connects wallet, sets a spending policy, and deposits ETH via the frontend
2. **Agent** calls the contract's `pay()` function with a recipient, amount, and memo
3. **Contract** enforces all limits and reverts with a clear error if any rule is broken

## Project Structure

```
agentpay/
├── contracts/
│   └── AgentPayPolicy.sol   # Core smart contract
├── scripts/
│   └── deploy.js            # Deployment script
├── test/
│   └── AgentPayPolicy.test.js
├── agent/
│   └── pay.js               # AI agent payment CLI
└── frontend/                # Next.js dashboard
    └── app/
        ├── page.jsx         # Main UI
        └── providers.jsx    # Wagmi config
```

## Quick Start

### 1. Install dependencies

```bash
npm install          # root (Hardhat + ethers)
cd frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, AGENT_PRIVATE_KEY, and RPC URLs
```

### 3. Local development

Terminal 1 — start local blockchain:
```bash
npx hardhat node
```

Terminal 2 — deploy contract:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Terminal 3 — start frontend:
```bash
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Brave Browser (or any browser with a wallet extension).

### 4. Test the agent

```bash
node agent/pay.js \
  --owner <owner-address> \
  --to <recipient-address> \
  --amount 0.05 \
  --memo "paying for API subscription"
```

## Deploy to Base Sepolia

```bash
npm run deploy:testnet
```

Update `NEXT_PUBLIC_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS` in `.env` with the deployed address.

## Smart Contract

**`AgentPayPolicy.sol`** — deployed on Base Sepolia

| Function | Caller | Description |
|---|---|---|
| `setPolicy(agent, maxPerTx, dailyLimit, approvedTo[])` | Owner | Create or update spending policy |
| `deposit()` | Owner | Fund the contract |
| `withdraw(amount)` | Owner | Withdraw ETH |
| `deactivatePolicy()` | Owner | Pause agent spending |
| `reactivatePolicy()` | Owner | Resume agent spending |
| `pay(owner, to, amount, memo)` | Agent | Execute a payment within policy limits |
| `getPolicy(owner)` | Anyone | Read policy state |

**Custom errors** (all revert with descriptive messages):
- `ExceedsPerTxLimit` — payment exceeds single-tx cap
- `ExceedsDailyLimit` — payment would exceed 24-hour cap
- `RecipientNotApproved` — recipient not on whitelist
- `InsufficientBalance` — contract doesn't have enough ETH
- `Unauthorized` — caller is not the authorized agent
- `PolicyNotActive` — policy is paused

## Agent CLI

```bash
node agent/pay.js --owner <addr> --to <addr> --amount <eth> --memo "reason"
```

The agent script:
1. Reads the owner's policy from chain
2. Displays current limits and spend status
3. Submits the payment transaction
4. Returns a confirmation with block number

## Built With

- [Solidity 0.8.24](https://soliditylang.org) — smart contract
- [Hardhat](https://hardhat.org) — development and testing
- [Base](https://base.org) — L2 deployment target
- [Next.js](https://nextjs.org) + [wagmi](https://wagmi.sh) + [viem](https://viem.sh) — frontend
- [ethers.js](https://ethers.org) — agent script

## The Synthesis Hackathon

Built for [The Synthesis Hackathon](https://synthesis.ai) — March 2026.
