---
document_id: ATLAS-SUPPORT-001
title: Customer Support Operations Manual
version: 1.0
effective_date: 2026-01-01
language: en
audience: employees
status: active
synthetic: true
retrieval_role: secondary
---

# Customer Support Operations Manual

This is a synthetic demonstration document for the fictional organisation Atlas Works. It is not a real law, contract or commercial policy.

## Purpose and authority

This manual describes how the fictional Atlas Works support team receives, investigates, documents, and resolves customer questions. It is an operating guide for employees, not an independent source of commercial entitlement. The policy that governs a request remains the linked customer-facing document. For example, return eligibility comes from [[ATLAS-RETURNS-001]], warranty coverage comes from [[ATLAS-WARRANTY-001]], and subscription cancellation comes from [[ATLAS-SUBSCRIPTIONS-001]]. An agent must quote the governing document rather than turning a workflow example in this manual into a new promise.

Support has three responsibilities in every case: understand the requested outcome, establish the relevant facts, and explain the applicable rule in language the customer can verify. Speed is useful only when the answer is accurate and safe. An agent must pause and obtain specialist review when an issue involves suspected account compromise, sensitive personal data, an active service incident, a threatened chargeback, or a request to override an active policy. The case record should make that pause visible instead of presenting silence as progress.

The Atlas Works knowledge base uses stable document identifiers so a decision remains auditable when a title is translated or a page is reorganised. Agents include the identifier and relevant section in internal notes for a material eligibility decision. They do not cite this manual when a more specific source controls. If two active sources appear inconsistent, the agent does not silently select one; the conflict is sent to Policy Operations with both identifiers, the observed wording, and the affected case.

## Support channels and case ownership

Routine customer questions enter through the Help Center at `support.atlas.example`. The system assigns an `AW-` case reference and records the authenticated workspace, contact address, creation time, and selected category. Customers may reply by email to an existing case, but a new email without a valid reference creates a separate case. Agents merge duplicates only after confirming that the requester, workspace, subject, and requested outcome match. A merge preserves the original references in the audit history.

The first assigned agent owns coordination until the case is explicitly transferred or closed. Ownership means keeping the next action, owner, and expected update visible. It does not mean one agent must perform every specialist task. Billing, Security, Privacy, Fulfilment, and Technical Operations can accept linked tasks while the primary case remains the customer-facing record. A transfer includes a concise summary, confirmed facts, open questions, customer expectation, and any deadline already communicated.

Security reports use the protected route in [[ATLAS-SECURITY-001]], and authenticated privacy requests use the Privacy page described in [[ATLAS-PRIVACY-001]]. An ordinary support case that contains a security secret is restricted and escalated; the agent does not copy the secret into a new ticket. Public social media is never used to exchange order numbers, serial numbers, logs, billing documents, or account evidence. The public response should direct the person to an authenticated channel without confirming whether an account exists.

## Intake and requested outcome

At intake, the agent separates the customer's description from the outcome they want. “The device stopped working” may lead to troubleshooting, warranty service, a return request, or an incident report. “I need a refund” does not establish whether the underlying item is standard hardware, configured hardware, a custom build, a subscription, or a service. Product classification is verified against [[ATLAS-PRODUCTS-001]] before a return rule is selected.

The initial record should contain the product or service name, order or workspace reference, event date, observed behaviour, requested outcome, and any deadline that appears relevant. Agents ask only for information needed to progress the case. They do not request a full payment card number, password, authenticator seed, private key, or complete API token. When a customer volunteers restricted information, the agent follows the containment steps in the security and privacy sections rather than repeating it in notes.

A good intake note distinguishes confirmed facts, customer statements, and agent inferences. A carrier scan is a confirmed external record; “the parcel was left in rain” is a customer statement until supported by available evidence; “possible transit damage” is an inference. This distinction helps the next owner evaluate the issue without treating an early hypothesis as fact. Dates include a time zone when the boundary could affect a delivery window, renewal, maintenance event, or log search.

