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

1. **Anteriority (Proof of prior existence)**: That a specific set of bytes existed at or before a verifiable point in time.
2. **Attribution (Proof of commitment and identity)**: That a specific identity created or endorsed those bytes, rather than merely observing and redistributing them after the fact.

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

To anchor a document's fingerprint to an immutable ledger, two architectural approaches have emerged in distributed systems: directly writing transaction records from a cryptocurrency wallet, or aggregating hashes off-chain and anchoring a single Merkle root to a Proof-of-Work blockchain.

### 1. The direct blockchain model (wallet-bound)

The standard approach in many blockchain implementations is to compute a SHA-256 hash of a file (`#x12y`) and embed it directly into a transaction—for example, using a Bitcoin `OP_RETURN` script or an Ethereum smart contract call.

```mermaid#narrow The direct blockchain model: on-chain hashing and wallet-bound transactions.
flowchart TD
    subgraph AUTHOR["Author Environment"]
        DOC["Digital Document"] --> HASH["Compute SHA-256"]
        WALLET["Funded Crypto Wallet"]
    end

    subgraph TX_LAYER["Transaction Layer"]
        WALLET -->|Signs TX & Pays Gas Fee| TX["L1 Transaction<br/>(OP_RETURN / Contract Call)"]
        HASH --> TX
    end

    subgraph L1["Public Blockchain"]
        TX --> BLOCK["Mined Block<br/>(L1 Consensus Timestamp)"]
    end
```

In this model, the transaction itself serves as both timestamp and signature:
- **Anteriority** is established by the timestamp of the confirmed block.
- **Attribution** is bound directly to the cryptocurrency wallet that broadcasts the transaction. Because every blockchain transaction must be cryptographically signed by the private key controlling that address, nobody else can broadcast an `OP_RETURN` from your wallet. If your wallet address is publicly recognized as yours, impersonation is natively prevented.

While conceptually straightforward, using your cryptocurrency wallet as your signing identity introduces serious practical drawbacks:
1. **Financial friction**: Every document timestamp or revision incurs an on-chain transaction fee. If network fees spike, publishing or updating a document becomes artificially expensive.
2. **Key management overhead**: Authors must maintain funded cryptocurrency wallets, manage seed phrases, and expose private keys within their automated build or deployment scripts.
3. **Loss of privacy**: The author's personal or corporate identity becomes permanently linked on a public ledger to a specific financial address, exposing wallet balances and transaction history to public block explorers.
4. **State bloat**: Writing individual document hashes directly onto an L1 chain forces every full node worldwide to permanently store personal metadata in their global state.

### 2. The OpenTimestamps model (decoupled and aggregated)

The alternative architecture—standardized by **OpenTimestamps (OTS)**, designed by Peter Todd—solves these problems by cleanly decoupling the proof of identity from the proof of anteriority.

```mermaid#narrow The OpenTimestamps model: off-chain Merkle aggregation anchored to Bitcoin.
flowchart LR
    subgraph LOCAL["Author Environment (Zero Fees)"]
        direction TB
        DOC["Original Document"] --> BUNDLE["Document + Detached Signature"]
        BUNDLE --> HASH["Initial Leaf Hash (#1st)"]
    end

    subgraph CALENDAR["Federated Calendar Aggregators (Off-Chain)"]
        direction TB
        HASH --> TREE["Off-Chain Merkle Tree"]
        OTHERS["Other Users' Hashes (#tsh)"] --> TREE
        TREE --> ROOT["Aggregated Merkle Root (#ty2y)"]
    end

    subgraph BITCOIN["Bitcoin Consensus"]
        direction TB
        ROOT --> TX["Single Bitcoin Transaction<br/>(Funded by Calendar)"]
        TX --> BLOCK["Bitcoin Block<br/>(Proof-of-Work Timestamp)"]
    end

    subgraph PROOF["Verifiable Proof"]
        direction TB
        BLOCK -.-> RECEIPT["Detached .ots Receipt<br/>(< 1 KB Merkle Path)"]
    end
```

Rather than submitting transactions directly from a crypto wallet, the process separates into three distinct components:

