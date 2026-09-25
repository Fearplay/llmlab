---
document_id: ATLAS-INCIDENT-001
title: Incident Response Playbook
version: 1.0
effective_date: 2026-01-01
language: en
audience: employees
status: active
synthetic: true
---

# Incident Response Playbook

This is a synthetic demonstration document for the fictional organisation Atlas Works. It is not a real law, contract or commercial policy.

## Severity levels

SEV-1 means widespread loss of a critical production service, confirmed material exposure of customer data, or active compromise of a privileged production control. SEV-2 means substantial degradation, a contained security event with customer impact, or failure of a major regional dependency. SEV-3 means limited degradation with a workaround. SEV-4 covers a minor defect or operational question.

Any employee may declare an incident. The incident commander confirms severity, creates the incident record, assigns Operations, Communications, and Scribe roles, and records the next update time. The first priority is safe containment and service restoration, not identifying blame.

## Response targets

For SEV-1, the on-call responder acknowledges the page within five minutes and the public status page receives an initial update within 20 minutes after confirmation. For SEV-2, acknowledgement is targeted within ten minutes and customer communication within 45 minutes when impact is externally visible. These targets measure response discipline; they are not uptime guarantees.

Evidence is preserved in the restricted incident workspace. Credentials suspected of exposure are revoked before broader analysis. Production changes follow the emergency change path in [[ATLAS-OPS-001]]. Customer reports enter through [[ATLAS-SECURITY-001]].

## Communication and closure

Updates state known impact, current mitigation, and the next update time. They avoid speculation and do not expose customer identifiers, exploit detail, or private personnel information. [[ATLAS-AVAILABILITY-001]] defines the public service-availability vocabulary.

An incident closes only after service is stable, temporary access is removed, and follow-up owners have accepted actions. A SEV-1 or SEV-2 review is drafted within five business days. The review separates contributing system conditions from individual actions and tracks corrective work to completion.
