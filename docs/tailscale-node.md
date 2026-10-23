# Storagi's own Tailscale node

Storagi's Funnel address belongs to its own Tailscale node, `storagi.<tailnet>.ts.net`, instead of the host's. Why: every app on the host shared the host node's Serve settings, and other tools' `tailscale serve` changes kept replacing Storagi's mapping. The owner tested a separate node in stages 103-107: changing and restarting it left the host's settings untouched, and its address opened with Tailscale off on the owner's phone.

[`deploy/tailscaled-storagi.service`](../deploy/tailscaled-storagi.service) runs a second `tailscaled` in userspace mode: no TUN device, and no host route, DNS, firewall or router port-mapping changes. It runs as a throwaway account (`DynamicUser`) with its state in `/var/lib/tailscale-storagi` and its socket at `/run/tailscale-storagi/tailscaled.sock`. Only root, or that account, can change this node's settings, so the owner's own processes can read its status but cannot change its Funnel mapping. The app itself is unchanged: still loopback port 8787, and only `PUBLIC_ORIGIN` moves.

What this does not protect against: root, tailnet-wide policy or admin-console changes, and Tailscale outages. Funnel's bandwidth limits apply as before. Unprivileged, `tailscaled` logs that it cannot enlarge its UDP buffers. Tailscale says that affects throughput only, which matters far above Storagi's measured 1.6-2.5 MB/s; step 6 measures a real download.

## Move (owner-run)

About an hour, mostly waiting for public DNS, plus a few seconds of downtime in step 6. Run every step in one bash terminal at the host, from a clean checkout of `main` with this change, and each step only if the previous one passed. Never print `/etc/storagi/environment`'s values.

**0. Preflight.**

```sh
git fetch origin && git status --short && git rev-parse HEAD origin/main   # no changes, two equal SHAs
tailscale serve status --json > /tmp/host-serve.before.json
python3 -c 'import json; print(len(json.load(open("/tmp/host-serve.before.json"))["Web"]))'   # number of host listeners
systemctl is-active storagi.service                                        # active
```

**1. Install and start the node.**

```sh
sudo install -o root -g root -m 644 deploy/tailscaled-storagi.service /etc/systemd/system/tailscaled-storagi.service
sudo systemctl daemon-reload
sudo systemctl enable --now tailscaled-storagi.service
sock=/run/tailscale-storagi/tailscaled.sock
```

Check: `systemctl is-active tailscaled-storagi.service` is `active`; `tailscale --socket=$sock status` says `Logged out.`

**2. Enrol it as `storagi`.**

```sh
sudo tailscale --socket=$sock up --hostname=storagi
```

Open the printed login link and add the device to the same tailnet. Then:

```sh
new=$(tailscale --socket=$sock status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
echo "$new"                                         # storagi.<tailnet>.ts.net
```

If it says `storagi-1`, another device already holds the name: remove that device in the admin console, then `sudo tailscale --socket=$sock set --hostname=storagi` and read `new` again.

In the [admin console](https://login.tailscale.com/admin/machines), on `storagi`: **Disable key expiry**. Otherwise the node logs out when its key expires (180 days by default) and Storagi goes offline. Remove `storagi-test`, the logged-out device left from the stage 104 experiment, if it is still listed.

**3. Funnel to Storagi.**

```sh
sudo tailscale --socket=$sock funnel --bg http://127.0.0.1:8787
```

Check:

```sh
tailscale --socket=$sock funnel status              # https://storagi.<tailnet>.ts.net (Funnel on): / proxy http://127.0.0.1:8787
tailscale --socket=$sock set --hostname=storagi     # without sudo: access denied (only root can change this node)
tailscale serve status --json | cmp - /tmp/host-serve.before.json && echo host-unchanged
```

The middle line must be refused. It would only rewrite the same name if it went through; if it does go through, stop and report it, because then the owner's processes can change this node after all.

**4. Wait for public DNS.** Tailscale documents up to 10 minutes. In the stage 104 experiment it took about 32.

```sh
dig +short "$new" @1.1.1.1                           # repeat every few minutes until it prints addresses
curl -s -o /dev/null -w '%{http_code}\n' "https://$new/"   # 400: Storagi answers but refuses this address until step 6
```

**5. Google sign-in.** In the Google Cloud console, open Storagi's OAuth client and add `https://storagi.<tailnet>.ts.net/auth/callback` to **Authorized redirect URIs**. Keep the old one until step 7. Google can take a few minutes to apply it.

**6. Switch the origin.** Downtime starts here.

```sh
ss -Htn state established 'sport = :8787'           # no output: no open transfers; otherwise wait
sudo cp -p /etc/storagi/environment /etc/storagi/environment.before-node
sudo sed -i "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=\"https://$new\"|" /etc/storagi/environment
sudo grep -cx "PUBLIC_ORIGIN=\"https://$new\"" /etc/storagi/environment   # 1
sudo systemctl restart storagi.service
```

Check:

```sh
systemctl is-active storagi.service                                                        # active
curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $new" http://127.0.0.1:8787/             # 200
curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $new" http://127.0.0.1:8787/api/session  # 401
curl -s -o /dev/null -w '%{http_code}\n' "https://$new/"                                    # 200
```

Then on the phone with Tailscale off, open `https://storagi.<tailnet>.ts.net`. Sign in again: sessions belong to the old address. Upload a small file, download it and compare, then download a large one (500 MB or more) and note the speed against the old 1.6-1.7 MB/s average. Delete both. If any step-6 check fails, roll back (below) instead of going on.

**7. Retire the old address**, only after every step-6 check passed. This ends the rollback path. `serve --https=443 off` removes everything on the host's port 443, so first make sure it still holds only Storagi:

```sh
tailscale serve status --json | python3 -c 'import json,sys; h=[v["Handlers"] for k,v in json.load(sys.stdin)["Web"].items() if k.endswith(":443")]; print("only-storagi" if h==[{"/":{"Proxy":"http://127.0.0.1:8787"}}] else "STOP: %s" % h)'
```

Go on only if it prints `only-storagi`; on `STOP`, something else now uses the host's port 443, so leave it and report it.

```sh
tailscale serve --https=443 off                     # prefix sudo if refused
sudo rm /etc/storagi/environment.before-node
```

Check: `tailscale serve status --json` has no `:443` entry under `Web` or `AllowFunnel`, and the host's listener count is one less than in step 0. The old address no longer reaches Storagi. In the Google console, remove the old redirect URI.

**Rollback, only if step 6 failed** (before step 7):

```sh
sudo cp -p /etc/storagi/environment.before-node /etc/storagi/environment
sudo systemctl restart storagi.service
```

The old address works again at once, because its Funnel mapping is still on. The new node can stay; `sudo systemctl disable --now tailscaled-storagi.service` stops it.

## Running it

- Status: `tailscale --socket=/run/tailscale-storagi/tailscaled.sock status` (or `funnel status`); logs: `journalctl -u tailscaled-storagi.service`.
- Changes need `sudo` and the explicit socket. A plain `tailscale ...` talks to the host node and can no longer touch Storagi.
- Deploys don't change: `storagi-promote` reads `PUBLIC_ORIGIN` from `/etc/storagi/environment` for its health checks.
- A changed unit file reaches the host only when the owner reinstalls it (`sudo install …`, `daemon-reload`, restart). The node's identity and Funnel setting live in `/var/lib/tailscale-storagi` and survive restarts and reinstalls.
