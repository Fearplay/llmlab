---
document_id: ATLAS-OPS-001
title: Technical Operations Handbook
version: 1.0
effective_date: 2026-01-01
language: en
audience: employees
status: active
synthetic: true
---

# Technical Operations Handbook

This is a synthetic demonstration document for the fictional organisation Atlas Works. It is not a real law, contract or commercial policy.

## Change management

Production changes require a tracked change record, peer review, automated checks, a rollback plan, and an accountable operator. Standard changes may use an approved template. High-risk database, identity, network, and cryptographic changes require a second operator during execution.

Routine deployments occur Monday through Thursday between 09:00 and 16:00 UTC. A change outside that window needs an operational reason and on-call coverage. A failed change is rolled back unless continued mitigation is safer and the incident commander records that decision.

Emergency changes address active security risk or material service impact. They may shorten pre-deployment review but do not remove logging, authorisation, or retrospective review. The incident record links the exact change, operator, timestamps, observed effect, and rollback outcome under [[ATLAS-INCIDENT-001]].

## Access and secrets

Production access is role-based, time-limited where practical, and reviewed quarterly. Shared administrator accounts are prohibited. Automation uses a dedicated identity with the minimum scope. Secrets are stored in the approved secret manager and are never committed to source control, printed in logs, or returned to a browser.

Break-glass access requires a declared incident or written Security approval. Its credentials rotate after use. All break-glass sessions are reviewed within one business day. Customer diagnostic data follows [[ATLAS-PRIVACY-001]] and [[ATLAS-SECURITY-001]].

## Device operating limits

Atlas Hub and Atlas Dock operate from 0°C to 40°C in non-condensing indoor conditions. Atlas Sensor operates from -10°C to 50°C. Atlas Display operates from 5°C to 35°C. Unsupported temperature, liquid ingress, unapproved power supplies, or obstructed ventilation can invalidate warranty coverage under [[ATLAS-WARRANTY-001]].

## Backups and observability

Critical control-plane data is backed up daily and restoration is tested quarterly. Alerts must identify user impact, owning service, and a runbook. Logs avoid full tokens, passwords, payment details, and unnecessary document bodies. Availability objectives and maintenance communication are defined in [[ATLAS-AVAILABILITY-001]].
