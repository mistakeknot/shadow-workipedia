---
name: "Flash Loan Attack Atomic Arbitrage Instant Drainage"
id: flash-loan-attack-atomic-arbitrage-instant-drainage
source: 137-defi-exploitation-crisis-ARCHITECTURE.md
system: "SW#137: defi exploitation crisis"
category: principle
---

# Flash Loan Attack Atomic Arbitrage Instant Drainage

Flash loans enable borrowing unlimited capital ($billions) for single transaction block (13 seconds) with no collateral → attack pattern: borrow → manipulate oracle/price → exploit arbitrage → repay loan → profit → all atomic (succeeds completely or reverts) → $200M+ stolen via flash loans 2020-2024 → no defense except oracle hardening (TWAP, multiple sources) which adds latency and complexity → attack sophistication increasing (MEV bots, private mempools, cross-chain bridges).

## Source

Extracted from [Defi Exploitation Crisis](#/wiki/defi-exploitation-crisis) at line 18.