1. **Attribution through asymmetric identity (`SIG(doc, pk)`)**: The author signs the document using an established OpenPGP (GPG) or SSH key pair. This detached digital signature is bundled with the document to create an initial hash:
   ```text
   Initial Hash (#1st) = SHA-256(document || signature)
   ```
   A digital signature binds key possession to the statement. When that key is independently tied to an author (via GitHub, DNS records, or key directories), it provides cryptographic non-repudiation.
2. **Scalable aggregation via Merkle trees**: The author submits this initial hash (`#1st`) to a federated OpenTimestamps calendar server. The calendar server collects thousands of independent hashes (`#tsh`) from other users and structures them into an off-chain Merkle tree. Intermediate hashes (`#ty2`) are iteratively combined until a single root hash (`#ty2y`) is produced.
3. **Anchoring to Bitcoin Proof-of-Work**: The calendar server submits this single Merkle root (`#ty2y`) into the Bitcoin blockchain via an ordinary transaction.

This produces a clean separation of concerns:
* **Anteriority** is derived from the Bitcoin block header that seals the Merkle root. Note that Bitcoin block header timestamps are governed by consensus rules (the Median Time Past of the previous 11 blocks must precede the timestamp, and the timestamp cannot exceed network-adjusted time by more than 2 hours). It serves as an immutable proof of prior existence with an approximate reference time, rather than a precision atomic clock.
* **Attribution** is established by the cryptographic signature embedded inside the leaf hash (`#1st`).

Crucially, off-chain signing is necessary **specifically because of aggregation**. In OpenTimestamps, the single on-chain Bitcoin transaction is funded and signed by the calendar server operator, not by your personal wallet. Because the blockchain transaction no longer carries your signature, the Bitcoin ledger proves only that the Merkle root existed by that block—it has no knowledge of who authored the leaf document. An off-chain signature (such as an SSH key signature or signed Git commit) restores the missing identity binding without dragging back the financial cost, hot-wallet exposure, or privacy loss of direct blockchain transactions.

Because thousands of documents share the same on-chain transaction, the marginal cost to the document author is **zero**. There is no need to hold cryptocurrency, manage a wallet, or pay gas fees. The resulting proof is a tiny, detached receipt (`.ots`, typically under 1 KB) that contains only the specific Merkle path connecting the author's initial hash to the Bitcoin block header.

### Is anteriority alone enough? Why not just put your name in the text?

A practical question immediately arises: *If I embed my name and website directly into the document metadata (e.g. `author: Giovanni Filardo`) and anchor the raw file's SHA-256 into Bitcoin, doesn't that prove both existence and authorship? If a plagiarist steals my content, they can never produce an earlier Bitcoin block. Why bother with asymmetric signatures at all?*

For **99% of real-world copyright disputes and plagiarism claims, putting your name in the text and timestamping it is completely sufficient.**

Consider what an adversary faces:
* If an attacker downloads your document and its `.ots` receipt to claim priority, they are holding a cryptographic receipt that seals a file **which literally names you as the author**.
* If the attacker edits the file to change your name to theirs, the SHA-256 hash changes completely, and your existing `.ots` proof immediately fails verification.
* If the attacker creates a *new* `.ots` proof with their name on it, their Bitcoin confirmation will be mined hours, days, or years **after** yours. The blockchain mathematically proves who was first.

In many publishing and engineering workflows, **a detached private key signature is overkill**. For articles, essays, and specifications, embedding the author name directly into the source document achieves the exact evidentiary goal of prior-art protection without requiring authors or readers to maintain cryptographic keyrings.

### The two-step verification penalty

There is an even more compelling architectural reason to prefer embedded authorship over detached signatures: **verification friction**.

If you require a detached cryptographic signature (`SIG(doc, pk)`), verification becomes a cumbersome two-step ceremony:
1. **Key and signature audit**: The verifier must locate your public key, establish trust in that key (often relying on third-party key servers, DNS records, or web archives that may decay over time), and run GPG or OpenSSH verification commands.
2. **Blockchain audit**: The verifier must then run the OpenTimestamps client to verify the cryptographic path connecting the signature to a Bitcoin block.

In long-term digital preservation, complexity is the enemy of permanence. The more ceremony and external tooling required to verify a claim thirty years from now, the less likely anyone is to audit it.

In contrast, when the author identity is embedded directly into the document's validated frontmatter and timestamped as raw bytes, verification collapses into a **single, friction-free operation**:

```bash
ots verify document.md.ots -f document.md
```

