# User service (superseded)

Storagi no longer runs as a service of the owner's user manager. It runs as a [system service under a dedicated account](system-service.md), which also has the one-session migration from this mode. There is no dual mode: `deploy/storagi-user.service` and the user-service deploy path were removed in [stage67](stages/67-system-account.md).

History of the user service: preparation in [stage39](stages/39-user-service.md), activation and the automatic-recovery proof in [stage41](stages/41-service-activation.md), scripted deploys in [stage50](stages/50-scripted-deploy.md) to [stage66](stages/66-deploy-p3-hardening-review.md), and the first scripted deploy in [stage64](stages/64-first-scripted-deploy.md).
