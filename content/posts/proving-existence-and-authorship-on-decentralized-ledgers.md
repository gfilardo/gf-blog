---
title: "Proving existence and authorship: decentralized timestamps and the longevity of proof"
slug: proving-existence-and-authorship-on-decentralized-ledgers
date: "2026-11-09"
description: "A first-principles guide to proving when a digital document existed and who created it, decoupling identity from crypto wallets, and evaluating ledger longevity."
tags:
  - architecture
  - cryptography
  - bitcoin
  - software
series:
  id: decentralized-timestamps
  title: "Decentralized timestamps"
  part: 1
draft: false
unlisted: true
---

Whenever you publish an original technical specification, release open-source research, or record a digital commitment, you encounter an old and persistent problem in computer science: **how to prove priority**.

Specifically, if a dispute arises over prior art, copyright, or chronological precedence, you must be able to prove two distinct properties to an untrusted third party:

1. **Anteriority (Proof of existence)**: That a specific set of bytes existed at or before a verifiable point in time.
2. **Authorship (Proof of attribution)**: That a specific identity created those bytes, rather than merely observing and redistributing them.

In an era where digital content is easily replicated, scraped, and ingested into automated models within minutes of publication, relying on informal conventions of priority is no longer sufficient. Establishing verifiable, mathematical prior art has become a practical necessity.

Yet the methods most engineers instinctively reach for—Git commit history, server logs, or centralized timestamping services—fail under basic adversarial scrutiny.

This article explores the cryptographic principles required to prove existence and authorship independently, examines why embedding documents directly into blockchain transactions introduces severe operational flaws, and evaluates which decentralized networks can reliably preserve verification across decades.

---

## Why conventional timestamps fail

Digital systems are mutable by default. Almost all conventional mechanisms for establishing time and origin can be forged, manipulated, or erased without leaving a trace:

* **The Git commit fallacy**: Committing code or prose to a Git repository does not prove when it was written. Git metadata fields are unauthenticated strings. Setting `GIT_COMMITTER_DATE="2018-01-01 12:00:00" git commit --amend` retroactively rewrites history in seconds. Rebasing, squashing, or force-pushing can alter an entire project timeline without violating Git's internal integrity checks.
* **Server logs and filesystem metadata**: Filesystem timestamps (`mtime`, `ctime`) and web server access logs are entirely under the control of the host machine's administrator. They carry zero evidentiary weight in a formal priority dispute.
* **Centralized Timestamping Authorities (RFC 3161)**: Traditional digital timestamping relies on a trusted third party (a Timestamping Authority, or TSA) signing a document digest with an X.509 certificate. However, this model introduces vendor lock-in and temporal fragility. Certificates expire, TSAs go out of business, and their root authorities can be compromised or revoked.
* **Web archives**: Public archival caches such as the Wayback Machine provide useful historical convenience, but they are not cryptographic trust anchors. Domain owners can retroactively suppress or remove historical snapshots by updating a `robots.txt` exclusion rule, and centralized repositories remain vulnerable to administrative redaction and infrastructure failure.

Proving that a digital artifact existed at a specific moment requires anchoring its cryptographic digest into a medium that no single entity—including the author—can manipulate retroactively.

---

## Two models: wallet-bound versus decoupled timestamps

To anchor a document's fingerprint to an immutable ledger, two architectural approaches have emerged in distributed systems.