Any reader on any consumer operating system can verify the text, metadata, and author attribution in a single command, without managing keys, importing certificates, or relying on external identity directories.

### What signatures actually prove (and the plausible deniability trap)

If embedding your name in an anchored document defeats plagiarism, what does the asymmetric signature (`SIG(doc, pk)`) actually accomplish?

It provides **affirmative endorsement (a canonical channel)**, not a mathematical alibi:

* **What a signature CAN prove**: It proves that a specific cryptographic key affirmatively authorized a statement. If a software patch, security advisory, or technical essay bears your valid signature, readers have mathematical certainty that it originated from the holder of that key, rather than an imposter distributing a modified payload under your name.
* **What a signature CANNOT prove (the plausible deniability trap)**: A signature cannot prove that you *did not* write an unsigned document. If an adversary drafts a defamatory or malicious text with your name on it and anchors it to Bitcoin, pointing to the absence of your signature does not provide mathematical innocence. An accuser could always argue: *"You wrote ten uncontroversial essays with your signing key, and then authored this controversial piece without signing it specifically to preserve plausible deniability."*

Cryptography only attests to operations performed with a key; it cannot prove a negative about what a human did without one. 

In the direct blockchain model, your on-chain wallet signature binds the transaction natively, but at the cost of gas fees, hot-wallet exposure, and financial surveillance. In OpenTimestamps, the calendar operator signs the Bitcoin transaction to keep the service free and private. An off-chain signature (via your SSH key or a signed Git commit) restores that missing affirmative endorsement, establishing an authentic, verifiable publication channel for your official work.

| Dimension | Proof of Anteriority (Bitcoin / OTS) | Asymmetric Signature (SSH / GPG) |
| :--- | :--- | :--- |
| **Primary Guarantee** | **Chronological precedence**: Proves a specific document existed before block N. | **Affirmative endorsement**: Proves a specific key authorized these exact bytes. |
| **Defends Against** | **Plagiarism & prior-art theft**: An adversary who copies your work cannot forge an earlier Bitcoin block. | **Spoofed official releases**: An adversary cannot counterfeit your key's explicit endorsement. |
| **Inherent Limitation** | Does not identify who originally authored or submitted the payload. | Cannot mathematically prove you didn't author an unsigned, anonymous document. |

### The temporal protection of key compromise

A common anxiety with private keys is: *What happens if my key is stolen? Does an attacker gain the ability to forge all my past writings?*

This highlights one of the most remarkable properties of combining asymmetric signatures with Proof-of-Work timestamps: **past timestamps remain immune to future key compromise.**

If an attacker compromises your machine and steals your private key today, they can produce signatures from today onward. But they **cannot backdate their theft**. To forge your historical articles, the attacker would have to insert their new signature into Bitcoin blocks mined months or years in the past—which is mathematically impossible under Proof-of-Work consensus. The blockchain timestamp acts as a strict cryptographic cutoff date.

For software developers, as we will explore in Part 2, you do not even need complex detached signature envelopes: **Git itself bridges this gap**. Signing your Git commits (`git commit -S`) binds your SSH or GPG key and document tree into an authenticated commit object before OpenTimestamps anchors it.

---

## The 30-year ledger longevity test

A timestamp is only as dependable as the network that preserves it. If you need to verify a document thirty years from now, the verification process must not depend on fragile token economics, pruning nodes, or centralized storage services.

When evaluated against multi-decade permanence, most decentralized architectures fall short:

| Network / Approach | Consensus / Storage Model | Longevity Risk |
| :--- | :--- | :--- |
| **Kaspa (KAS)** | High-throughput GHOSTDAG / blockDAG | Standard Kaspa nodes prune historical block data aggressively to maintain high block rates. Historical proofs become unverifiable to ordinary users unless they locate and query rare, dedicated archival nodes. |
| **Ravencoin (RVN)** | Native asset layer (32-byte metadata payload) | While RVN natively supports attaching arbitrary metadata to tokens, its long-term economic security and hash-rate viability present severe risks of 51% reorganizations or chain abandonment. |
| **Ethereum / EVM** | Smart contract storage (`SSTORE`) | Ethereum storage incurs high L1 gas fees. Layer-2 rollups introduce centralized sequencers, contract upgradeability keys, and multi-signature bridge assumptions that complicate multi-decade verification. |
| **Solana** | High-speed monolithic consensus | Extreme state generation forces validators to purge transaction history, offloading raw blocks to external cloud storage (BigQuery) or decentralized bridges. It cannot support lightweight, self-contained offline verification. |
| **IPFS / Filecoin** | Decentralized content addressing | IPFS is an addressable storage protocol, not an immutable clock. To keep content accessible, you must continuously pay monthly fees to pinning services or run an always-on daemon. If pinning lapses, the content disappears. |
| **Bitcoin (via OpenTimestamps)** | Proof-of-Work Nakamoto Consensus | The most secure, energy-dense, and conservative computational network on Earth. By embedding only the 32-byte Merkle root into an `OP_RETURN`, it leverages Bitcoin's multi-decade immutability with zero state bloat. |

