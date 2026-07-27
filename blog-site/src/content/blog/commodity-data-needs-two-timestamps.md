---
title: "Commodity data needs two timestamps"
description: "Publication time and observation time answer different questions. Mixing them can make a current dashboard tell an old story."
metaTitle: "Why Commodity Data Needs Two Timestamps"
keywords: "commodity data, observation time, publication time, data freshness, revisions"
audience: "Analysts"
pubDate: 2026-07-27
modifiedDate: 2026-07-27
author: "CommodityNode Editorial Desk"
site: commoditynode
pinned: true
---

A data point can arrive today and still describe last month. That distinction matters in commodities, where production, inventory, trade, and price series update on different calendars.

CommodityNode keeps two clocks:

- **Observation time** is the period the value describes.
- **Source time** is when the publisher released or revised it.

The collection time is recorded as well, but it should not be mistaken for either of those.

## A simple failure mode

Suppose a monthly inventory figure is published on 27 July. A dashboard that labels the value “updated 27 July” is technically correct but analytically incomplete. A reader may assume the inventory is current to 27 July even if the reporting period ended weeks earlier.

The interface should therefore show the reporting period beside the source update. When space is tight, the more important timestamp depends on the question:

- For “what did the latest report say?”, lead with source time.
- For “what period does this value represent?”, lead with observation time.
- For a revision, show both the revised period and revision time.

## Freshness and timeliness measure different delays

Freshness measures how recently a source delivered a record. Timeliness measures how close that record is to the state of the physical market. A daily source may arrive quickly and still omit part of the market. A monthly official series arrives later and may provide the authoritative figure for its defined period.

CommodityNode does not collapse those qualities into one green or red status. The source, period, delay, and coverage remain visible so the reader can decide whether the series is fit for the question.

## What to check before using a chart

1. Read the unit and reporting period.
2. Check whether the figure is preliminary, final, or revised.
3. Compare source time with observation time.
4. Look for a gap in the expected update cadence.
5. Open the original source before making a material decision.

Showing both timestamps keeps an old observation from borrowing authority from a recent publication date.