## Identity and authorisation

Authentication proves control of a session; authorisation determines whether that person can request a particular action. The role definitions in [[ATLAS-ACCOUNTS-001]] apply. A Viewer can ask how a feature works but cannot request an export, deletion, ownership transfer, subscription cancellation, or administrator change. An Operator can discuss assigned devices but cannot obtain unrelated workspace configuration. Owners handle billing, exports, domain controls, and other administrators unless a specific enterprise agreement delegates those rights.

Agents rely on authenticated portal context for ordinary changes. Email headers, job title, familiarity with internal names, or possession of an invoice are not substitutes for an authenticated session. High-impact actions require recent authentication, and some require a second review. If an Owner cannot sign in, the recovery path at `accounts.atlas.example/recover` applies. Support can explain the process but cannot bypass its evidence or provide hints about which recovery answer was incorrect.

When a caller claims an emergency, the security of the process remains important. The agent may limit immediate harm by restricting a case, revoking an exposed token through an approved escalation, or declaring an incident. The agent must not create a new administrator, disclose private workspace data, or redirect a refund solely because the requester says delay is costly. Suspected takeover follows [[ATLAS-SECURITY-001]] and [[ATLAS-INCIDENT-001]], with the case linked after sensitive detail is moved to the restricted workspace.

## Case priority and triage

Support priority reflects customer impact, scope, workaround, and time sensitivity. It is separate from incident severity. A single blocked administrator can have an urgent support case without creating a service incident; widespread production failure may create an incident even before many cases arrive. Agents describe impact in concrete terms such as “all workspace administrators receive an authentication error” rather than adjectives such as “critical” without evidence.

Potential safety issues, active compromise, exposed credentials, or material service outages receive immediate specialist escalation. A delivery question, invoice correction, ordinary return request, or feature explanation follows its standard queue unless a documented exception applies. Repeated contact does not itself change eligibility or technical severity. It can, however, signal that the communication plan failed, in which case a support lead reviews ownership and update quality.

Triage records the next diagnostic or policy decision and the team best able to make it. An agent should not send a case to Engineering merely because the answer is unknown. The record first establishes product version, environment, reproducible steps, error text with secrets removed, and comparison to published limits. Likewise, a policy escalation states the exact ambiguity and relevant source sections. A transfer without this preparation delays the customer and creates avoidable access to data.

## Product classification

The catalog in [[ATLAS-PRODUCTS-001]] distinguishes standard hardware, configured hardware, custom hardware, prototype kits, evaluation loaners, replacement units, software plans, and professional services. The classification printed on the accepted order is the starting point. A marketing nickname, colour description, or later firmware update does not convert one class into another. When an order contains multiple line types, each line is evaluated under its own governing rule.

Standard hardware includes unmodified Atlas Hub, Atlas Sensor, Atlas Display, and Atlas Dock units from the normal catalog. Configured hardware uses an existing base with customer-selected options. Custom hardware is made from a customer drawing, uniquely engraved, or assigned a non-catalog electrical design. The return windows differ, so agents must not use the word “device” as though every physical product has identical eligibility.

The serial number identifies a physical unit; the SKU identifies the ordered catalog line. Support may request only the final six serial characters through an authenticated case for routine diagnosis. A full serial already present in a protected attachment may be used by authorised staff but should not be copied into chat summaries. Loaner due dates and replacement logistics come from their records. They are not retail purchases and do not create a new ordinary return period.

## Return requests

For standard hardware, [[ATLAS-RETURNS-001]] states that the ordinary return window is 21 calendar days from delivery to the RMA request. Configured hardware has a 14-calendar-day window. An agent verifies recorded delivery, order classification, RMA request time, and exclusions before approving eligibility. Warehouse receipt time does not replace the request time. The customer may open packaging and perform normal inspection, but installation damage, drilling, liquid, or use of an unsupported power source is not normal inspection.