```mermaid#wide The direct blockchain model versus the decoupled OpenTimestamps model.
flowchart TD
    subgraph DIRECT["The Direct Blockchain Model (Wallet-Bound)"]
        direction TB
        DOC_D["Digital Document"] --> HASH_D["Hash: #x12y"]
        WALLET["Crypto Wallet (Signer & Gas Payer)"] --> TX_D["L1 Transaction (OP_RETURN / Contract)"]
        HASH_D --> TX_D
        TX_D --> BLOCK_D["Blockchain Block"]
        
        NOTE_D["• Ownership: Wallet initiating transaction<br/>• Anteriority: Block timestamp<br/>• Trade-offs: Gas fees, wallet custody, public financial trace, state bloat"]
        BLOCK_D -.-> NOTE_D
    end

    subgraph DECOUPLED["The OpenTimestamps Model (Decoupled & Aggregated)"]
        direction TB
        subgraph ME["Author Identity"]
            DOC["Canonical Document"] --> MERGE["Bundle"]
            SIG["Signature: SIG(doc, pk)"] --> MERGE
            MERGE --> HASH1["Initial Hash: #1st"]
        end

        subgraph OTHERS["Other Users / Artifacts"]
            DOC_O["Other Documents"] --> HASH_O["Hash: #tsh"]
        end

        subgraph AGGREGATOR["OTS Calendar Aggregator (Merkle Tree)"]
            HASH1 --> TREE["Intermediate Nodes (#ty2)"]
            HASH_O --> ROOT["Merkle Root: #ty2y"]
            TREE --> ROOT
        end

        subgraph BITCOIN["Bitcoin Consensus"]
            ROOT --> TX_OTS["Single Bitcoin Transaction"]
            TX_OTS --> BLOCK_BTC["Bitcoin Block (PoW Timestamp)"]
        end

        NOTE_DEC["• Ownership: Asymmetric signature in initial hash<br/>• Anteriority: Bitcoin block header timestamp<br/>• Advantages: Zero fees, no crypto wallet, self-contained offline verification"]
        BLOCK_BTC -.-> NOTE_DEC
    end
```

### 1. The direct blockchain model (wallet-bound)
The standard approach in many blockchain implementations is to compute a SHA-256 hash of a file (`#x12y`) and embed it directly into a transaction—for example, using a Bitcoin `OP_RETURN` script or an Ethereum smart contract call.

In this model:
- **Anteriority** is established by the timestamp of the confirmed block.
- **Ownership** is attributed to whichever cryptocurrency wallet signed the transaction and paid the network fee.

While conceptually simple, binding document ownership to a cryptocurrency wallet introduces serious practical drawbacks:
1. **Financial friction**: Every document timestamp or revision incurs an on-chain transaction fee. If network fees spike, publishing or updating a document becomes artificially expensive.
2. **Key management overhead**: Authors must maintain funded cryptocurrency wallets, manage seed phrases, and expose private keys within their automated build or deployment scripts.
3. **Loss of privacy**: The author's personal or corporate identity becomes permanently linked on a public ledger to a specific financial address, exposing wallet balances and transaction history to public block explorers.
4. **State bloat**: Writing individual document hashes directly onto an L1 chain forces every full node worldwide to permanently store personal metadata in their global state.

### 2. The OpenTimestamps model (decoupled and aggregated)
The alternative architecture—standardized by **OpenTimestamps (OTS)**, designed by Peter Todd—solves these problems by cleanly decoupling the proof of authorship from the proof of anteriority.

Rather than submitting transactions directly from a crypto wallet, the process separates into three distinct components:

