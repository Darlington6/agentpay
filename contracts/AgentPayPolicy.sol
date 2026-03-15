// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentPayPolicy
 * @notice Allows humans to define spending policies for AI agents.
 *         Agents can only transfer ETH within the bounds set by the human owner.
 */
contract AgentPayPolicy {
    struct Policy {
        address agent;           // Authorized AI agent address
        uint256 maxPerTx;        // Max ETH per single transaction (in wei)
        uint256 dailyLimit;      // Max ETH agent can spend per day (in wei)
        uint256 spentToday;      // Accumulated spend for current day
        uint256 dayStart;        // Timestamp of current day window start
        address[] approvedTo;    // Approved recipient addresses (empty = anyone)
        bool active;             // Policy is active
    }

    mapping(address => Policy) public policies; // owner => policy
    mapping(address => address) public agentToOwner; // agent => owner

    event PolicyCreated(address indexed owner, address indexed agent, uint256 maxPerTx, uint256 dailyLimit);
    event PolicyUpdated(address indexed owner, address indexed agent);
    event PolicyDeactivated(address indexed owner);
    event Payment(address indexed owner, address indexed agent, address indexed to, uint256 amount, string memo);
    event Deposited(address indexed owner, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    error Unauthorized();
    error PolicyNotActive();
    error ExceedsPerTxLimit(uint256 requested, uint256 limit);
    error ExceedsDailyLimit(uint256 requested, uint256 remaining);
    error RecipientNotApproved(address to);
    error InsufficientBalance(uint256 balance, uint256 requested);
    error TransferFailed();
    error PolicyAlreadyExists();

    modifier onlyOwner() {
        if (policies[msg.sender].agent == address(0) && agentToOwner[msg.sender] == address(0)) {
            // Allow owner to call even if they haven't set a policy yet for setup calls
        }
        _;
    }

    modifier onlyAgent(address owner) {
        if (policies[owner].agent != msg.sender) revert Unauthorized();
        if (!policies[owner].active) revert PolicyNotActive();
        _;
    }

    // ─── Owner Functions ───────────────────────────────────────────────────────

    /**
     * @notice Create or replace a spending policy for an AI agent.
     * @param agent          Ethereum address of the authorized agent
     * @param maxPerTx       Maximum wei the agent can send in a single tx
     * @param dailyLimit     Maximum wei the agent can send in a 24-hour window
     * @param approvedTo     Whitelisted recipient addresses (empty array = any recipient allowed)
     */
    function setPolicy(
        address agent,
        uint256 maxPerTx,
        uint256 dailyLimit,
        address[] calldata approvedTo
    ) external {
        require(agent != address(0), "Invalid agent address");
        require(maxPerTx > 0, "maxPerTx must be > 0");
        require(dailyLimit >= maxPerTx, "dailyLimit must be >= maxPerTx");

        // Clear old agent mapping
        address oldAgent = policies[msg.sender].agent;
        if (oldAgent != address(0)) {
            delete agentToOwner[oldAgent];
        }

        policies[msg.sender] = Policy({
            agent: agent,
            maxPerTx: maxPerTx,
            dailyLimit: dailyLimit,
            spentToday: 0,
            dayStart: block.timestamp,
            approvedTo: approvedTo,
            active: true
        });

        agentToOwner[agent] = msg.sender;

        if (oldAgent != address(0)) {
            emit PolicyUpdated(msg.sender, agent);
        } else {
            emit PolicyCreated(msg.sender, agent, maxPerTx, dailyLimit);
        }
    }

    function deactivatePolicy() external {
        policies[msg.sender].active = false;
        emit PolicyDeactivated(msg.sender);
    }

    function reactivatePolicy() external {
        require(policies[msg.sender].agent != address(0), "No policy found");
        policies[msg.sender].active = true;
    }

    /**
     * @notice Deposit ETH into your policy balance.
     */
    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH from your policy balance.
     */
    function withdraw(uint256 amount) external {
        if (address(this).balance < amount) revert InsufficientBalance(address(this).balance, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ─── Agent Functions ────────────────────────────────────────────────────────

    /**
     * @notice Agent calls this to send ETH on behalf of the owner.
     *         Enforces per-tx and daily limits, and recipient whitelist.
     * @param owner   The human owner whose policy this agent is acting under
     * @param to      Recipient address
     * @param amount  Amount in wei to send
     */
    function pay(
        address owner,
        address payable to,
        uint256 amount,
        string calldata memo
    ) external onlyAgent(owner) {
        Policy storage p = policies[owner];

        // Check per-tx limit
        if (amount > p.maxPerTx) revert ExceedsPerTxLimit(amount, p.maxPerTx);

        // Reset daily window if 24 hours have passed
        if (block.timestamp >= p.dayStart + 1 days) {
            p.spentToday = 0;
            p.dayStart = block.timestamp;
        }

        // Check daily limit
        uint256 remaining = p.dailyLimit - p.spentToday;
        if (amount > remaining) revert ExceedsDailyLimit(amount, remaining);

        // Check recipient whitelist
        if (p.approvedTo.length > 0) {
            bool approved = false;
            for (uint256 i = 0; i < p.approvedTo.length; i++) {
                if (p.approvedTo[i] == to) {
                    approved = true;
                    break;
                }
            }
            if (!approved) revert RecipientNotApproved(to);
        }

        // Check contract has enough ETH
        if (address(this).balance < amount) revert InsufficientBalance(address(this).balance, amount);

        p.spentToday += amount;

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Payment(owner, msg.sender, to, amount, memo);
    }

    // ─── View Functions ─────────────────────────────────────────────────────────

    function getPolicy(address owner) external view returns (
        address agent,
        uint256 maxPerTx,
        uint256 dailyLimit,
        uint256 spentToday,
        uint256 remainingToday,
        bool active,
        address[] memory approvedTo
    ) {
        Policy storage p = policies[owner];
        uint256 spent = p.spentToday;
        // Simulate reset if day has passed
        if (block.timestamp >= p.dayStart + 1 days) {
            spent = 0;
        }
        return (
            p.agent,
            p.maxPerTx,
            p.dailyLimit,
            spent,
            p.dailyLimit - spent,
            p.active,
            p.approvedTo
        );
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}
