---
name: "Composability Risk Multiplication Dependency Cascade"
id: composability-risk-multiplication-dependency-cascade
source: 137-defi-exploitation-crisis-ARCHITECTURE.md
system: "SW#137: defi exploitation crisis"
category: principle
---

# Composability Risk Multiplication Dependency Cascade

DeFi protocols interconnect ("money legos") → Protocol A depends on Protocol B's oracle which depends on Protocol C's liquidity → single failure cascades: Curve pool exploit → stETH depeg → Aave liquidations → Maker vault liquidations → systemic stress → complexity grows O(n²) with protocol count → audit coverage impossible (can't audit all combinations) → "unknown unknowns" dominate risk → insurance protocols (Nexus Mutual) can't price tail risk.

## Source

Extracted from [Defi Exploitation Crisis](#/wiki/defi-exploitation-crisis) at line 22.
