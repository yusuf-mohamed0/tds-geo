# Database Backup Strategy

## Current Setup

PostgreSQL runs as a Docker container (`ai-seo-postgres`) with persistent volume `postgres-data`.

## Backup System

### 1. Automated Script: `scripts/backup-db.sh`

Creates daily compressed (`pg_dump -Fc`) backups with:

- **Compression**: Level 9 (max) custom format
- **Integrity check**: `pg_restore --list` validates each backup
- **Rotation**: Keeps 14 most recent, deletes older than 7 days
- **S3 upload**: Optional — set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`
- **Logging**: Writes to `BACKUP_DIR/backup.log`

### 2. Docker Compose Backup Service

The `db-backup` service runs the script daily at 3 AM via cron:

```bash
docker-compose up -d db-backup
```

### 3. CRITICAL: Server-Level Backups

The Docker backup service only runs when the compose stack is up. For production on the AWS server (13.48.59.201), you MUST also set up a host-level cron:

```bash
# SSH into server, then:
sudo crontab -e

# Add:
0 2 * * * /home/ubuntu/tds-geo/scripts/backup-db.sh
0 4 * * * /usr/local/bin/aws s3 sync /var/backups/tds-geo/ s3://tds-geo-backups/ --storage-class STANDARD_IA
```

## Restore Procedure

```bash
# List contents of a backup
pg_restore --list /var/backups/tds-geo/tds-geo_latest.dump

# Full restore (drops existing DB first)
dropdb -U postgres ai_seo_automation
createdb -U postgres ai_seo_automation
pg_restore -U postgres -d ai_seo_automation --clean --if-exists /var/backups/tds-geo/tds-geo_latest.dump

# Restore to a different DB name (safer)
createdb -U postgres ai_seo_automation_restore
pg_restore -U postgres -d ai_seo_automation_restore /var/backups/tds-geo/tds-geo_latest.dump
```

## WAL Archiving (Optional — for point-in-time recovery)

For production, enable WAL archiving for point-in-time recovery:

1. Mount a volume for WAL archives in the `postgres` service:
```yaml
volumes:
  - postgres-wal:/var/lib/postgresql/data/pg_wal
  - ./backups/wal:/wal_archive
```

2. Configure postgres to archive WAL segments:
```sql
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'cp %p /wal_archive/%f';
SELECT pg_reload_conf();
```

3. Restore from WAL:
```bash
# Set up base backup + WAL archive for replay
pg_restore -U postgres -d ai_seo_automation --recovery-target-time="2026-06-25 12:00:00 UTC" /var/backups/backup.dump
```

## Environment Variables for `.env`

```ini
# Backup retention
BACKUP_RETENTION_DAYS=7

# S3 (optional — for offsite backups)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=s3://tds-geo-backups
```

## Monitoring

- Check `/var/backups/tds-geo/backup.log` for success/failure
- Prometheus metric: `tds_geo_db_active_connections` (from `/metrics`)
- Heartbeat email alerts include error counts
- If S3 is configured, verify uploads at the S3 console
