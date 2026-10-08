***[Page 1]***

# BEN/POS INTELLIGENCE
## PRODUCT FEATURE DOCUMENT

### BEN/POS Intelligence
**Shareholder Data Analytics, Screening & Ownership Intelligence Platform**

A platform designed to transform weekly BENPOS shareholder records across ~16,000 companies into searchable investor profiles, company filters, ownership signals, historical analytics and network intelligence.

*   **~16,000** Companies
*   **Weekly** BENPOS Updates
*   **Investor-First** Analytics Model

#### Core product principle
**The company is the container. The shareholder data is the intelligence layer.**
Users should be able to search shareholders, filter companies using shareholder behaviour, compare ownership over time, discover cross-company relationships and monitor meaningful weekly changes.

*Shareholder Data Analytics & Screening Platform*

---

***[Page 2]***

## 1. Product Architecture
BEN/POS Intelligence is organized around ten clear modules. Each module is broad enough to support multiple analytics without fragmenting the product into hundreds of repetitive micro-features.

| Module | Purpose |
| :--- | :--- |
| **Companies** | Discover and filter companies using the structure and behaviour of their shareholder base. |
| **Shareholders** | Search and analyse resolved investor identities across the full company universe. |
| **Screener** | Build multi-condition filters using BENPOS-derived ownership metrics. |
| **Movements** | Analyse entries, exits, accumulation, reductions and holding changes. |
| **Networks** | Understand cross-company shareholder overlap and investor-company relationships. |
| **Ownership** | Measure concentration, stability, retention, churn and shareholder composition. |
| **Signals** | Surface statistically unusual or significant ownership activity. |
| **History** | Compare weekly snapshots and reconstruct historical ownership states. |
| **Watchlists** | Monitor selected shareholders, companies and investor cohorts. |
| **Intelligence Feed** | Show the most important BENPOS changes across the entire universe each week. |

## 2. Shareholder Intelligence

| Feature | What it does |
| :--- | :--- |
| **Universal Shareholder Search** | Search a resolved shareholder across all tracked companies and instantly see current and historical company presence. |
| **Shareholder 360° Profile** | One profile combining holdings, companies, first seen, last seen, holding duration, position changes and portfolio history. |
| **Identity Resolution** | Resolve spelling variations, depository records and duplicate accounts into a canonical investor identity with match confidence. |
| **Multi-Account Detection** | Identify multiple demat accounts linked to the same resolved identity while retaining account-level source traceability. |
| **Current Portfolio** | Show every company currently associated with a shareholder and allow sorting by quantity, company, sector or date. |
| **Historical Portfolio** | Show every company in which a shareholder has ever appeared, including exited positions and re-entries. |
| **Portfolio Breadth & Concentration** | Measure how many companies an investor holds and whether their observed portfolio is concentrated or diversified. |
| **Sector Exposure** | Analyse the sectors and industries represented across a shareholder's observed portfolio. |

*Shareholder Data Analytics & Screening Platform*

---

***[Page 3]***

## 3. Shareholder Movement Analytics

| Feature | What it does |
| :--- | :--- |
| **Date-to-Date Holding Comparison** | Compare any two BENPOS dates and calculate absolute and percentage changes for every investor-company relationship. |
| **Accumulation Analysis** | Identify shareholders whose holdings increase across consecutive weekly snapshots and apply configurable change thresholds. |
| **Reduction Analysis** | Detect shareholders consistently or materially reducing their observed positions over selected periods. |
| **New Entry Detection** | Find shareholders appearing in a company for the first time or returning after an earlier absence. |
| **Exit Detection** | Identify previously observed shareholders who disappear from the latest BENPOS snapshot. |
| **Re-Entry Detection** | Track complete entry → exit → re-entry sequences for any investor-company relationship. |
| **Holding Duration** | Calculate continuous observed holding periods and distinguish recent entrants from persistent holders. |
| **Portfolio Rotation** | Surface investors reducing positions in one set of companies while appearing or increasing elsewhere, without assuming literal fund flow. |

## 4. Company Screening Based on Shareholder Data

| Feature | What it does |
| :--- | :--- |
| **Shareholder-Based Company Screener** | Filter the 16,000-company universe using BENPOS-derived ownership characteristics instead of financial metrics. |
| **Shareholder Growth Filter** | Find companies with the strongest increases in observed shareholder count over week, month, quarter or custom period. |
| **Shareholder Decline Filter** | Find companies experiencing sustained or unusually large reductions in shareholder count. |
| **Accumulation Company Filter** | Identify companies where many existing shareholders are simultaneously increasing their positions. |
| **Large-Holder Activity Filter** | Find companies where top or large holders have materially changed their observed positions. |
| **Exit-Heavy Company Filter** | Identify companies experiencing unusually high numbers of shareholder exits relative to their own history. |
| **Ownership Stability Filter** | Find companies with high shareholder retention, low churn and relatively stable ownership structures. |
| **Ownership Activity Filter** | Find companies with the highest volume of entries, exits and material holding changes during a selected period. |

