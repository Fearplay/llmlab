---
document_id: ATLAS-SECURITY-001
title: Customer Security and Responsible Reporting
version: 1.0
effective_date: 2026-01-01
language: en
audience: customers
status: active
synthetic: true
---

# Customer Security and Responsible Reporting

This is a synthetic demonstration document for the fictional organisation Atlas Works. It is not a real law, contract or commercial policy.

## Customer responsibilities

Workspace Owners assign least-privilege roles, require multi-factor authentication for privileged users, remove departed members promptly, and protect API tokens. Tokens must not be embedded in public code, browser bundles, screenshots, or support chat. Device networks should restrict management access according to the deployment guide.

Atlas Works signs production firmware and validates the signature during update. Customers must not disable certificate validation or install firmware from an unverified location. Security fixes may be released outside the normal maintenance schedule described in [[ATLAS-OPS-001]].

## Reporting a concern

Suspected account compromise, exposed credentials, or a product vulnerability is reported at `security.atlas.example/report`. The report should include a concise description, affected product or service, reproduction steps that avoid real customer data, and a safe contact address. Do not attach secrets to an ordinary support case.

Atlas Works acknowledges a credible security report within one business day. This is an acknowledgement target, not a resolution promise. The reporter must not access another user's data, disrupt service, use social engineering, or publish sensitive details before coordinated review.

## Handling secrets and logs

Support agents never request a password, authenticator seed, full payment card number, or private signing key. A diagnostic bundle is uploaded only through the protected case link and expires after 24 hours. If a token appears in a report, the first action is revocation; redaction in a screenshot does not make an exposed token safe.

Security events are handled under [[ATLAS-INCIDENT-001]]. Identity recovery controls are in [[ATLAS-ACCOUNTS-001]]. Privacy retention for logs and attachments is in [[ATLAS-PRIVACY-001]].
