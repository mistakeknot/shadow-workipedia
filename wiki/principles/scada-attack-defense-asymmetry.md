---
name: "SCADA Attack Defense Asymmetry"
id: scada-attack-defense-asymmetry
source: 53-critical-infrastructure-attacks-ARCHITECTURE.md
system: "SW#53: critical infrastructure attacks"
category: principle
---

# SCADA Attack Defense Asymmetry

Industrial control systems designed for reliability not security (hardcoded admin/admin credentials, unencrypted Modbus/DNP3 protocols, no authentication between devices) → legacy systems 20-40 year lifespan running Windows XP/NT with zero patches possible (70% ICS cannot be patched due to downtime/safety testing requirements) → air-gap myth bridged via USB sticks/contractor laptops (Stuxnet precedent) → attacker needs 1 zero-day vs defender must patch all vulnerabilities → attack cost $1M-10M vs defense cost $100B+ creating 100:1 to 10,000:1 cost asymmetry → detection failure rates 60-80% (SCADA not monitored like IT, operational variations mask malicious activity) → offensive dominance where infrastructure inherently vulnerable.

## Source

Extracted from [Critical Infrastructure Attacks](#/wiki/critical-infrastructure-attacks) at line 17.