1. **Authorship through asymmetric identity (`SIG(doc, pk)`)**: The author signs the document using their existing OpenPGP (GPG) or SSH key pair. This detached digital signature is bundled with the document to create an initial hash:
   $$\text{Initial Hash } (\#1\text{st}) = \text{SHA-256}(\text{document} \parallel \text{signature})$$
   Authorship is rooted entirely in asymmetric cryptography, independent of any cryptocurrency address.
2. **Scalable aggregation via Merkle trees**: The author submits this initial hash (`#1st`) to a federated OpenTimestamps calendar server. The calendar server collects thousands of independent hashes (`#tsh`) from other users and structures them into an off-chain Merkle tree. Intermediate hashes (`#ty2`) are iteratively combined until a single root hash (`#ty2y`) is produced.
3. **Anchoring to Bitcoin Proof-of-Work**: The calendar server submits this single Merkle root (`#ty2y`) into the Bitcoin blockchain via an ordinary transaction.

This produces a clean separation of concerns:
* **Anteriority** is derived from the Bitcoin block header timestamp that seals the Merkle root.
* **Ownership** is proven by the cryptographic signature embedded inside the leaf hash (`#1st`).

Because thousands of documents share the same on-chain transaction, the marginal cost to the document author is **zero**. There is no need to hold cryptocurrency, manage a wallet, or pay gas fees. The resulting proof is a tiny, detached receipt (`.ots`, typically under 1 KB) that contains only the specific Merkle path connecting the author's initial hash to the Bitcoin block header.

---

## The 30-year ledger longevity test

A timestamp is only as dependable as the network that preserves it. If you need to verify a document thirty years from now, the verification process must not depend on fragile token economics, pruning nodes, or centralized storage services.

When evaluated against multi-decade permanence, most decentralized architectures fall short:

| Network / Approach | Consensus / Storage Model | Longevity Risk |
| :--- | :--- | :--- |
| **Kaspa (KAS)** | High-throughput GHOSTDAG / blockDAG | Standard Kaspa nodes prune historical block data aggressively to maintain high block rates. Historical proofs become unverifiable to ordinary users unless they locate and query rare, dedicated archival nodes. |
| **Ravencoin (RVN)** | Native asset layer (32-byte metadata payload) | While RVN natively supports attaching arbitrary metadata to tokens, its long-term economic security and hash-rate viability present severe risks of 51% reorganizations or chain abandonment. |
| **Ethereum / EVM** | Smart contract storage (`SSTORE`) | Ethereum storage incurs ongoing state rent and unpredictable L1 gas fees. Layer-2 rollups introduce centralized sequencers and multi-signature bridge assumptions that complicate long-term trust. |
| **Solana** | High-speed monolithic consensus | Extreme state generation forces validators to purge transaction history, offloading raw blocks to external cloud storage (BigQuery) or decentralized bridges. It cannot support lightweight, self-contained offline verification. |
| **IPFS / Filecoin** | Decentralized content addressing | IPFS is an addressable storage protocol, not an immutable clock. To keep content accessible, you must continuously pay monthly fees to centralized pinning services (e.g., Pinata) or run an always-on IPFS daemon. If payments lapse, the content disappears. |
| **Bitcoin (via OpenTimestamps)** | Proof-of-Work Nakamoto Consensus | The most secure, energy-dense, and conservative computational network on Earth. By embedding only the 32-byte Merkle root into an `OP_RETURN`, it leverages Bitcoin's multi-decade immutability with zero state bloat. |

Bitcoin is the only public ledger with nearly two decades of continuous, unbroken Proof-of-Work history. Because OpenTimestamps proofs require only the standard Bitcoin block headers to verify the Merkle path, verification can be performed completely offline on a standard laptop without querying external servers or relying on third-party APIs.

---

## Universal principles in practice

The combination of digital signatures, Merkle aggregation, and Proof-of-Work anchoring provides a universal framework for proving digital priority:

$$\text{Provable Record} = \text{Author Signature} \xrightarrow{\text{binds to}} \text{Document Hash} \xrightarrow{\text{anchored in}} \text{Bitcoin Block}$$

This framework applies universally across domains:
* **Legal and corporate contracts**: Establishing execution dates without relying on proprietary, fee-charging e-signature platforms.
* **Software releases and security advisories**: Providing cryptographic proof that a security patch or binary release existed prior to a specific vulnerability disclosure.
* **Academic and technical writing**: Securing immutable prior art for research papers, patent disclosures, and engineering essays.

In the next part of this series (*Implementing decentralized timestamps*), we move from theoretical principles to practical software engineering. Using static site generation as a real-world case study, we examine how to automate this pipeline: resolving the canonicalization trap, designing an asynchronous local manifest state machine, and verifying proofs deterministically.