An approved RMA is valid for 14 calendar days. The agent provides the authorisation, return unit list, packaging guidance, and label instructions that apply to the case. The customer should include assigned power supplies, mounting parts, and serialised components. The agent does not promise a full refund before inspection, because missing accessories or new damage can affect the warehouse result. A parcel shipped without an RMA can be delayed or returned.

Custom hardware, uniquely engraved units, delivered professional services, activated prepaid support packs, and gift cards are not ordinarily returnable. Damage or a material difference from the approved order uses a separate analysis. Policy Operations can approve a documented exception for service failure, but the exception must identify its approver, scope, and expiry. One exception does not amend the active policy or entitle other customers to the same result.

## Damaged, incorrect, and missing deliveries

Transit damage or an incorrect SKU should be reported within five calendar days of delivery under [[ATLAS-RETURNS-001]]. Support compares the order line, delivery scan, external packaging, product label, and customer photographs where available. Photographs should avoid faces, home interiors beyond what is necessary, and unrelated address information. If the available evidence confirms a qualifying case, Atlas Works provides the approved prepaid return route.

A non-delivery report follows [[ATLAS-SHIPPING-001]]. The carrier scan is initial evidence, not an unchallengeable conclusion. The case records the order number, confirmed delivery address, scan time, carrier notice, safe-location information, and whether the customer checked building reception or an authorised recipient. Orders worth USD 750 or more normally require a signature unless an enterprise arrangement says otherwise.

An order is not considered lost solely because it missed an estimated date. Under the shipping policy, the carrier must have no scan for seven consecutive calendar days after the estimated delivery date before the lost-parcel condition is met. An address redirect requested after the order reaches `packed` is not guaranteed. Refusing a cross-border parcel to avoid duties is not an approved return, and documented carrier or handling costs may be deducted as the shipping policy explains.

## Refund investigation and settlement

Support establishes eligibility; the warehouse establishes the returned condition; Billing submits an approved refund. These are related but distinct stages. The customer-facing explanation should identify the current stage instead of saying only that a refund is “processing.” [[ATLAS-RETURNS-001]] states that approved refunds are processed within five business days after warehouse inspection completes. The customer's bank or card network controls any additional posting time.

Refunds return to the original payment route unless that route is legally or technically unable to receive them. An agent cannot redirect funds to an unrelated account, even when the customer presents a plausible reason. Store credit is used only with customer agreement when the original route cannot accept settlement. A priority shipping surcharge is not refunded for buyer remorse; original standard shipping is refunded when Atlas Works sent the wrong item or verified transit damage.

If a customer sees two charges, the agent first distinguishes pending authorisation from settled charge. [[ATLAS-BILLING-001]] gives Billing three business days to investigate two settled charges with the same order reference. A chargeback can pause a parallel refund to avoid duplicate settlement. Support never asks the customer to pay a release fee, purchase a gift card, reveal a one-time password, or open remote-control software to receive a refund.

## Warranty cases

Return eligibility and warranty coverage solve different problems. An ordinary return allows an eligible purchase to be sent back within its window; a warranty addresses a covered manufacturing defect during the coverage period. [[ATLAS-WARRANTY-001]] gives Atlas Hub, Atlas Display, and Atlas Dock a 24-month limited warranty from delivery, while Atlas Sensor has 18 months. A replacement inherits the later of 90 calendar days from replacement delivery or the remaining original warranty.

The intake record contains the order number, exact product name, final six serial characters, firmware version, concise symptom, and steps already attempted. Support begins with safe configuration checks and known issues. It does not ask a customer to bypass grounding, open a sealed power supply, disable certificate validation, install unsigned firmware, or repeat a test that risks data or physical damage.

When a hardware defect is probable, Support may issue an RMA. Atlas Works may repair, provide the same or an equivalent model, or refund the depreciated purchase price when other remedies are not reasonable. A customer does not automatically select a newer model. Atlas Care Plus advance replacement requires the failed unit to be scanned by the return carrier within ten calendar days after replacement arrives; otherwise the account may be billed for that replacement.

