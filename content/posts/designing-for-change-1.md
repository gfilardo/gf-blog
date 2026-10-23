---
title: Start with the change, not the abstraction
slug: designing-for-change-1
date: "2026-10-23"
description: A useful boundary starts with understanding what changes—and why.
tags:
  - architecture
  - software
series:
  id: designing-for-change
  title: Designing for change
  part: 1
draft: false
---
An abstraction is a prediction. It says that some details will vary while something
else will remain stable. Before introducing one, it helps to ask what evidence
supports that prediction.

Consider a small application that calculates shipping costs. Its first rule is
simple: charge a flat fee. It would be easy to start with a generic pricing engine,
a plugin system, and a hierarchy of strategies. But which part actually needs to vary?

## Find a reason to change

Suppose the next requirement introduces different rates for different destinations.
That is a concrete source of variation. The calculation can now sit behind a small
boundary that accepts a destination and returns a quote.

The rest of the application does not need to know whether the quote comes from a
table, a carrier API, or a temporary promotion. It does need to know what the result
means: the amount, the currency, and whether the quote can expire.

That distinction matters. Hiding implementation details is useful only when the
boundary preserves the information its callers need.

## Keep the prediction small

A good first abstraction does not have to anticipate every future requirement.
It should make the next plausible change easier without making today's code harder
to understand.

Before adding a new layer, ask:

- What specific change would this isolate?
- Which callers would otherwise need to change with it?
- What extra complexity does the boundary introduce now?

In the next part, we'll turn that boundary into a contract and examine what it
should promise when things go wrong.
