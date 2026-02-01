---
name: security-audit
description: Use when working with any code, infrastructure-as-code, configuration files, dependencies, or before claiming security posture is adequate — covers OWASP Top 10, secrets detection, dependency vulnerabilities, IaC security, Docker hardening, and supply chain risks
---

<!-- TOKEN BUDGET: 90 lines / ~270 tokens -->

# Security Audit

## Overview

Security is not a phase — it's a continuous practice. Every code change, dependency addition, and infrastructure modification has security implications.

**Core principle:** Assume every change introduces risk until proven otherwise.

## OWASP Top 10 Quick Checks

For every code change, verify:

- [ ] **Injection:** All user input parameterized/escaped — no string concatenation in queries or commands
- [ ] **Broken Auth:** Passwords hashed properly (bcrypt/argon2), session tokens random, rate limiting on auth endpoints
- [ ] **Data Exposure:** Encryption at rest and transit, no sensitive data in logs/errors, proper key management
- [ ] **XXE:** XML parsers disable external entities
- [ ] **Access Control:** Authorization on every request (not just UI), default deny, restrictive CORS
- [ ] **Misconfiguration:** Debug mode off in production, default credentials changed, security headers set
- [ ] **XSS:** Output encoding on all user data, CSP headers, no `dangerouslySetInnerHTML` without sanitization
- [ ] **Deserialization:** No deserializing untrusted data without allowlists
- [ ] **Vulnerable Components:** Dependencies pinned, no known CVEs, lock files committed
- [ ] **Insufficient Logging:** Auth events logged, failures logged, logs don't contain secrets

## Secrets Detection

Flag these patterns in ANY file (code, config, IaC, docs, tests):

| Pattern | What It Is |
|---------|-----------|
| `AKIA[0-9A-Z]{16}` | AWS Access Key |
| `ghp_[0-9a-zA-Z]{36}` | GitHub Token |
| `sk-[0-9a-zA-Z]{48}` | OpenAI/Stripe Secret Key |
| `(postgres\|mysql\|mongodb)://[^:]+:[^@]+@` | DB credentials in URI |
| `-----BEGIN.*PRIVATE KEY-----` | Private key |
| `(password\|secret\|token\|api_key)\s*[:=]\s*['"][^'"]{8,}` | Generic secret |

**Where secrets hide:** `.env` files in git, Docker build args, Terraform `tfvars`, CI configs, test fixtures, comments.

**Prevention:** Environment variables or secret managers. Add `.env`, `*.tfvars`, `*.pem` to `.gitignore`.

## Dependency Security

1. Check for known CVEs: `npm audit` / `pip-audit` / `cargo audit` / `govulncheck`
2. Verify exact version pins (not ranges) and lock files committed
3. Minimize dependency footprint — is this package necessary?

## IaC Security Quick Checks

| Area | Check |
|------|-------|
| **Terraform** | No hardcoded secrets in `.tf`, remote state with encryption, IAM least privilege, no `*` in security groups, encryption on storage |
| **Ansible** | Vault for secrets, SSH key auth, `become` only where needed |
| **Docker** | Pinned base image (not `latest`), non-root `USER`, no secrets in ENV/ARG, `.dockerignore` configured, health check present, multi-stage build |

## Finding Severity

| Severity | Definition | Action |
|----------|-----------|--------|
| **Security-Critical** | Exploitable vulnerability or data exposure | Must fix before merge |
| **Security-Important** | Increases attack surface | Should fix |
| **Security-Advisory** | Best practice not followed | Note for improvement |

## Integration

**Referenced by:** `shipyard:auditor` agent (comprehensive scans), `shipyard:builder` (awareness during implementation)

**Pairs with:** `shipyard:infrastructure-validation` (IaC tool workflows), `shipyard:shipyard-verification` (security claims need evidence)