## Subscription questions

Atlas Cloud Core, Fleet, and Audit use the plan definitions in [[ATLAS-SUBSCRIPTIONS-001]]. Agents verify the workspace, role, billing period, activation date, current plan, attached capacity packs, and requested effective date. Monthly plans renew on the activation day; annual plans renew on the activation date. If a month lacks that day, renewal occurs on the month's final day.

An Owner may cancel before the renewal timestamp in the Admin Console. Cancellation prevents the next renewal and leaves access active through the paid period. Ordinary mid-period cancellation does not create a prorated refund. An upgrade can take effect immediately with a previewed prorated amount, while a downgrade takes effect at renewal. Removing capacity can require a device reduction first.

After a failed renewal and two unsuccessful retry attempts over seven calendar days, Atlas Works may suspend access. Recoverable workspace data is retained for 30 calendar days after billing suspension and then scheduled for deletion according to [[ATLAS-PRIVACY-001]]. Support should recommend export before the paid period ends but cannot guarantee restoration after deletion begins. Security or abuse suspension follows the security process and can occur immediately.

## Billing and invoice questions

The invoice is interpreted using [[ATLAS-BILLING-001]]. Agents can explain seller identity, purchaser details, order lines, discount, shipping, and displayed tax treatment. A clerical correction requested within 30 calendar days of invoice issue may update permitted information, but it does not transfer a completed purchase between unrelated legal entities. Enterprise payment terms require written approval; a support conversation cannot create them.

Currency on the order remains the refund currency. A card issuer may present a different home-currency amount or conversion fee, which Atlas Works does not control. Tax depends on billing and delivery information provided for the transaction. A tax exemption must normally be validated before finalisation unless the fictional accounting schedule allows a later correction.

The case record should not contain a full card number, card verification value, online-banking credential, or one-time passcode. The last four digits displayed by the approved billing system can be used to distinguish payment methods. When a screenshot includes more data than necessary, the agent asks the customer to use the protected upload path and restricts access; the agent does not download it to a personal device for editing.

## Account access and recovery

Account roles, password requirements, multi-factor authentication, lockout, and recovery come from [[ATLAS-ACCOUNTS-001]]. Passwords require at least 12 characters and are screened against compromised values. Ten failed sign-in attempts within 15 minutes trigger a 30-minute lockout for the account and source risk profile. An agent should explain the remaining wait or recovery route without manually weakening the control.

A successful password reset revokes browser sessions within five minutes. API tokens are separate and must be revoked in the Admin Console or through a security case. Support must not imply that a password reset invalidates every integration credential. Owners and Administrators require multi-factor authentication; enterprise workspaces may also enforce single sign-on. The investigation records whether the failure occurs before identity-provider redirect, during authentication, or after the user returns to Atlas Cloud.

Owner recovery can take up to two business days because it requires a second review. The Help Center may verify the registered email and workspace facts but never requests a password, recovery code, or authenticator seed. A support lead cannot skip the second review merely because the workspace has a billing deadline. If compromise is suspected, the recovery and incident paths operate together under restricted access.

## Privacy requests and data minimisation

Privacy requests use the authenticated workflow in [[ATLAS-PRIVACY-001]]. An Owner can request export or deletion from the Privacy page. Atlas Works acknowledges the request within three business days and normally completes it within 30 calendar days. Verification occurs before fulfilment. Records associated with an unresolved payment dispute, active incident, documented retention obligation, or legal hold can be excluded from immediate deletion.

Agents collect the minimum data needed for the current purpose. A log excerpt should cover the affected time, service, request identifier, and error, not an entire environment by default. Support attachments are normally deleted 60 days after case closure unless linked to an active security investigation, warranty process, or legal hold. Copying an attachment to an unrelated case restarts neither its purpose nor its retention basis.