*Shareholder Data Analytics & Screening Platform*

---

***[Page 4]***

## 5. Cross-Company & Network Intelligence

| Feature | What it does |
| :--- | :--- |
| **Common Shareholder Search** | Select two or more companies and identify shareholders common to all selected companies. |
| **Company Overlap Analysis** | Measure shareholder overlap between companies using raw counts and percentage-based similarity metrics. |
| **Multi-Company Holder Filter** | Find investors appearing across at least 2, 5, 10, 50 or any chosen number of companies. |
| **Similar Company Discovery** | Find companies with unusually similar shareholder populations based on actual ownership overlap. |
| **Investor Similarity** | Find shareholders whose observed portfolios substantially overlap with a selected investor. |
| **Shareholder Cluster Detection** | Identify groups of investors that repeatedly appear in the same companies, presented as portfolio overlap rather than assumed coordination. |
| **Company Ownership Clusters** | Identify groups of companies attracting similar shareholder populations. |
| **Investor-Company Network Graph** | Explore the ownership graph from investor → company → other investors → other companies. |

## 6. Ownership Structure Analytics

| Feature | What it does |
| :--- | :--- |
| **Top Holder Concentration** | Calculate the share represented by the top 10, 25, 50 or 100 holders and track changes over time. |
| **Ownership Concentration Metrics** | Use HHI, Gini and percentile distributions to quantify how ownership is spread across shareholders. |
| **Ownership Broadening** | Detect companies where ownership is becoming distributed across a wider shareholder base. |
| **Ownership Consolidation** | Detect companies where a smaller group of holders represents an increasing portion of observed ownership. |
| **Shareholder Churn** | Measure entries and exits relative to the existing shareholder base over configurable periods. |
| **Shareholder Retention** | Measure how many newly entered shareholders remain after 4, 12, 26 or 52 weeks. |
| **Long-Term Holder Mix** | Calculate the proportion of shareholders that have remained continuously observable over extended periods. |
| **Depository Mix** | Analyse CDSL vs NSDL composition and how that mix changes across historical snapshots. |

*Shareholder Data Analytics & Screening Platform*

---

***[Page 5]***

## 7. Shareholder Segmentation & Cohorts

| Feature | What it does |
| :--- | :--- |
| **Holding-Size Segmentation** | Segment shareholders by quantity, ownership percentage or configurable holding bands where the data supports it. |
| **Portfolio Breadth Segmentation** | Group shareholders by number of companies held, such as 1, 2-5, 6-20 and 20+. |
| **Holding Duration Segmentation** | Separate recent entrants, medium-duration and long-duration holders using configurable time thresholds. |
| **Activity Segmentation** | Classify shareholders by frequency of entries, exits and material holding changes. |
| **Sector Specialist Filter** | Find investors whose observed portfolio is heavily concentrated in a particular sector or industry. |
| **Entry Cohorts** | Group shareholders by first-entry period and compare retention and subsequent behaviour. |
| **Shared Movement Cohorts** | Find groups of investors showing similar portfolio changes during the same period. |
| **Geographic Segmentation** | Analyse shareholder distribution by state, city or PIN-level aggregates where available and appropriate. |

## 8. Signals & Anomaly Detection

| Feature | What it does |
| :--- | :--- |
| **Persistent Accumulator Signal** | Flag investors increasing their position for a configurable number of consecutive BENPOS periods. |
| **Persistent Reducer Signal** | Flag investors repeatedly decreasing positions across successive snapshots. |
| **Investor Activity Spike** | Detect shareholders whose portfolio activity is materially above their own historical baseline. |
| **Company Ownership Anomaly** | Detect company-level shareholder behaviour that differs significantly from its normal historical range. |
| **Unusual Entry Cluster** | Flag an unusually large number of new shareholders entering the same company within a short period. |
| **Unusual Exit Cluster** | Flag abnormal numbers of shareholder exits relative to the company's historical pattern. |
| **Emerging Ownership Cluster** | Detect when an established group of overlapping shareholders begins appearing in another company. |
| **Explainable Signal Logic** | Every signal states the exact threshold, historical comparison and data change that triggered it. |

*Shareholder Data Analytics & Screening Platform*

---

***[Page 6]***

## 9. Historical BENPOS Intelligence

