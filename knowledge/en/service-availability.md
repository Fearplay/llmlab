---
document_id: ATLAS-AVAILABILITY-001
title: Service Availability and Maintenance
version: 1.0
effective_date: 2026-01-01
language: en
audience: customers
status: active
synthetic: true
---

# Service Availability and Maintenance

This is a synthetic demonstration document for the fictional organisation Atlas Works. It is not a real law, contract or commercial policy.

## Service objective

Atlas Cloud has a monthly availability objective of 99.9% for authenticated API and Admin Console requests. An objective is an engineering target, not a contractual service-level agreement. A customer contract may contain separate terms; Support must not infer credits from this document.

Availability excludes customer network failure, unsupported client software, suspension for non-payment or abuse, announced maintenance within the window below, and force-majeure conditions in a governing agreement. A partial feature failure can still be an incident even when the overall request-success calculation remains above the objective.

## Maintenance

Routine maintenance is scheduled for Tuesdays between 01:00 and 03:00 UTC. Atlas Works aims to announce work expected to cause customer-visible interruption at least five calendar days in advance. Maintenance that requires no interruption may occur without a status-page notice. Urgent security maintenance may occur at any time and should be communicated as soon as disclosure is safe.

## Status and support

The status page uses Operational, Degraded Performance, Partial Outage, and Major Outage. It reports observed service condition rather than individual account configuration. Customers should include region, timestamp, request identifier, and affected operation in a support case, but must remove access tokens.

Incident response roles and notification targets are defined in [[ATLAS-INCIDENT-001]]. Subscription billing and cancellation remain governed by [[ATLAS-SUBSCRIPTIONS-001]]. Technical deployment limits are in [[ATLAS-OPS-001]].

## Recovery expectations

Atlas Works maintains encrypted backups for critical control-plane data and tests restoration quarterly. The internal recovery point objective is 24 hours and the recovery time objective is eight hours for a regional control-plane loss. These planning objectives do not promise recovery of transient telemetry or data already deleted under [[ATLAS-PRIVACY-001]].
