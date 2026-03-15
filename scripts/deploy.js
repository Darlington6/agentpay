import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  console.log("Deploying AgentPayPolicy...");
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("AgentPayPolicy");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nAgentPayPolicy deployed to:", address);
  console.log("Basescan:", `https://basescan.org/address/${address}`);

  // Save the address for frontend use
  console.log("\nAdd to your .env:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
