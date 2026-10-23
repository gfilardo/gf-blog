---
title: Make the contract explicit
slug: designing-for-change-2
date: "2026-10-23"
description: A boundary becomes useful when its promises include failure, timing, and meaning.
tags:
  - architecture
  - software
series:
  id: designing-for-change
  title: Designing for change
  part: 2
draft: false
---
A method signature tells us how to call something. It rarely tells us everything
we need to rely on it.

In the first part, we separated shipping quotes from the rest of an application.
Now imagine replacing a local rate table with a remote carrier service. The inputs
and return type might stay the same, but the behavior changes substantially.

The call can time out. A destination might be unsupported. A quote might be valid
for only a few minutes. Those are part of the contract, even if the interface does
not mention them yet.

## Describe outcomes, not just values

A shipping quote should distinguish between an available rate, an unsupported
route, and a temporary failure. Returning zero for all three would keep the code
short while leaving every caller to guess what happened.

The same care applies to successful results. Does the amount include tax? Which
currency is it in? Is the price guaranteed until checkout, or merely an estimate?

These decisions belong at the boundary because they determine how other parts of
the system can safely use it.

## Test the promises

Contract tests should check observable behavior rather than internal structure.
For our example, useful cases include an unsupported destination, an expired
quote, and a carrier that fails to respond.

A replacement implementation does not need the same classes or algorithms. It
needs to honor the promises its callers depend on—or make a changed promise
explicit so those callers can adapt.

The final part will consider the next question: when does this boundary deserve
to become a separately deployed service?
