---
document_id: ATLAS-ACCOUNTS-001
title: Account Access and Identity
version: 1.0
effective_date: 2026-01-01
language: en
audience: customers
status: active
synthetic: true
---

# Account Access and Identity

This is a synthetic demonstration document for the fictional organisation Atlas Works. It is not a real law, contract or commercial policy.

## Account roles

A workspace has at least one Owner. Owners manage billing, exports, domain controls, and other administrators. Administrators manage devices and members but cannot transfer ownership. Operators manage assigned devices. Viewers have read-only access. High-impact actions require recent authentication even when a session is otherwise valid.

Shared user accounts are not supported. Each person must use an individual identity so audit records remain attributable. Service integrations use scoped service credentials rather than a human password. Owners review active members at least quarterly.

## Sign-in and recovery

Passwords must contain at least 12 characters. Atlas Works screens new passwords against a list of commonly compromised values. Multi-factor authentication is required for Owners and Administrators and recommended for all roles. Enterprise workspaces may enforce single sign-on.

A user who loses access starts recovery at `accounts.atlas.example/recover`. Support may verify control of the registered email and workspace information, but it never asks for a password, recovery code, or authenticator seed. Owner recovery can take up to two business days because a second review is required.

## Lockout and session controls

Ten failed sign-in attempts within 15 minutes trigger a 30-minute lockout for that account and source risk profile. A successful password reset revokes existing browser sessions within five minutes. API tokens remain separate and must be revoked in the Admin Console or through the security case route.

Suspected takeover should be reported immediately using [[ATLAS-SECURITY-001]]. Privacy requests follow [[ATLAS-PRIVACY-001]]. Subscription access after billing suspension follows [[ATLAS-SUBSCRIPTIONS-001]].