Deleting a user removes access but does not rewrite attributable audit history. A stable pseudonymous identifier can replace a display name in retained audit records. The standard Atlas Sensor reports occupancy state and environmental measurements; it does not record speech or store raw audio. An agent must not infer that a sensor captured a conversation or request audio evidence that the product does not create.

## Security reports and secret exposure

Suspected compromise, exposed credentials, or vulnerability reports use `security.atlas.example/report` as stated in [[ATLAS-SECURITY-001]]. A credible report is targeted for acknowledgement within one business day, but that target is not a promise of resolution. The initial support task is safe routing and containment, not debating severity in a public thread.

If a token, password, private key, authenticator seed, or signing material appears in a case, treat it as exposed. Restrict the record, notify Security, and revoke or rotate the credential through the approved owner. Redaction after exposure does not make a token safe. Agents should not test a customer token from a workstation or paste it into a command, issue tracker, chat channel, or diagnostic tool.

Responsible research must avoid accessing another user's data, disrupting the service, social engineering, or premature publication of sensitive detail. Support can acknowledge receipt and set expectations but does not promise a bounty or safe-harbour decision. Security coordinates any technical exchange. Customer-visible updates omit exploit detail, private personnel information, and identifiers that would increase risk.

## Service incidents and availability

An agent who sees evidence of widespread service impact checks the status page and internal incident channel, then links affected cases to the declared incident. The public vocabulary in [[ATLAS-AVAILABILITY-001]] is Operational, Degraded Performance, Partial Outage, and Major Outage. Agents do not invent an incident state or publish an unapproved cause.

Atlas Cloud has a monthly 99.9% availability objective for authenticated API and Admin Console requests. It is an engineering objective, not a contractual service-level agreement. Support must not calculate or promise credits from it. Exclusions include customer network failure, unsupported clients, eligible suspension, announced maintenance, and applicable force-majeure conditions. A partial feature can still warrant an incident even if the broad success measure remains above the objective.

Routine maintenance is scheduled for Tuesdays from 01:00 to 03:00 UTC. Work expected to interrupt customers is targeted for announcement at least five calendar days in advance. Urgent security maintenance can occur at any time. During a declared event, agents repeat confirmed impact, current mitigation, and next update time. They do not offer speculative root cause or individual restoration times not approved by the incident commander.

## Technical diagnostics

Diagnostics begin with the customer's goal, product, version, environment, time of failure, reproducible action, observed result, and expected result. For cloud requests, include the safe request identifier and region. For hardware, include product name, firmware, power state, network state, and final six serial characters. An error message may be quoted after tokens, addresses, and personal data are removed.

Agents select the least invasive test that can distinguish plausible causes. They do not ask for a factory reset before preserving needed configuration, reinstall firmware merely to “try something,” or collect a broad diagnostic bundle when a narrow log is enough. Unsupported temperature, liquid ingress, blocked ventilation, and unapproved power equipment are evaluated against [[ATLAS-OPS-001]] and can affect warranty coverage.

A diagnostic bundle uses the protected case link and expires after 24 hours under [[ATLAS-SECURITY-001]]. The case records who requested it, why it is needed, its date range, and which specialist may access it. Support avoids pasting full logs into ordinary notes. If reproduction would touch another customer, production data, or an unsafe device condition, Engineering constructs a controlled test instead.

## Escalation and exception handling

An escalation is a request for a defined decision, not a place to send uncertainty. The sending agent states the requested outcome, governing documents, facts already verified, evidence location, attempted actions, risk, and deadline. The receiving team either accepts ownership of the decision or returns a specific missing requirement. Repeated reassignment without new information triggers support-lead review.

Policy exceptions require the authority named by the policy or Policy Operations. The record includes the approver, exact scope, reason, affected order or workspace, financial limit if relevant, and expiry. The customer receives the outcome, but internal deliberation and unrelated customer examples are not disclosed. An exception solves the identified case and does not amend the published rule.

