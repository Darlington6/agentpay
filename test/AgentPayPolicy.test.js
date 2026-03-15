import { expect } from "chai";
import { network } from "hardhat";
import { parseEther } from "ethers";

describe("AgentPayPolicy", function () {
  let ethers;
  let contract;
  let owner, agent, recipient, other;
  const ONE_ETH = parseEther("1");
  const HALF_ETH = parseEther("0.5");
  const QUARTER_ETH = parseEther("0.25");

  before(async function () {
    ({ ethers } = await network.connect());
  });

  beforeEach(async function () {
    [owner, agent, recipient, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentPayPolicy");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  describe("Policy Setup", function () {
    it("allows owner to set a policy", async function () {
      await contract.connect(owner).setPolicy(agent.address, HALF_ETH, ONE_ETH, []);
      const policy = await contract.getPolicy(owner.address);
      expect(policy.agent).to.equal(agent.address);
      expect(policy.maxPerTx).to.equal(HALF_ETH);
      expect(policy.dailyLimit).to.equal(ONE_ETH);
      expect(policy.active).to.be.true;
    });

    it("maps agent back to owner", async function () {
      await contract.connect(owner).setPolicy(agent.address, HALF_ETH, ONE_ETH, []);
      expect(await contract.agentToOwner(agent.address)).to.equal(owner.address);
    });

    it("allows owner to deactivate and reactivate policy", async function () {
      await contract.connect(owner).setPolicy(agent.address, HALF_ETH, ONE_ETH, []);
      await contract.connect(owner).deactivatePolicy();
      expect((await contract.getPolicy(owner.address)).active).to.be.false;
      await contract.connect(owner).reactivatePolicy();
      expect((await contract.getPolicy(owner.address)).active).to.be.true;
    });
  });

  describe("Deposits & Withdrawals", function () {
    it("accepts ETH deposits", async function () {
      await contract.connect(owner).deposit({ value: ONE_ETH });
      expect(await contract.getContractBalance()).to.equal(ONE_ETH);
    });

    it("allows owner to withdraw", async function () {
      await contract.connect(owner).deposit({ value: ONE_ETH });
      const before = await ethers.provider.getBalance(owner.address);
      const tx = await contract.connect(owner).withdraw(HALF_ETH);
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);
      expect(after).to.be.closeTo(before + HALF_ETH - gas, parseEther("0.001"));
    });
  });

  describe("Agent Payments", function () {
    beforeEach(async function () {
      await contract.connect(owner).setPolicy(agent.address, HALF_ETH, ONE_ETH, []);
      await contract.connect(owner).deposit({ value: ONE_ETH });
    });

    it("allows agent to pay within limits", async function () {
      const before = await ethers.provider.getBalance(recipient.address);
      await contract.connect(agent).pay(owner.address, recipient.address, QUARTER_ETH, "test payment");
      const after = await ethers.provider.getBalance(recipient.address);
      expect(after - before).to.equal(QUARTER_ETH);
    });

    it("blocks payment exceeding per-tx limit", async function () {
      await expect(
        contract.connect(agent).pay(owner.address, recipient.address, ONE_ETH, "too much")
      ).to.be.revertedWithCustomError(contract, "ExceedsPerTxLimit");
    });

    it("blocks payment exceeding daily limit", async function () {
      await contract.connect(agent).pay(owner.address, recipient.address, HALF_ETH, "first");
      await contract.connect(agent).pay(owner.address, recipient.address, HALF_ETH, "second");
      await expect(
        contract.connect(agent).pay(owner.address, recipient.address, QUARTER_ETH, "third")
      ).to.be.revertedWithCustomError(contract, "ExceedsDailyLimit");
    });

    it("blocks unauthorized agents", async function () {
      await expect(
        contract.connect(other).pay(owner.address, recipient.address, QUARTER_ETH, "unauthorized")
      ).to.be.revertedWithCustomError(contract, "Unauthorized");
    });

    it("blocks payment when policy is inactive", async function () {
      await contract.connect(owner).deactivatePolicy();
      await expect(
        contract.connect(agent).pay(owner.address, recipient.address, QUARTER_ETH, "inactive")
      ).to.be.revertedWithCustomError(contract, "PolicyNotActive");
    });

    it("enforces recipient whitelist when set", async function () {
      await contract.connect(owner).setPolicy(agent.address, HALF_ETH, ONE_ETH, [recipient.address]);
      await expect(
        contract.connect(agent).pay(owner.address, other.address, QUARTER_ETH, "not approved")
      ).to.be.revertedWithCustomError(contract, "RecipientNotApproved");

      // Just verify it doesn't throw
      await contract.connect(agent).pay(owner.address, recipient.address, QUARTER_ETH, "approved");
    });

    it("tracks spent amounts correctly", async function () {
      await contract.connect(agent).pay(owner.address, recipient.address, QUARTER_ETH, "p1");
      const policy = await contract.getPolicy(owner.address);
      expect(policy.spentToday).to.equal(QUARTER_ETH);
      expect(policy.remainingToday).to.equal(ONE_ETH - QUARTER_ETH);
    });
  });

  describe("Events", function () {
    it("emits Payment event on successful pay", async function () {
      await contract.connect(owner).setPolicy(agent.address, HALF_ETH, ONE_ETH, []);
      await contract.connect(owner).deposit({ value: ONE_ETH });
      await expect(
        contract.connect(agent).pay(owner.address, recipient.address, QUARTER_ETH, "memo")
      ).to.emit(contract, "Payment").withArgs(owner.address, agent.address, recipient.address, QUARTER_ETH);
    });
  });
});