| Feature | What it does |
| :--- | :--- |
| **Immutable Weekly Snapshot Store** | Preserve every BENPOS snapshot instead of overwriting the latest record, creating a continuously growing historical asset. |
| **Historical Ownership Lookup** | Reconstruct who held a company, or what companies an investor held, on any stored BENPOS date. |
| **Ownership Timeline** | Visualise shareholder count, concentration, entries, exits and investor-level changes through time. |
| **Any-Date Comparison** | Compare any two historical dates rather than being limited to week-on-week changes. |
| **Historical Pattern Search** | Find past periods across the company universe with ownership behaviour similar to the current pattern. |
| **Ownership Network Replay** | View how investor-company networks and clusters changed as weekly snapshots accumulated. |

*Shareholder Data Analytics & Screening Platform*

---

***[Page 7]***

## 10. Advanced BENPOS Screener
The screener should be a primary product surface. Users combine multiple shareholder-derived conditions to narrow the 16,000-company universe or millions of investor records into a research-ready result set.

| Company Filters | Shareholder Filters |
| :--- | :--- |
| • Shareholder count / change% <br> • New shareholders / exits / net additions <br> • Accumulating vs reducing holders <br> • Large-holder activity <br> • Top-holder concentration <br> • Retention / churn / stability <br> • Cross-company shareholder count <br> • Average portfolio breadth of holders <br> • Geographic concentration <br> • CDSL/NSDL mix <br> • Accumulation or growth streaks <br> • Ownership anomaly detected <br> • Overlap with selected company or cohort | • Number of companies held <br> • Current/historical company presence <br> • First seen / last active <br> • New entries / exits <br> • Increasing / decreasing positions <br> • Accumulation streak <br> • Holding duration <br> • Portfolio breadth / concentration <br> • Primary sector / sector exposure <br> • Geography <br> • Depository presence <br> • Common-company relationships <br> • Similar-investor score |

**Example Multi-Condition Queries**
*   Companies where shareholder count increased >10%, at least 25 existing holders increased positions, and top-holder concentration did not rise.
*   Shareholders holding 10+ companies who entered at least 3 new companies during the last four weeks.
*   Companies where at least 20 shareholders also hold a selected reference company.
*   Companies showing 4 consecutive weeks of large-holder accumulation with below-average shareholder churn.
*   Shareholders that exited Company X and subsequently appeared in companies belonging to a selected sector.

## 11. Search, Monitoring & Delivery

| Feature | What it does |
| :--- | :--- |
| **Natural-Language BENPOS Search** | Translate questions such as "show companies where 50+ shareholders entered this month" into database filters. |
| **Shareholder Watchlist** | Track selected investors across all companies and alert on entries, exits and material position changes. |
| **Company Ownership Watchlist** | Monitor selected companies specifically for shareholder-base changes and BENPOS signals. |
| **Investor Group Watchlist** | Create and monitor custom cohorts of shareholders as a group. |
| **BENPOS Intelligence Feed** | Rank and surface the most significant ownership changes detected across the full universe each week. |
| **Weekly BENPOS Brief** | Generate a structured newsletter covering shareholder growth, exits, accumulation, concentration and cross-company activity. |
| **Export & Research Lists** | Export screened result sets or save them as reusable research universes and watchlists. |

*Shareholder Data Analytics & Screening Platform*

---

***[Page 8]***

## 12. Data & Calculation Principles

| Principle | Requirement |
| :--- | :--- |
| **Source Traceability** | Every normalized record should remain traceable to the original file, source row and depository field. |
| **Historical Preservation** | Never replace a prior weekly snapshot; append new snapshots so all time-series analytics remain reproducible. |
| **Corporate Action Normalisation** | Splits, bonuses, mergers and similar events should be adjusted so mechanical quantity changes are not misclassified as investor behaviour. |
| **Privacy by Design** | Mask or suppress unnecessary PII in user-facing analytics while retaining authorized internal identifiers needed for resolution. |
| **Identity Confidence** | Resolved investor identities should carry confidence levels and a manual-review path for uncertain matches. |
| **No Unsupported Causality** | Observed portfolio migration, overlap or simultaneous activity should not be described as coordinated action or literal capital flow without additional evidence. |

## 13. Product Positioning
BEN/POS Intelligence should not be positioned as a company database.
Its core value is the ability to convert weekly shareholder records into searchable investor intelligence, ownership-based company discovery, historical behaviour, cross-company networks and explainable signals.

### THE CORE QUESTION
**Across ~16,000 companies, what changed in shareholder ownership this week and where should the analyst look next?**

*Shareholder Data Analytics & Screening Platform*