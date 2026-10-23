---
title: Separate deployment when the boundary earns it
slug: designing-for-change-3
date: "2026-10-23"
description: Moving a module into a service should solve a concrete operational problem.
tags:
  - architecture
  - software
series:
  id: designing-for-change
  title: Designing for change
  part: 3
draft: true
---
A clear module boundary creates an option. It does not create an obligation to
move that module into a separate service.

Our shipping component can have a well-defined contract while remaining inside
the same application. Extracting it introduces a network boundary, independent
deployment, and another operational responsibility. What makes that worthwhile?

## Name the pressure

Perhaps shipping integrations change much more frequently than the checkout flow.
Perhaps carrier requests need a different scaling policy. Or a separate team needs
to release changes without coordinating every deployment.

Each is a reason to investigate extraction. None removes the need to compare the
benefit with the cost of timeouts, version compatibility, monitoring, and incident
response.

## Preserve room to recover

Before moving traffic, define how to observe the new service and how to return to
the previous implementation. Exercise failure paths, not just successful quotes.
Decide which component owns retries and how long checkout is willing to wait.

The extraction is successful when it improves the property that motivated it.
If the goal was independent delivery, measure whether releases actually require
less coordination. If the goal was reliability, examine the resulting failure
behavior rather than counting services.

Designing for change means keeping useful options available, then exercising them
when there is enough evidence. The architecture should make that decision easier,
not make it on our behalf.
