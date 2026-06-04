# Security Policy

## Reporting a vulnerability

Please report security issues privately by email to **xpuspus@gmail.com** rather
than opening a public issue. Include steps to reproduce and the affected
component (Python pipeline, FastAPI backend, or the static site).

You can expect an acknowledgement within a few days.

## Scope

- The public deployment at [tulaypinoy.ph](https://tulaypinoy.ph) is a static
  site with no backend and no user data — it serves only pre-computed public
  records and satellite imagery.
- The bundled FastAPI backend is intended for local/self-hosted use. It is
  read-only, unauthenticated by design, rate-limited per IP, and serves only
  public data. Do not expose it publicly without your own auth and hardening.

## Data sensitivity

All data is public record (DPWH transparency dataset, free Sentinel-2 imagery).
No personal data is collected or stored.