Bitcoin is the only public ledger with nearly two decades of continuous, unbroken Proof-of-Work history. Crucially, an upgraded OpenTimestamps proof requires only the 80-byte Bitcoin block headers to verify the Merkle path. 

To verify a document thirty years from now, a future reader needs to retain only three artifacts:
1. **The original bytes**: The unedited document file (e.g. preserved in a Git repository or local archive).
2. **The detached proof (`.ots`)**: The cryptographic receipt containing the Merkle path connecting your document's digest to the Bitcoin block header.
3. **A trusted view of Bitcoin block headers**: The entire set of Bitcoin headers since the genesis block occupies less than 70 MB. A verifier can check the proof completely offline on a standard laptop without querying third-party APIs or running a multi-hundred-gigabyte archival node.

### The quantum horizon: why hash-only timestamps endure

When evaluating multi-decade permanence, engineering leaders must also consider the arrival of cryptographically relevant quantum computers.

In quantum computing theory, cryptographic primitives face two very different threat profiles:

* **Asymmetric cryptography (public keys)**: Algorithms based on prime factorization or discrete logarithms—such as RSA, ECDSA, and Ed25519—are fundamentally vulnerable to Shor's algorithm. When large-scale quantum computers emerge, public-key digital signatures can theoretically be forged.
* **Symmetric cryptography (hash functions)**: Cryptographic hash functions like SHA-256 are subject only to Grover's algorithm, which provides a quadratic speedup for brute-force search. Against SHA-256, this merely reduces effective security from 256 bits to 128 bits. In practical terms, $2^{128}$ operations remains physically impossible to brute-force under known physics, requiring more energy than the lifetime output of multiple stars.

This distinction provides a decisive architectural advantage for OpenTimestamps: **an OpenTimestamps proof is built entirely on hash functions.**

There are no elliptic curves, no RSA keys, and no public-key signatures inside the timestamp proof. From the leaf document digest, through the intermediate calendar Merkle nodes, to the Bitcoin transaction Merkle tree and the final block header Proof-of-Work, every single cryptographic link is pure SHA-256.

Even if quantum computers break wallet private keys in twenty years, they cannot retroactively rewrite historical OpenTimestamps records. To forge an earlier timestamp, an attacker would have to compute a SHA-256 collision or preimage—a task that remains quantum-resistant.

This also reinforces the architectural elegance of embedding the author's identity directly into the document's text (such as in frontmatter) rather than relying on detached digital signatures: both the content and the author claim are sealed into a single, 100% hash-based artifact that naturally inherits post-quantum permanence.

---

## Universal principles in practice

The combination of digital signatures, Merkle aggregation, and Proof-of-Work anchoring provides a universal framework for proving digital priority:

```text
Provable Record = Author Signature ──(binds to)──> Document Hash ──(anchored in)──> Bitcoin Block
```

This framework applies universally across domains:
* **Legal and corporate contracts**: Establishing execution dates without relying on proprietary, fee-charging e-signature platforms.
* **Software releases and security advisories**: Providing cryptographic proof that a security patch or binary release existed prior to a specific vulnerability disclosure.
* **Academic and technical writing**: Securing immutable prior art for research papers, patent disclosures, and engineering essays.

In the next part of this series (*Implementing decentralized timestamps*), we move from theoretical principles to practical software engineering. Using static site generation as a real-world case study, we examine how to automate this pipeline: resolving the canonicalization trap, designing an asynchronous local manifest state machine, and verifying proofs deterministically.
