# QuantWarden User Guide and Client Operational White Paper

**Product:** QuantWarden — Quantum-Proof Scanner
**Document purpose:** End-user onboarding, operating procedures, dashboard reference, and client handoff
**Default authentication mode:** Username and password
**Document version:** 1.0
**Last updated:** 16 July 2026

---

## Contents

- [Executive summary](#1-executive-summary)
- [Account registration and sign-in](#5-registering-an-account)
- [Creating and onboarding an organization](#7-creating-an-organization)
- [Initial automated scan flow](#8-the-initial-automated-scan-flow)
- [Invitations, inbox, and joining](#9-joining-an-existing-organization)
- [Dashboard and screen reference](#10-navigation-and-dashboard-structure)
- [Scan types and Activity Monitor](#15-scan-types-and-when-to-use-them)
- [Team Management and RBAC](#21-team-management)
- [Operations and troubleshooting](#23-recommended-day-to-day-operating-procedure)
- [Screenshot and client handoff checklists](#29-screenshot-production-checklist)

---

## 1. Executive Summary

QuantWarden is a multi-organization security platform for discovering internet-facing assets, identifying exposed services, analyzing TLS and certificate configurations, producing a cryptographic bill of materials (CBOM), and measuring post-quantum cryptography (PQC) readiness.

The normal user journey is:

1. Register a username-based account.
2. Create or join an organization.
3. Add one or more root domains during organization onboarding.
4. Configure organization visibility, joining rules, roles, and invitations.
5. Allow the automated initial workflow to complete:
   - subdomain discovery;
   - port and service discovery;
   - OpenSSL TLS and certificate analysis.
6. Review the Security Overview, Discoveries, CERT-IN CBOM, PQC Posture, and asset-level findings.
7. Run, queue, or schedule additional scans as the environment changes.
8. Use the Activity Monitor to follow shared scan progress and investigate failures.

For a small organization with a limited number of domains and reachable endpoints, the first workflow will often take a few minutes. The actual duration depends on the number of root domains, discovered subdomains, configured ports, network responsiveness, DNS behavior, backend capacity, and whether other organization scans are queued.

QuantWarden deliberately withholds overview and PQC conclusions until sufficient discovery and TLS analysis have completed. During this period, the dashboard displays an explicit message asking the user to let the first complete scan finish.

> **Screenshot placeholder 01 — Completed organization dashboard**
> Insert a full-screen screenshot of an organization after the initial workflow has completed. Include the left navigation, Security Overview, and Activity Monitor. Use this as the opening product image.

---

## 2. Audience

This guide is intended for:

- client administrators responsible for introducing QuantWarden;
- organization owners and security administrators;
- infrastructure, SOC, vulnerability management, and cryptography teams;
- analysts reviewing endpoint and certificate posture;
- auditors consuming CBOM and PQC evidence;
- support teams assisting users with invitations, joining, or scans.

The guide describes the default username-first deployment. Email authentication and email invitations are optional build-time/deployment features and may not be visible in the client environment.

---

## 3. Product Concepts

### 3.1 Account

An account identifies an individual user. In the default configuration, the user signs in with:

- a unique username;
- a password;
- a display name used in the interface.

The default flow does not require an email address. Internally, the platform maps username accounts to a system-managed address so that invitation and membership records can use a common data model. Users should continue to work with their visible username and should not treat the internal address as a real mailbox.

### 3.2 Organization

An organization is an isolated workspace containing:

- members and roles;
- root domains, subdomains, IP addresses, and ports;
- scan configuration and scan history;
- TLS, certificate, CBOM, and PQC results;
- reports and organization-level analysis.

A user may belong to multiple organizations and may have a different role in each one.

### 3.3 Root and leaf assets

- A **root asset** is a primary domain or IP address placed directly into scope, such as `example.com`.
- A **leaf asset** is a subdomain or IP address discovered automatically or added manually, such as `api.example.com`.
- Assets may be grouped into functional buckets such as API, Payments, Internet Banking, Public Web, or a custom client-defined bucket.

### 3.4 Scan engines

QuantWarden uses three principal discovery and analysis engines:

| Engine | Purpose | Typical output |
| --- | --- | --- |
| Subdomain Discovery | Maps public subdomains beneath a root domain. | Newly discovered domains and parent-child relationships. |
| Port Discovery | Checks configured TCP or UDP ports and identifies reachable services. | Open ports, protocols, service labels, and resolved targets. |
| OpenSSL TLS Scan | Inspects TLS negotiation, certificates, ciphers, groups, and protocol support. | Certificate health, TLS versions, cipher posture, key exchange information, and PQC evidence. |

### 3.5 Scan scope

Most scan operations use one of the following scopes:

- **Single:** one asset;
- **Group:** a selected set of assets;
- **Full:** all eligible assets in the organization.

### 3.6 Shared organization scan lock

Scan activity is coordinated at the organization level. When a scan is already active, a newly requested scan may be queued instead of starting immediately. This avoids competing scans producing inconsistent progress or overloading the scanning services.

---

## 4. Before You Begin

For the cleanest first run, have the following information ready:

- your preferred username;
- a password of at least eight characters;
- the organization name;
- a short organization code or slug;
- one or more authorized root domains;
- the usernames of colleagues to invite;
- the initial role each colleague should receive;
- a decision on whether users may join immediately or require approval.

Only scan domains, systems, and services that the organization owns or is explicitly authorized to assess.

---

## 5. Registering an Account

### 5.1 Default username registration

1. Open the QuantWarden registration page.
2. Enter your full name.
3. Choose a username.
4. Enter a password.
5. Select the registration action.
6. After successful registration, continue to the organization page.

Username requirements:

- 3 to 32 characters;
- lowercase letters and numbers are supported;
- dots, underscores, and hyphens are supported;
- spaces and email syntax are not used for username registration;
- the username must be unique.

Passwords must contain at least eight characters. Client security policy may require a stronger password than the platform minimum.

> **Screenshot placeholder 02 — Username registration**
> Capture the registration form in its default username mode. Show the full-name, username, password fields, and the note that no email is required.

### 5.2 Signing in

1. Open the QuantWarden login page.
2. Enter your username.
3. Enter your password.
4. Select **Sign In** or the equivalent login action.

If both username and email authentication were enabled by the deployment administrator, the page may display a method selector. Username remains the default method unless the deployment has been configured otherwise.

> **Screenshot placeholder 03 — Default login screen**
> Capture the username/password login form. Ensure that email login is not shown in the default build.

### 5.3 Password recovery

Username accounts do not depend on a recovery mailbox. If a user forgets the password:

1. Contact an organization owner or a member with Team Management permission.
2. The administrator opens **Team Management**.
3. The administrator opens the affected member’s actions.
4. The administrator selects **Reset Password** and follows the prompt.
5. The new password should be communicated through an approved secure channel.

### 5.4 Optional email mode

When email authentication is enabled by the deployment administrator:

- users may sign in through the configured email OTP or magic-link flow;
- invitations may be sent to email addresses;
- unregistered email recipients may register through an invitation link;
- SMTP must be correctly configured.

Email functionality is not required for the standard username-based deployment.

---

## 6. The All Organizations Screen

After signing in, the user reaches the organization landing page.

The screen provides:

- cards for every organization the user belongs to;
- the user’s role in each organization;
- public or private organization status;
- member counts;
- organization code or slug;
- **Create** and **Join** actions;
- pending join requests;
- organization owner actions such as deletion;
- copy-code and share-link actions.

Selecting an organization card opens that organization’s dashboard.

> **Screenshot placeholder 04 — All Organizations**
> Capture a user with at least two organization cards, including role badges, member counts, and the Create and Join buttons.

### 6.1 Organization code

The organization code is the organization slug shown on the card. It is used to:

- identify the organization in URLs;
- let users request or obtain membership;
- share a concise joining reference.

Treat the code as an identifier, not as a secret. Access is still controlled by organization joining policy and RBAC.

---

## 7. Creating an Organization

### 7.1 Create the workspace

1. Select **Create Organization**.
2. Enter the organization name.
3. Review the automatically generated organization code, or enter an approved custom code.
4. Confirm that the code is available.
5. Create the organization.

The creator becomes the organization owner and is taken into the four-step onboarding process.

> **Screenshot placeholder 05 — Create Organization**
> Capture the creation dialog with organization name and organization code fields visible.

### 7.2 Onboarding step 1: visibility and joining approval

Configure two separate controls.

#### Organization visibility

- **Hidden — default:** the organization does not appear in discovery or search. Users need the exact organization code or an invitation.
- **Public:** the organization may be discoverable by name.

#### Joining approval

- **Private — default:** owners or users with Team Management permission must approve joining requests.
- **Public:** a user with the correct joining code can join immediately.

Recommended client default:

- Hidden visibility;
- Private joining approval.

This provides deliberate membership control while still allowing administrators to share the organization code when needed.

> **Screenshot placeholder 06 — Visibility and joining policy**
> Capture onboarding step 1 with Hidden and Private selected. Include both control groups in the image.

### 7.3 Onboarding step 2: root domains

Add the organization’s root domains.

1. Enter a domain such as `example.com`.
2. Select **Add**.
3. Repeat for additional domains, or paste multiple domains separated by spaces, commas, or new lines.
4. Review the resulting list.
5. Remove any domain that should not be scanned.

Do not include:

- URL schemes such as `https://`;
- paths such as `/login`;
- query strings;
- domains that are outside the authorized assessment scope.

Add the domain as a hostname, for example:

```text
example.com
portal.example.com
```

The root domains entered here are the starting points for the automated initial discovery workflow.

> **Screenshot placeholder 07 — Root domain onboarding**
> Capture onboarding step 2 with two example root domains in the table. Include the explanatory text about automatic subdomain discovery.

### 7.4 Onboarding step 3: roles and RBAC

Review the default roles and their permissions.

QuantWarden separates three configurable permission areas:

| Permission | Allows the member to |
| --- | --- |
| Team Management | Invite and remove members, approve or deny join requests, and assign member roles. |
| Scan Configuration | Start, queue, stop, and schedule permitted scans. |
| Asset Management | Add or remove domains, subdomains, IPs, ports, and related asset configuration. |

System roles:

| Role | Default intent |
| --- | --- |
| Owner | Full control over the organization, membership, roles, assets, and scans. |
| Administrator | Operational administration across team, scans, and assets. |
| Analyst | Read and analysis role that can be granted selected scan or asset permissions by policy. Team Management remains restricted. |
| Auditor | Read-oriented role with system permissions locked off for team, scan, and asset changes. |

The owner may create custom roles with any appropriate combination of Team Management, Scan Configuration, and Asset Management permissions. Custom roles may also have a display name and color.

Important RBAC behavior:

- the owner role cannot be reassigned through normal member role changes;
- system-role locked permissions cannot be overridden;
- navigation screens may remain visible even when mutation controls are disabled;
- users without scan permission can review results but cannot launch scans;
- users without asset permission can review inventory but cannot change it;
- users without team permission cannot invite members or process join requests.

> **Screenshot placeholder 08 — Role configuration**
> Capture the RBAC matrix showing Administrator, Analyst, Auditor, the three permission columns, and the Add Custom Role action.

### 7.5 Onboarding step 4: invite the team

The default deployment invites users by username.

1. Enter one or more usernames.
2. Separate multiple usernames with spaces, commas, or new lines.
3. Add the usernames to the pending invitation table.
4. Select a role for each user.
5. Review the list.
6. Select **Send Invitations**.

Username invitations:

- are delivered through the recipient’s in-app invitation inbox;
- use the exact username entered by the inviter;
- expire after seven days;
- may be revoked while pending;
- do not require SMTP.

If the target user has not registered yet, the user should register with the exact invited username. The invitation will then be associated with that username account.

When email mode is enabled, the same form can also accept email addresses. Email recipients receive a link if SMTP delivery succeeds, and the invitation remains available in the in-app inbox.

> **Screenshot placeholder 09 — Invite users during onboarding**
> Capture at least two usernames with different role selections, plus the Send Invitations button.

### 7.6 Share the organization code

The final onboarding step also provides the organization code.

- For a public-join organization, a user with the code can join immediately.
- For a private-join organization, the user’s request appears in **Team Management → Joining Requests** and must be approved.

### 7.7 Complete onboarding

Select **Go to Dashboard**.

On completion:

- the organization setup is marked complete;
- root domain assets are stored;
- onboarding roles are saved;
- one automated onboarding workflow is created for each root domain;
- the scan worker is notified to begin processing.

The user may enter the dashboard immediately. Analysis pages will show a first-scan notice until the workflow has produced sufficient results.

---

## 8. The Initial Automated Scan Flow

### 8.1 Workflow sequence

For each onboarding root domain, QuantWarden performs:

```text
Root domain
  → Subdomain discovery
  → Port and service discovery
  → OpenSSL TLS and certificate analysis
  → Overview, CBOM, and PQC analysis available
```

### 8.2 Stage 1: subdomain discovery

QuantWarden sends the root domain to the configured subdomain discovery service.

The stage:

- searches for public subdomains;
- removes duplicates;
- adds newly discovered subdomains as leaf assets;
- links leaf assets to the root domain;
- makes the discovery state visible in the onboarding status banner and Activity Monitor.

If no subdomains are found, the workflow continues with the root domain.

### 8.3 Stage 2: port and service discovery

QuantWarden evaluates the root and discovered assets using the organization’s port discovery configuration.

The stage records:

- reachable ports;
- TCP or UDP protocol;
- service labels;
- resolved targets;
- failed, timed-out, or unavailable checks.

The default configuration contains a practical list of common web, mail, DNS, remote-access, file-sharing, VPN, and database ports. Administrators can enable, disable, rename, add, or remove individual port checks.

### 8.4 Stage 3: OpenSSL TLS analysis

Eligible domain endpoints are then examined using the OpenSSL scanning service.

The scan may collect:

- resolved IP address;
- certificate subject and issuer;
- certificate validity dates;
- certificate chain;
- public-key algorithm and key size;
- signature algorithm and OID;
- supported TLS versions;
- negotiated and accepted cipher suites;
- supported and negotiated key-exchange groups;
- TLS 1.2 and TLS 1.3 posture;
- DNS missing or expired state;
- timeout, no-TLS, or connection-failure state;
- post-quantum support and negotiation evidence.

### 8.5 Expected duration

The initial workflow commonly takes several minutes for a small scope. It can take longer when:

- many root domains are entered;
- subdomain discovery finds a large estate;
- many ports are enabled;
- endpoints respond slowly or time out;
- DNS responses are inconsistent;
- a scan service is unavailable;
- another organization scan is active or queued.

This is an asynchronous workflow. Users may leave the page and return later without stopping it.

### 8.6 First-scan dashboard behavior

While the workflow is active:

- the onboarding status banner identifies the current stage;
- Security Overview requests that the user let the first complete scan finish;
- PQC Posture explains that scoring starts after asset, port, and TLS discovery;
- Discoveries and Asset Management continue to show the evolving inventory;
- the Activity Monitor displays subdomain, port, and OpenSSL activity.

Do not interpret an empty Overview or PQC screen as a scan failure while the initial workflow is still running.

> **Screenshot placeholder 10 — Initial scan in progress**
> Capture the dashboard immediately after onboarding. Include the “Discovering subdomains” status banner and the first-scan analysis notice.

---

## 9. Joining an Existing Organization

There are two supported membership paths: invitation and organization code.

### 9.1 Join through a username invitation

1. Sign in with the invited username.
2. Open the profile menu in the top-right corner.
3. Select **Manage Profile**.
4. Review **Active Invitations**.
5. Confirm the organization, inviter, assigned role, and expiry.
6. Select **Accept** or **Decline**.
7. After acceptance, QuantWarden opens the organization.

The invitation is moved to **Invitation History** after it is accepted, declined, expired, revoked, or cancelled.

> **Screenshot placeholder 11 — In-app invitation inbox**
> Capture Profile Manager with one Active Invitation showing organization, inviter, role, expiry, Accept, and Decline.

### 9.2 Join through an email invitation

This path is only available when email authentication and SMTP are enabled.

1. Open the invitation email.
2. Follow the invitation link.
3. Sign in with the invited email account, or register if required.
4. Confirm the organization and assigned role.
5. Accept or decline.

An invitation can only be accepted by the account it was issued to. If the wrong account is active, the platform displays an account-mismatch warning.

### 9.3 Join with an organization code

1. Open **All Organizations**.
2. Select **Join**.
3. Enter the organization code.
4. Submit the request.

Outcome:

- **Public joining:** membership is created immediately.
- **Private joining:** the request appears as pending and must be approved.

The requester can view pending or denied requests on the All Organizations page and may withdraw or dismiss them.

### 9.4 Administrator approval of a join request

1. Open the organization.
2. Select **Team Management**.
3. Open **Joining Requests**.
4. Review the requester.
5. Select **Accept**.
6. Choose the role to assign.
7. Confirm, or deny the request.

> **Screenshot placeholder 12 — Joining request approval**
> Capture Team Management with a pending request and the role selector shown during acceptance.

---

## 10. Navigation and Dashboard Structure

The organization dashboard uses a left navigation rail on desktop and a horizontal navigation bar on smaller screens.

Primary screens:

1. Security Overview
2. Discoveries
3. CERT-IN CBOM
4. PQC Posture
5. Reporting
6. Asset Management
7. Asset Scanning
8. Team Management
9. Activity Monitor

The top navigation identifies the current organization and provides access to the user profile and logout action.

---

## 11. Security Overview

Security Overview is the executive and operational summary of the latest completed endpoint evidence.

Typical content includes:

- scanned TLS endpoint count;
- confirmed strong cipher count;
- certificates expiring within 30 days;
- critical certificate expirations;
- latest TLS version distribution;
- organization PQC rating;
- self-signed certificate count;
- scored port count;
- PQC-safe key-exchange coverage;
- TLS 1.3 and TLS 1.2 cipher posture;
- immediate-attention groups for DNS, certificate, and TLS issues;
- certificate key-size distribution;
- certificate signature algorithms;
- TLS 1.3 key-exchange groups;
- certificate instances by port;
- certificates by algorithm;
- expiring certificates;
- top certificate identities.

Many summary items link to the Asset Explorer with the relevant filters already applied.

Operational use:

- start with **Immediate Attention**;
- review expired or soon-to-expire certificates;
- identify endpoints missing TLS 1.3;
- investigate weak or legacy cipher usage;
- compare PQC-safe coverage against the total scanned scope.

> **Screenshot placeholder 13 — Security Overview**
> Capture the top metrics, TLS version visual, PQC rating, and Immediate Attention section in one or two images.

---

## 12. Discoveries

The Discoveries screen presents the asset estate as a network topology graph.

It can show:

- the central asset scanner;
- root domains;
- discovered domains;
- resolved IP addresses;
- open-port service nodes;
- relationships between parent domains, assets, IPs, and ports.

Available controls include:

- search by domain, IP address, port, or status;
- zoom in;
- zoom out;
- reset zoom;
- hover or select a node to highlight its relationships;
- open the corresponding asset detail page.

Summary counters include:

- tracked assets;
- root assets;
- known IPs;
- known services or ports.

Large estates automatically reduce some labels and service-node detail until the user zooms in.

> **Screenshot placeholder 14 — Discoveries topology**
> Capture a graph with at least one root domain, several subdomains, a resolved IP, and open-port nodes. Include the legend and zoom controls.

---

## 13. Asset Management

Asset Management is the operational inventory for domains, subdomains, IP addresses, buckets, and port discovery.

### 13.1 Inventory sections

- **Root Domains:** primary assets in scope.
- **Leaf Assets:** discovered or manually entered subdomains and IPs.

Users can:

- search root or leaf assets;
- filter by bucket;
- switch between flat and bucket-grouped views;
- open an asset detail page;
- open the Asset Explorer;
- inspect current discovery states.

### 13.2 Adding an asset

Users with Asset Management permission can select **Add Asset** and enter:

- root domain;
- leaf domain;
- IPv4 or IPv6 address;
- asset bucket;
- custom bucket name;
- associated TCP or UDP ports.

When a new asset is added after onboarding, QuantWarden creates an asset-added workflow:

```text
New asset
  → Port discovery
  → OpenSSL TLS analysis
```

Subdomain discovery is specifically available for root domains.

### 13.3 Asset buckets

Buckets help organize large estates by function. Built-in examples include:

- API;
- Mobile Apps;
- Internet Banking;
- Payments;
- Cards & Loans;
- Identity & KYC;
- Admin & Internal;
- Email & Collaboration;
- Data & Analytics;
- Public Web;
- General.

QuantWarden may infer a bucket from the asset name. Users with permission may replace it with a predefined or custom bucket.

### 13.4 Subdomain discovery actions

For a root domain, use **Discover Subdomains** to scan a single root.

Use **Discover All** to start discovery for all eligible root domains.

The activity is visible:

- on the affected root asset;
- in the onboarding/status banner when applicable;
- in the Activity Monitor;
- in the Discoveries graph as new assets appear.

### 13.5 Port discovery configuration

Port discovery allows an authorized user to:

- enable or disable individual entries;
- choose TCP or UDP;
- set a port number between 1 and 65535;
- provide a human-readable service title;
- add custom services;
- remove entries;
- configure probe batch size and timeout;
- review scope and enabled-port count before starting.

Port ranges are not currently supported in the UI. Use individual entries.

> **Screenshot placeholder 15 — Asset Management**
> Capture Root Domains and Leaf Assets, bucket controls, Discover All, Port Discovery, Add Asset, and Open Explorer.

> **Screenshot placeholder 16 — Port discovery configuration**
> Capture the port checklist/configuration dialog with enabled ports, protocol selectors, run summary, and Start Port Discovery.

---

## 14. Asset Scanning

Asset Scanning is the main OpenSSL TLS scanning workspace.

### 14.1 Scan actions

Authorized users can:

- scan one asset;
- select at least two assets and run a group scan;
- scan all eligible organization assets;
- queue a scan if another shared scan is active;
- schedule an OpenSSL scan for a future date and time;
- stop the active scan;
- open Asset Explorer.

### 14.2 Asset list and status

The screen supports:

- domain search;
- asset selection;
- current scan status;
- port-level result tabs;
- latest successful or failed attempt;
- DNS-expired state;
- timeout state;
- no-TLS state;
- certificate and cipher summary.

### 14.3 OpenSSL result details

For each port, users may review:

- certificate validity;
- primary TLS version;
- negotiated cipher;
- negotiated key-exchange group;
- public-key type and size;
- signature algorithm;
- downgrade safety;
- accepted ciphers;
- supported groups;
- subject and issuer details;
- SAN coverage;
- certificate chain;
- raw certificate JSON;
- PQC score and remediation guidance.

> **Screenshot placeholder 17 — Asset Scanning**
> Capture the OpenSSL TLS Scanning screen with asset selection, Scan Group, Scan All Assets, and status indicators.

> **Screenshot placeholder 18 — Asset TLS result**
> Capture a completed asset result with certificate validity, TLS version, cipher, key exchange, and PQC insights.

---

## 15. Scan Types and When to Use Them

### 15.1 Subdomain discovery

Use when:

- onboarding a new root domain;
- refreshing the public attack surface;
- validating whether new applications or gateways have appeared;
- rebuilding parent-child asset relationships.

Scope:

- single root domain;
- all eligible root domains.

Primary result:

- new leaf assets added to inventory.

### 15.2 Port discovery

Use when:

- a domain or IP is newly added;
- service exposure may have changed;
- validating that only approved ports are reachable;
- preparing an accurate OpenSSL scan scope.

Scope:

- single asset;
- selected/group assets where available;
- full organization scope.

Primary result:

- reachable configured ports and service metadata.

Port discovery checks the individually configured ports. The current UI does not provide an unrestricted all-65,535-port or port-range scan.

### 15.3 OpenSSL TLS scan

Use when:

- certificates are renewed or replaced;
- TLS policy changes;
- cipher or protocol configuration changes;
- PQC support is introduced;
- periodic security evidence is required;
- investigating an Overview or PQC finding.

Scope:

- single asset;
- selected group;
- full organization;
- scheduled one-time execution.

Primary result:

- TLS, certificate, cipher, key-exchange, CBOM, and PQC evidence.

### 15.4 Automated onboarding scan

Source badge: **Automated**

Use:

- automatically created after organization onboarding;
- chains subdomain, port, and OpenSSL work.

### 15.5 Manual scan

Source badge: **Manual**

Use:

- started by an authorized member from Asset Management, Asset Scanning, or asset detail.

### 15.6 Scheduled scan

Source badge: **Scheduled**

Use:

- created through an operational scan scheduling dialog;
- appears in the Activity Monitor’s Scheduled tab;
- becomes queued when due.

---

## 16. Activity Monitor

The Activity Monitor is the shared operational view of organization scan activity.

It appears as a compact card in the organization navigation and can be expanded into a full dialog.

### 16.1 Compact monitor

The compact view displays:

- current scan label;
- live, connecting, disconnected, or idle status;
- queued or preparing onboarding subdomain discovery;
- percentage and completed/total assets for a live batch;
- queued or scheduled item count;
- warning indicator when a scan service appears unavailable;
- open-monitor and sync actions.

### 16.2 Expanded monitor

The expanded view contains:

- **Live:** current subdomain, port, or OpenSSL activity;
- **Queue:** batches waiting behind active work;
- **Scheduled:** future one-time or recurring scan records supported by the operational scheduler;
- **History:** recently completed, failed, or cancelled batches.

Live batch details include:

- scan engine and scope;
- manual, automated, or scheduled source;
- initiator;
- running, queued, completed, failed, and cancelled item counts;
- percentage complete;
- individual asset state;
- errors and failure diagnostics;
- elapsed timing.

### 16.3 Subdomain discovery state

During onboarding, the monitor shows **Subdomain Discovery** immediately, including the short period before a scan batch has been claimed.

Possible labels include:

- Queued;
- Preparing;
- Running;
- Completed;
- Failed.

After the discovery batch becomes active, the monitor transitions to real asset progress.

### 16.4 Sync

Use **Sync now** when:

- the page was opened after a scan started;
- the connection indicator is idle or disconnected;
- another user started work in the same organization;
- recent progress is not yet visible.

The live connection automatically reconnects while active work exists.

### 16.5 Stop and cancel

Users with scan permission may:

- stop an active batch;
- delete or cancel eligible queued work;
- remove eligible scheduled entries.

Stopping a batch does not remove results already completed by individual assets.

### 16.6 Service warnings

A warning may indicate that Subfinder, Nmap, OpenSSL, or the scan stream is unavailable or not progressing.

Recommended response:

1. Note the affected engine.
2. Check whether the progress count changes.
3. Use **Sync now**.
4. Review History for failed items.
5. Retry the relevant scope after service recovery.
6. Escalate to the platform operator if multiple organizations are affected.

> **Screenshot placeholder 19 — Compact Activity Monitor**
> Capture the navigation card while Subdomain Discovery is Preparing or Running.

> **Screenshot placeholder 20 — Expanded Activity Monitor**
> Capture the Live tab with a running scan, progress bar, source badge, and asset state tabs. A second image may show Queue, Scheduled, and History.

---

## 17. Asset Explorer and Asset Detail

### 17.1 Asset Explorer

Asset Explorer provides deep search across the current organization estate.

Filters may include:

- asset or known TLS text search;
- DNS status;
- latest TLS version;
- certificate key size;
- certificate validity;
- signature algorithm;
- cipher suite;
- port;
- timeout state;
- no-TLS state;
- PQC or Kyber support;
- PQC or Kyber negotiation;
- scanned, unscanned, missing-DNS, or unresponsive state.

Filter selections are reflected in the URL, allowing an authorized user to preserve or share a specific investigative view.

### 17.2 Asset detail

Selecting an asset opens its intelligence page.

The page includes:

- asset identity and current status;
- known port tabs;
- last scan time;
- discover or re-scan actions subject to RBAC;
- certificate and TLS overview;
- detailed certificate subject, issuer, chain, SAN, and identifiers;
- accepted and negotiated ciphers;
- supported TLS versions and groups;
- DNS-expired and no-TLS explanations;
- PQC score breakdown and remediation guidance.

> **Screenshot placeholder 21 — Asset Explorer filters**
> Capture search and filters for DNS, TLS version, certificate validity, cipher, port, and PQC support.

---

## 18. CERT-IN CBOM

The CERT-IN CBOM screen builds a cryptographic inventory from the latest completed OpenSSL endpoint scans.

Available tabs:

- **Algorithms:** observed cryptographic algorithms, primitives, modes, functions, security levels, OIDs, and affected assets.
- **Keys:** certificate public-key inventory, identifiers, state, size, and available lifecycle fields.
- **Protocols:** TLS protocol versions, cipher suites, and OIDs.
- **Certificates:** subject, issuer, validity, signature, public-key references, format, and extension.

Each active tab can be exported as:

- JSON;
- CSV.

CBOM output represents the evidence available in the latest stored scans. A missing field is reported explicitly rather than guessed.

> **Screenshot placeholder 22 — CERT-IN CBOM**
> Capture the tab navigation, record counts, one populated table, the JSON/CSV selector, and download action.

---

## 19. PQC Posture

PQC Posture summarizes the organization’s readiness for post-quantum migration using current TLS observations.

The score is calculated from:

| Pillar | Maximum contribution |
| --- | ---: |
| Key exchange and ML-KEM behavior | 40 |
| Symmetric encryption | 30 |
| Protocol version | 20 |
| Certificate authentication | 10 |

Penalties may reduce the result when legacy or unsafe behavior is observed.

Organization tiers:

| Tier | General interpretation |
| --- | --- |
| A | Quantum-Safe |
| B | Transitional |
| C | Legacy |
| D/F | Vulnerable or requiring urgent uplift |

The screen provides:

- organization rating and average score;
- scored-port coverage;
- risk overview matrix;
- tier distribution;
- asset-level score table;
- key-exchange and symmetric-encryption summaries;
- sorting and filtering;
- access to the methodology explanation.

The score is an observed technical posture, not a certification or compliance attestation. It reflects the latest successful scan evidence.

> **Screenshot placeholder 23 — PQC Posture**
> Capture the organization rating, score gauge, Risk Overview Matrix, and asset score table.

---

## 20. Reporting

### 20.1 Share PDF

The operational reporting feature generates a PDF from current organization scan data.

The user may:

- customize the report title and subtitle when authorized;
- choose included sections;
- preview the generated pages;
- download the PDF.

Available report sections include:

- executive summary;
- security overview;
- PQC posture;
- tier methodology;
- tier distribution;
- tier-wise assets;
- PQC support;
- immediate-attention findings.

The report may still be generated when coverage is incomplete, but it will state that sufficient OpenSSL evidence is not yet available.

### 20.2 Periodic Scans, Schedule Scan, and Auto Emails

The Reporting screen also presents client-facing concepts for:

- periodic scan cadence;
- one-time future scan intent;
- report recipient groups;
- automated email delivery templates.

In the current product, these Reporting-tab controls are planning and preview interfaces unless explicitly connected to backend persistence in the client deployment. The screen itself notes that some settings remain local-only or are ready for future backend persistence.

For an operational one-time OpenSSL schedule, use **Asset Scanning → Schedule for Later**. Confirm the resulting record in **Activity Monitor → Scheduled**.

Do not assume that selecting **Save schedule**, **Schedule one-time scan**, or **Save email setup** in the Reporting concept screens creates a persistent automation unless the deployment administrator has confirmed that integration.

> **Screenshot placeholder 24 — PDF reporting**
> Capture report section controls, preview pages, and Download PDF.

---

## 21. Team Management

Team Management provides organization-level membership administration.

Main panels:

- **Invite Members**
- **All Members**
- **Joining Requests**
- **Active Invitations**

Users with Role Management permission also see **Manage Roles**.

### 21.1 Invite members

1. Enter a username, or an email when email mode is enabled.
2. Select the role.
3. Send the invitation.
4. Review warnings if any recipient could not be processed.

### 21.2 All members

The member list shows:

- display name;
- username or email identity;
- current role;
- owner and current-user indicators.

Authorized actions include:

- change a non-owner member’s role;
- reset the password of a username account;
- remove a member;
- leave the organization when permitted;
- filter the member list by role.

### 21.3 Joining requests

Authorized users can:

- review pending requests;
- select a role during acceptance;
- accept;
- deny.

### 21.4 Active invitations

Authorized users can:

- review pending recipients;
- see the assigned role;
- see the sent date;
- revoke an invitation.

### 21.5 Manage roles

Authorized users can:

- create custom roles;
- rename custom roles;
- set role colors;
- toggle Team, Scan, and Asset permissions;
- delete custom roles;
- review locked system-role permissions.

> **Screenshot placeholder 25 — Team Management**
> Capture all four panels and the Manage Roles button. Include at least one member and one active invitation.

---

## 22. User Profile and Invitation Inbox

Open the top-right profile menu and select **Manage Profile**.

The Profile Manager contains:

- account identity;
- editable full name;
- active invitations;
- invitation history;
- account deletion controls.

### 22.1 Active invitations

Each invitation displays:

- organization;
- inviter;
- assigned role;
- expiration time;
- Accept and Decline actions.

### 22.2 Invitation history

History may show:

- Accepted;
- Rejected;
- Expired;
- Revoked;
- Cancelled.

### 22.3 Account deletion

Account deletion is a destructive operation. Follow the confirmation prompt carefully. Organization ownership and membership implications should be reviewed before deleting an owner account.

---

## 23. Recommended Day-to-Day Operating Procedure

### Daily or frequent review

1. Open Security Overview.
2. Review Immediate Attention.
3. Check certificate expirations.
4. Open Activity Monitor for failures or stalled work.
5. Use Asset Explorer to investigate affected assets.

### After adding or changing infrastructure

1. Add the root or leaf asset in Asset Management.
2. Confirm the automatic asset-added workflow.
3. Run subdomain discovery if a new root domain was added.
4. Review port discovery results.
5. Run or confirm OpenSSL scans.
6. Re-check Overview, CBOM, and PQC Posture.

### After a certificate renewal

1. Open the affected asset.
2. Select the relevant port.
3. Run **Re-Scan TLS**.
4. Confirm new validity dates, issuer, chain, key size, and signature algorithm.
5. Confirm that the expiration finding clears from Overview.

### Before a client, audit, or governance review

1. Confirm the latest full scan completed.
2. Resolve or annotate critical failures.
3. Export relevant CBOM tabs.
4. Generate the PDF report.
5. Retain the scan date and organization scope with the exported evidence.

---

## 24. Result Interpretation

### Completed

The scan item finished and returned a result. A completed result may still report:

- no TLS;
- DNS missing;
- weak configuration;
- self-signed certificate;
- unsupported PQC;
- other security findings.

“Completed” means execution completed, not that the endpoint is secure.

### Failed

The engine could not complete the operation. Review the error for:

- service unavailability;
- timeout;
- malformed target;
- DNS problem;
- rejected connection;
- scan worker issue.

### Timeout

The endpoint did not respond before the configured limit. A timeout is not proof that the service is closed; it is an inconclusive response under the current scan conditions.

### DNS expired or missing

The hostname no longer resolves. QuantWarden distinguishes this from a successful connection with no TLS.

### No TLS detected

The port responded, but no TLS session or certificate was observed. This may be expected for a plaintext service or may indicate incorrect service configuration.

### Queued

The work exists but is waiting for the organization scan lock or worker capacity.

### Cancelled

The operation was stopped before all items completed. Previously completed item results may remain available.

---

## 25. Troubleshooting

### Invitation does not appear

Check:

- the invited username exactly matches the registered username;
- the invitation has not expired;
- the invitation has not been revoked;
- the user is signed into the correct account;
- the user opened **Manage Profile → Active Invitations**;
- the inviter did not already have a pending duplicate invitation.

### User cannot join with the code

Check:

- the organization code is correct;
- the organization still exists;
- private joining requires administrator approval;
- the user does not already have a pending request;
- the request was not denied.

### Overview or PQC is empty

Check:

- whether the first-scan notice is displayed;
- Activity Monitor Live and Queue tabs;
- whether port discovery completed;
- whether OpenSSL results exist;
- whether any reachable TLS endpoints were found.

### Subdomain discovery appears stuck

1. Open Activity Monitor.
2. Check whether the state is Queued, Preparing, or Running.
3. Select **Sync now**.
4. Review service warnings.
5. Wait for any active organization scan to complete.
6. Retry from Asset Management after service recovery if the workflow fails.

### Scan is queued instead of running

Another organization scan is active. Review:

- Activity Monitor → Live;
- Activity Monitor → Queue;
- the scan lock message;
- current running and pending asset counts.

### OpenSSL result reports no TLS

Confirm:

- the selected port is intended to use TLS;
- the service is not plaintext HTTP or another non-TLS protocol;
- SNI and hostname resolution are correct;
- the endpoint is reachable from the scanner;
- the correct port was discovered or configured.

### Certificate result is stale

Run a new single-asset OpenSSL scan or a suitable group/full scan. Overview, CBOM, PQC, and reports are based on the latest stored completed evidence.

### Activity stream is disconnected

Use **Sync now**. If a scan remains active, the stream will attempt to reconnect. If the problem affects multiple users or organizations, contact the deployment operator.

### User forgot a username password

An authorized organization administrator should use **Team Management → member actions → Reset Password**.

---

## 26. Security and Governance Guidance

- Obtain written authorization for every target.
- Begin with a conservative root-domain scope.
- Use private joining approval for production organizations.
- Grant Team, Scan, and Asset permissions separately.
- Use Auditor for read-oriented access.
- Review active invitations and members regularly.
- Revoke invitations that are no longer required.
- Remove departed users promptly.
- Record scan dates with exported evidence.
- Treat PQC scores as observed posture, not formal certification.
- Validate critical findings manually before making high-impact remediation decisions.
- Avoid sharing reports, CBOM exports, or screenshots through unapproved channels.

---

## 27. Feature Availability Summary

| Capability | Default status |
| --- | --- |
| Username/password registration and login | Enabled |
| Username invitations through in-app inbox | Enabled |
| Email OTP or magic-link authentication | Disabled unless configured |
| Email invitations | Disabled unless email auth and SMTP are configured |
| Organization onboarding workflow | Enabled |
| Subdomain discovery | Enabled when the service is available |
| Port discovery | Enabled when the service is available |
| OpenSSL TLS scanning | Enabled when the service is available |
| Live Activity Monitor | Enabled |
| One-time OpenSSL scheduling from scan dialog | Enabled |
| CERT-IN CBOM JSON/CSV export | Enabled |
| Live PDF report generation | Enabled |
| Reporting-tab recurring automation controls | Planning UI unless backend persistence is confirmed |
| Reporting-tab automatic email delivery | Planning UI unless backend delivery is confirmed |

---

## 28. Glossary

**Asset:** A domain, subdomain, IP address, or endpoint tracked by the organization.

**CBOM:** Cryptographic Bill of Materials; an inventory of observed cryptographic algorithms, keys, protocols, and certificates.

**Cipher suite:** A set of cryptographic algorithms used to protect a TLS connection.

**Leaf asset:** A discovered or manually added asset beneath the primary root scope.

**ML-KEM:** A standardized post-quantum key encapsulation mechanism used as an important PQC-readiness signal.

**OpenSSL scan:** TLS and certificate analysis performed through the configured OpenSSL scanning service.

**Organization code/slug:** The short identifier used in organization URLs and joining.

**PQC:** Post-Quantum Cryptography.

**Port discovery:** Checking configured network ports to identify reachable services.

**RBAC:** Role-Based Access Control.

**Root asset:** A primary domain or IP address placed directly into scope.

**SAN:** Subject Alternative Name, listing additional identities covered by a certificate.

**Scan batch:** A group of related scan items tracked as one operation.

**Scan lock:** Organization-level coordination that prevents conflicting shared scan execution.

**SSE:** Server-Sent Events, used to deliver live scan progress to the browser.

**Subdomain discovery:** Reconnaissance used to identify public hostnames beneath a root domain.

**TLS:** Transport Layer Security.

---

## 29. Screenshot Production Checklist

Use the following standards when replacing the screenshot placeholders:

- capture at a consistent desktop resolution;
- use a demonstration organization and non-sensitive domains;
- do not expose real usernames, emails, IPs, tokens, or internal hostnames;
- keep the full browser viewport where navigation context matters;
- crop tightly for dialogs and detailed controls;
- use the same organization name across the guide;
- show realistic but safe scan results;
- blur or replace any client-sensitive data;
- add numbered captions matching this document.

Recommended screenshot set:

1. Completed organization dashboard
2. Username registration
3. Username login
4. All Organizations
5. Create Organization
6. Visibility and joining policy
7. Root domain onboarding
8. RBAC matrix
9. Onboarding invitations
10. Initial scan notice
11. Invitation inbox
12. Join-request approval
13. Security Overview
14. Discoveries graph
15. Asset Management
16. Port discovery configuration
17. Asset Scanning
18. Asset TLS result
19. Compact Activity Monitor
20. Expanded Activity Monitor
21. Asset Explorer filters
22. CERT-IN CBOM
23. PQC Posture
24. PDF Reporting
25. Team Management

---

## 30. Client Handoff Acceptance Checklist

Before handing QuantWarden to the client, confirm:

- [ ] Username registration and login work in the deployed environment.
- [ ] A test organization can be created.
- [ ] Hidden/private organization defaults are understood.
- [ ] At least one authorized root domain can be added.
- [ ] The initial subdomain → port → OpenSSL workflow completes.
- [ ] Subdomain discovery is visible in Activity Monitor.
- [ ] First-scan notices disappear after analysis is available.
- [ ] Username invitations appear in the recipient’s Profile Manager.
- [ ] Join-request approval and role assignment work.
- [ ] RBAC restrictions match the client’s policy.
- [ ] Asset Management can add and organize assets.
- [ ] Port discovery returns reachable service evidence.
- [ ] OpenSSL scanning returns TLS and certificate evidence.
- [ ] Security Overview and PQC Posture populate.
- [ ] CBOM JSON and CSV exports download successfully.
- [ ] PDF reporting generates successfully.
- [ ] The client understands which Reporting automation controls are planning-only.
- [ ] Platform support contacts and escalation paths have been provided separately.

---

## 31. Quick Reference

| Task | Where to go |
| --- | --- |
| Create an organization | All Organizations → Create |
| Join with a code | All Organizations → Join |
| Accept an invitation | Profile menu → Manage Profile → Active Invitations |
| Add a domain or IP | Organization → Asset Management → Add Asset |
| Discover subdomains | Asset Management → root-domain discovery action |
| Discover ports | Asset Management → Port Discovery |
| Scan TLS for one asset | Asset detail or Asset Scanning |
| Scan selected assets | Asset Scanning → Scan Group |
| Scan all assets | Asset Scanning → Scan All Assets |
| Schedule an OpenSSL scan | Asset Scanning → scan action → Schedule for Later |
| View live progress | Activity Monitor → Live |
| Review queued scans | Activity Monitor → Queue |
| Review scheduled scans | Activity Monitor → Scheduled |
| Review scan history | Activity Monitor → History |
| Investigate security findings | Security Overview → linked asset/filter |
| Search the estate | Asset Management → Open Explorer |
| Export CBOM | CERT-IN CBOM → choose tab and JSON/CSV |
| Generate a client report | Reporting → Share PDF |
| Invite or remove members | Team Management |
| Configure roles | Team Management → Manage Roles |
| Reset a username password | Team Management → member actions |

---

**End of document**
