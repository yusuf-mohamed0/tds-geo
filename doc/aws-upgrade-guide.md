# AWS Infrastructure Upgrade Guide

## Why
- **EBS resize 20GB→40GB**: crawl4ai image is ~400MB, OpenSEO needs build space.
  Current: 79% full (4GB free). Upgrade to 40GB → 24GB free for new sidecars.
- **Instance t2.micro→t3.medium**: OpenSEO's SSR build (`vite build && tsc --noEmit`)
  needs >2GB RAM; t2.micro has 1GB. t3.medium has 4GB. Also improves sidecar
  performance (headroom, freellmapi, crawl4ai).

## Step 1: Resize EBS Volume (no downtime)

1. Open AWS Console → EC2 → Volumes → select `vol-xxxx` (20GB gp2/gp3)
2. Actions → Modify Volume → set size to **40**
3. Wait 5-15 min for optimization to finish
4. SSH into instance and extend filesystem:

   ```bash
   sudo growpart /dev/nvme0n1 1
   sudo resize2fs /dev/nvme0n1p1
   df -h /   # verify 40GB
   ```

5. Verify Docker can pull and run:
   ```bash
   docker compose -f docker-compose.sidecars.yml up -d crawl4ai
   docker ps   # confirm tds-crawl4ai is healthy
   ```

## Step 2: Upgrade Instance Type (brief downtime ~1-2 min)

1. Stop the PM2 process and save:
   ```bash
   pm2 save
   pm2 kill
   ```

2. AWS Console → EC2 → Instances → select `i-xxxxx`
   - Actions → Instance State → Stop (wait for `stopped`)
   - Actions → Instance Settings → Change Instance Type → select **t3.medium**
   - Actions → Instance State → Start
3. Wait ~1 min for boot, then SSH in:
   ```bash
   ssh -i tds-geo.pem ubuntu@13.48.59.201
   pm2 resurrect
   curl http://localhost:3000/health
   ```

## Step 3: Deploy OpenSEO Sidecar

After instance upgrade, OpenSEO build should complete within 2-3 min:

```bash
cd /home/ubuntu/tds-geo
docker compose -f docker-compose.sidecars.yml up -d openseo
docker logs -f tds-openseo   # watch for: "Server running on port 3005"
```

## Step 4: Verify All Sidecars

```bash
curl http://localhost:3000/health | jq .checks
```

Expected:
- database: healthy
- redis: healthy
- headroom: healthy
- freellmapi: healthy
- openseo: healthy
- crawl4ai: healthy
