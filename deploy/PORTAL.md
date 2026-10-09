# Deploy with clicks, no terminal (except one optional push)

> End state: the whole desk (UI + pipeline) running on Azure Container Apps,
> data on an Azure Files share, image auto-built by GitHub on every push.
> ~20 minutes, mostly waiting on Azure.

## 0. What you need

- This repo pushed to GitHub (`main` branch) — done if `git push` works.
- An Azure account with a subscription ([portal.azure.com](https://portal.azure.com)).
- No Docker, no `az` CLI, no terminal required below.

## 1. Image builds itself (2 min of your time)

1. Open GitHub → your `BEN-POS` repo → **Actions** tab → enable workflows if asked.
2. The `image` workflow (`.github/workflows/docker.yml`) builds on every push
   to `main` and publishes `ghcr.io/saurabhkumar9901/ben-pos:latest`.
3. Make the package pullable: profile photo → **Your packages** (or go to
   `github.com/saurabhkumar9901?tab=packages`) → open `ben-pos` →
   **Package settings** → **Change visibility** → **Public**.
   (Safe: the image contains no shareholder data — `data/` + `processed/`
   are never baked in.)

## 2. File share for data (Azure portal, 5 min)

4. Portal → search **Resource groups** → **+ Create** → name `benpos-rg`,
   region **Central India** → Review + Create.
5. Search **Storage accounts** → **+ Create** → resource group `benpos-rg`,
   name like `benposstore12345` (globally unique, lowercase), region
   Central India, **Standard / LRS** (cheapest) → Review + Create →
   wait for deployment → **Go to resource**.
6. Left menu → **Data storage → File shares** → **+ File share** →
   name `benpos-data`, tier **Transaction optimized** → Create.
7. Left menu → **Security + networking → Access keys** → **Show** next to
   `key1` → copy it somewhere safe (needed once, next step).

## 3. Container Apps environment (one time, 5 min)

8. Search **Container Apps environments** → **+ Create** → resource group
   `benpos-rg`, name `benpos-env`, region Central India.
9. **Monitoring** tab → Log Analytics: **Create new** workspace
   (accept defaults; set retention to 30 days later to keep costs ~zero).
10. Review + Create → wait for deployment.

## 4. The app (5 min)

11. Search **Container Apps** → **+ Create** → resource group `benpos-rg`,
    name `benpos-desk`, region Central India, environment `benpos-env`.
12. **Container** tab → uncheck the sample image → **Add/edit image**:
    - Image source: **a public or private registry** (Docker Hub and others)
    - Registry: `ghcr.io`, image `saurabhkumar9901/ben-pos`, tag `latest`
    - CPU **2**, Memory **4 Gi**.
13. **Volume bindings** tab → **Add volume** →
    - Type: **Azure Files**, name `benpos-data`
    - Storage account: the one from step 5, share `benpos-data`,
      paste the access key, access mode **ReadWrite**
    - Back in the container section → **Volume mounts** → Add →
      volume `benpos-data`, mount path `/mnt/share`.
14. **Ingress** tab → enable **External ingress**, target port **3000**,
    leave the rest default.
15. **Scale** tab (after creation: left menu → **Scale**) → min replicas **0**,
    max replicas **1**. (One replica only: DuckDB takes a single writer lock.
    Zero minimum means ~₹0 idle with a few seconds cold start.)
16. Review + Create → wait → open the **Application Url** from the Overview page.
17. First visit shows an empty desk (no data yet — expected). Go to
    `/ingestion`, upload your BENPOS `.txt` files (+ CA csv), **Process
    files**, then **Rebuild DB**. Everything persists on the file share.

## 5. Updates (30 seconds, forever after)

- Just `git push` to `main` → the Action rebuilds the image.
- Portal → your Container App → **Revision management** → **Create new
  revision** (keep the same `:latest` image — it re-pulls) → your data on
  the share is untouched.

## 6. Optional hardening (when going beyond personal use)

- **Login gate**: Container App → **Authentication** → Add Microsoft
  provider. Do this before sharing the URL — it serves real names.
- **Always warm**: Scale → min replicas **1** (billed while idle).
- **Custom domain + free managed certificate**: Container App →
  **Custom domains** → Add → follow the DNS validation.

## If something looks wrong

| Symptom | Check |
|---|---|
| Actions `image` workflow red | Actions tab → failed run → logs (usually a transient npm/Debian mirror hiccup — Re-run jobs) |
| Container shows crash-looping | Log stream → look for `libduckdb` or port errors |
| App loads but no data | Expected until first `/ingestion` run (fresh share is empty) |
| GHCR pull denied | Package visibility must be **Public** (step 3) |