Security, Privacy, Legal, and Finance may restrict case visibility. The primary agent retains a customer-safe summary and next update without copying restricted evidence. If a source conflict blocks a decision, Policy Operations is asked to resolve the text before agents establish a pattern of inconsistent outcomes. The final case references the resolved source version.

## Customer communication

Every substantive response should answer four questions: what Atlas Works understands, what source or evidence applies, what will happen next, and when the customer should expect another update. Short sentences and exact dates reduce ambiguity. “Within five business days after warehouse inspection” is more useful than “soon,” because it identifies the event that starts the clock.

Agents preserve official product names and document identifiers. They may communicate in the customer's supported language, but quoted evidence can remain in English. Translation must not change a deadline, product classification, exclusion, or responsible team. When a term has no clear equivalent, include the exact English term beside the explanation. Machine translation of a message does not replace specialist review for a contested commercial decision.

The tone should be calm and direct. An apology can recognise inconvenience without admitting an unverified cause. Agents do not blame a carrier, bank, colleague, or customer before investigation. They also avoid claiming that a synthetic example, engineering objective, or internal target is a legal guarantee. The fictional nature of this demonstration corpus should remain clear in product documentation.

## Case notes and evidence quality

Internal notes are factual, necessary, and respectful. They state who performed an action, the time, the system or source used, the result, and the next owner. They avoid speculation about motive, medical details, protected characteristics, or irrelevant personal circumstances. A note is not a private chat; authorised reviewers and auditors may rely on it later.

Material policy decisions cite the document identifier and section. Evidence links point to approved systems rather than local downloads. If a screenshot or log is superseded, the case preserves the reason and authorised disposition instead of silently replacing history. Corrections are appended with their author and time. Agents never backdate an approval or edit a customer quote to improve clarity without marking it as a summary.

Before closure, the owner confirms that the requested outcome was answered, specialist tasks are complete, promised documents were sent, temporary access is removed, and the resolution code matches the facts. Closure does not mean every customer agrees; it means Atlas Works has completed the applicable process and explained any remaining external dependency or appeal path.

## Attachments and restricted information

The protected upload route is used for diagnostics, identity evidence, warranty photographs with labels, and billing documents. Ordinary email attachments are discouraged when the portal is available. Agents inspect only files relevant to the case and do not copy them to personal storage, consumer file-sharing services, or unapproved analysis tools. Malware warnings are escalated rather than bypassed.

Customers should remove unrelated people, addresses, credentials, and background detail from images. Support can describe what portion is needed: for example, the damaged connector and product label rather than a whole room. Full serial numbers and delivery labels remain restricted to authorised case users. Published screenshots must use demonstration data and cannot be derived from a real customer case.

Retention follows [[ATLAS-PRIVACY-001]]. A support attachment is normally deleted 60 days after closure unless a valid linked process requires it. Deletion from the primary case does not permit an agent to retain a convenience copy. Legal hold, security investigation, and warranty logistics have documented owners and end conditions.

## Quality review and coaching

Support quality review samples cases for accuracy, safety, completeness, clarity, and appropriate access. Reviewers check whether the agent used the governing source, verified authority, protected sensitive data, recorded the next action, and avoided unsupported promises. A fast response with an incorrect return window is not high quality. A safe escalation with a precise question can be.

Coaching uses de-identified examples where practical. Reviewers do not paste customer correspondence into public training tools. A recurring mistake can indicate a confusing workflow or knowledge gap, not only individual performance. The owner records whether the corrective action is training, interface change, source clarification, automation, or control improvement.

Policy Operations reviews search failures and conflicting interpretations. Content owners update the specific policy and cross-links; they do not rely on an agent macro to correct an active source. When a policy version changes, old cases retain the source that governed their decision. New cases use the active version according to its effective date.

## Shift handover and continuity

A case that remains open across a shift has a handover containing current status, customer impact, last communication, next action, next update time, specialist contacts, and restricted evidence location. The outgoing agent does not merely tag the next queue. The incoming owner acknowledges the handover and checks any near-term commitment before taking new work.

