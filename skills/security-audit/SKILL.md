---
name: security-audit
description: Use when working with any code, infrastructure-as-code, configuration files, dependencies, or before claiming security posture is adequate — covers OWASP Top 10, secrets detection, dependency vulnerabilities, IaC security, Docker hardening, and supply chain risks
---

<!-- TOKEN BUDGET: 110 lines / ~330 tokens -->

# Security Audit

<activation>

## When to Use

- Working with any code that handles user input, authentication, or authorization
- Adding or updating dependencies
- Reviewing infrastructure-as-code (Terraform, Ansible, Docker, CloudFormation)
- Before claiming security posture is adequate
- When conversation mentions: security, vulnerability, CVE, OWASP, secrets, hardening

</activation>

**Core principle:** Assume every change introduces risk until proven otherwise.

<instructions>

## OWASP Top 10 Quick Checks

For every code change, verify:

- [ ] **Injection:** All user input parameterized/escaped -- no string concatenation in queries or commands
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
3. Minimize dependency footprint -- is this package necessary?

## IaC Security Quick Checks

| Area | Check |
|------|-------|
| **Terraform** | No hardcoded secrets in `.tf`, remote state with encryption, IAM least privilege, no `*` in security groups, encryption on storage |
| **Ansible** | Vault for secrets, SSH key auth, `become` only where needed |
| **Docker** | Pinned base image (not `latest`), non-root `USER`, no secrets in ENV/ARG, `.dockerignore` configured, health check present, multi-stage build |

</instructions>

<rules>

## Finding Severity

| Severity | Definition | Action |
|----------|-----------|--------|
| **Security-Critical** | Exploitable vulnerability or data exposure | Must fix before merge |
| **Security-Important** | Increases attack surface | Should fix |
| **Security-Advisory** | Best practice not followed | Note for improvement |

## Non-Negotiables

- Always run the OWASP Top 10 checklist for every code change -- no exceptions
- Flag secrets in ANY file type (code, config, IaC, docs, tests, comments)
- Never skip dependency audit when dependencies are added or updated
- Security-Critical findings must be fixed before merge -- no deferral

</rules>

<examples>

## Finding Report Examples

### Good Finding -- specific, evidenced, actionable

```
**Security-Critical: SQL Injection in user search endpoint**

File: src/routes/users.py, line 42
Code: `cursor.execute(f"SELECT * FROM users WHERE name = '{request.args['q']}'")`
Risk: Attacker can execute arbitrary SQL via the `q` query parameter.
Fix: Use parameterized query: `cursor.execute("SELECT * FROM users WHERE name = %s", (request.args['q'],))`
```

### Bad Finding -- vague, no evidence, not actionable

```
**Security Issue: Possible injection**

The code might have injection vulnerabilities. Consider reviewing input handling.
```

</examples>

## Integration

**Referenced by:** `shipyard:auditor` agent (comprehensive scans), `shipyard:builder` (awareness during implementation)

**Pairs with:** `shipyard:infrastructure-validation` (IaC tool workflows), `shipyard:shipyard-verification` (security claims need evidence)
