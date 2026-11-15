---
title: Quorum is a game
summary: Quorum simplifies real systems on purpose. Check the real thing before you act on what you learn here.
section: about
order: 0
aliases: disclaimer, accuracy, simplification, simulation, real products, trademarks, legal, contact
---

Quorum is a game for learning system design. It is not an exact model of any real system, product,
or company. Read the wiki the same way you play the game: as a way to learn the ideas, not as a
reference for production decisions.

## The name

Quorum is the name of the game, and it comes from the distributed systems term. A quorum is the number of replicas that must agree before an operation succeeds, so with 5 replicas a majority of 3 can still decide when 2 are down. The game does not teach only that idea. It uses the word as a name because a quorum is how a group of servers keeps working when some of them fail. Pages that explain the technique say "a quorum" in lowercase.

## Simplifications are on purpose

Quorum tries to stay close to how real systems behave, but it trades accuracy for a game that stays
fun to play. A rule stays in the game when it keeps the important part of the behavior, even when it
leaves out detail. For example, daily traffic in Quorum is one smooth wave, but real traffic has two
peaks, holidays, and launches. The [Reality check](/design/reality-check) lists each rule, the
real-world claim behind it, and what the game leaves out.

The numbers are tuned for play, too. A latency, a price, or a capacity on a Component card can differ
from what a real product gives you. Products also change after the wiki is written.

## Check the real thing before you decide

Do not use Quorum to choose an architecture, a vendor, a budget, or a capacity plan for a real
system. Read the vendor's documentation, measure your own workload, and ask people who run that
system in production. The game teaches you which questions to ask. Your own system gives the answers.

## Real products and companies

Components, Runtimes, and incidents often name the real product or technology they stand for, so you
can look it up. These names belong to their owners. Their use here does not mean that the owner
supports or is connected to Quorum.

A strength or a weakness that a product has in Quorum is a game choice, made to show a tradeoff. It
is not a review or a judgment of that product, and it is not meant to show any product in a bad
light.

If you own or work on a product that Quorum mentions and you want it shown differently, or removed,
email [hi@elianiva.com](mailto:hi@elianiva.com).