For an active incident, the incident command structure in [[ATLAS-INCIDENT-001]] controls operational roles. Support provides case volume, affected workflows, representative symptoms, and customer questions without flooding the incident channel with duplicate reports. Approved public updates are reused consistently. Individual cases record customer-specific recovery only after the shared service status is stable.

If the Help Center is unavailable, the continuity procedure can accept minimal cases through the approved backup channel. Once service returns, each item receives an `AW-` reference and the original receipt time. The backup path does not weaken authentication for high-impact actions, accept secrets in public messages, or allow local spreadsheets to become a permanent case system.

## Common boundary examples

A customer asks to return an unopened Atlas Hub 18 days after recorded delivery. The order shows standard hardware, so the agent uses the 21-calendar-day rule in [[ATLAS-RETURNS-001]], verifies the other conditions, and can issue an RMA. The same request for configured hardware uses the 14-calendar-day rule and would be outside its ordinary window. The agent does not call both products simply “hardware” when explaining the different outcome.

A customer reports an Atlas Sensor failure ten months after delivery. The ordinary return window has ended, but the 18-month Sensor warranty in [[ATLAS-WARRANTY-001]] may apply. Support gathers the safe diagnostic facts and evaluates exclusions. The agent does not deny help merely because a return is unavailable, and does not promise replacement before confirming probable defect and coverage.

A workspace Owner cancels an annual Atlas Cloud Fleet plan before renewal and asks for the unused current period back. [[ATLAS-SUBSCRIPTIONS-001]] says cancellation stops the next renewal while access continues through the paid term; ordinary mid-period cancellation is not prorated. If the customer instead identifies a duplicate subscription charge, Billing investigates that distinct issue.

A Czech-speaking customer asks how quickly an approved refund is processed. The agent can answer in Czech while preserving “ATLAS-RETURNS-001” and “Refund processing,” and may show the original English evidence. The fact remains five business days after warehouse inspection. Translation cannot remove the dependency on completed inspection or convert business days to calendar days.

## Limits of this demonstration

Atlas Works, its products, domains, prices, addresses, schedules, and policies in this corpus are fictional. They exist to test retrieval, grounded generation, citations, language handling, and refusal behaviour. They must not be represented as real consumer rights, security commitments, employment terms, or service guarantees. Demonstration users should not submit real personal data, credentials, private documents, or production incidents.

The support workflow cannot answer unrelated general-knowledge questions. When the source set does not contain a relevant answer, the system should say that the information cannot be determined from the available knowledge base. It should not use outside knowledge to fill the gap. A clear refusal is a correct result when evidence is absent.

This manual intentionally overlaps vocabulary across returns, billing, identity, privacy, security, availability, and technical operations. Retrieval must therefore use the question and evidence, not a single keyword. A result is useful only when its specific section supports the requested claim. The final answer should cite the governing document rather than treating a high similarity score as proof.

The manual is marked as a secondary retrieval source because it summarises workflows owned by more specific policies. That label does not hide it from search: operational questions about intake, handover, evidence quality, escalation, or support communication should still retrieve its sections. For an entitlement question, a directly applicable primary document should rank ahead when both sources support the same terms. This distinction is part of the corpus metadata and is applied consistently by the retrieval layer rather than by a prewritten answer.

Examples describe how an agent should reason from documented facts; they are not a list of approved outcomes. A demonstration can change when a source version changes, when an order has different attributes, or when evidence establishes a valid exception. New users should inspect the retrieved excerpt, document identifier, section, path, and separate dense and lexical scores before judging an answer. The interface exposes those details so a plausible sentence cannot substitute for provenance.

No section in this manual authorises a cloud provider to receive the entire corpus. The RAG pipeline selects a limited set of relevant chunks and sends only the question and selected evidence when a user explicitly chooses Cloud mode. Fixture mode keeps generation deterministic and offline, while Local mode uses the configured local generator. These execution modes change generation provenance; they do not change which tracked Markdown files form the synthetic knowledge base.
