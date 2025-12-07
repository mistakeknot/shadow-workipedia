---
name: "Countermeasure Arms Race Futility Spiral"
id: countermeasure-arms-race-futility-spiral
source: 59-gnss-spoofing-positioning-collapse-ARCHITECTURE.md
system: "SW#59: gnss spoofing positioning collapse"
category: principle
---

# Countermeasure Arms Race Futility Spiral

Operators invest in detection → attackers switch to seamless takeover (drag-off spoofing undetectable) → operators invest multi-constellation receivers (GPS+GLONASS+Galileo+BeiDou $2K per device) → attackers spoof all constellations simultaneously ($20K equipment) → operators invest inertial backup (IMU $5K per device) → attackers wait until IMU drifts 1m/minute then spoof → operators invest encrypted M-code ($500 per device) → attackers jam M-code forcing fallback to INS (drifts) → after $50B spent on countermeasures attackers still winning (offense $10K vs defense $50B = 5,000:1 asymmetry) → terminal state permanent cat-and-mouse no stable equilibrium operators give up or accept loss creating futility spiral where every defensive investment met with cheaper offensive counter making security economically impossible where rational operators eventually abandon hardening and accept spoofing as unavoidable cost of doing business (aviation ticket prices +20%, insurance premiums +40%, autonomous vehicles banned).

## Source

Extracted from [Gnss Spoofing Positioning Collapse](#/wiki/gnss-spoofing-positioning-collapse) at line 21.
