#!/usr/bin/env python3
"""Run prepared, read-only Supabase dumps with hidden local password entry.

Dump recipes must first be generated and reviewed by the release operator.
No restore, migration, deployment, or Storage download is performed here.
"""
import datetime
import getpass
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

PROJECT = "pwgqwcvultxihntvaewo"
IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.171"
RECIPES = (
    "roles", "schema", "data", "history-schema", "history-data",
    "auth-schema", "storage-schema",
)


def main():
    base = Path(sys.argv[1]).resolve()
    # Backups contain private Auth data and must stay outside the repository.
    repository = Path(__file__).resolve().parent.parent
    if base == repository or repository in base.parents:
        raise SystemExit("Choose a private backup folder outside the repository.")
    recipes = {}
    for name in RECIPES:
        source = (base / "recipes" / f"{name}.sh").read_text()
        if PROJECT not in source or 'export PGPASSWORD="${SUPABASE_DB_PASSWORD:?}"' not in source:
            raise SystemExit(f"Unreviewed or incorrect recipe: {name}")
        recipes[name] = source
    if not sys.stdin.isatty():
        raise SystemExit("Open this in Terminal for hidden password entry.")
    subprocess.run(["/usr/local/bin/docker", "info"], stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, check=True)
    print("Private backup of Kaizen Tracker. No live records will be changed.")
    password = getpass.getpass("Kaizen Tracker database password (hidden): ")
    if not password:
        raise SystemExit("No password entered; nothing exported.")
    os.umask(0o077)
    output = base / ("database-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    output.mkdir(mode=0o700)
    env = os.environ.copy()
    env["SUPABASE_DB_PASSWORD"] = password
    checksums = {}
    absent_history = False
    try:
        for name, source in recipes.items():
            if name == "history-data" and absent_history:
                continue
            print(f"Saving {name}…", flush=True)
            partial = output / f"{name}.sql.partial"
            with partial.open("wb") as sql, (output / f"{name}.log").open("wb") as log:
                process = subprocess.run(
                    ["/usr/local/bin/docker", "run", "--rm", "-i", "--env", "SUPABASE_DB_PASSWORD",
                     IMAGE, "bash"], input=source.encode(), env=env, stdout=sql, stderr=log,
                )
            if process.returncode or not partial.stat().st_size:
                details = (output / f"{name}.log").read_text(errors="replace")
                # An older Dashboard-managed project may have no CLI history.
                # Treat only this exact schema lookup result as optional; every
                # other export failure still stops the backup.
                if name == "history-schema" and details.strip() == "pg_dump: error: no matching schemas were found":
                    absent_history = True
                    partial.unlink()
                    print("This project has no CLI migration history; continuing.", flush=True)
                    continue
                if "password authentication failed" in details.lower():
                    raise RuntimeError(
                        "Supabase did not accept the database password on this attempt. "
                        "Check the saved Kaizen Tracker database password, or reset it in "
                        "Supabase's Database Settings, then reopen this backup launcher. "
                        "No live records were changed."
                    )
                raise RuntimeError(f"Export stopped at {name}. Private details are in {output / (name + '.log')}.")
            target = output / f"{name}.sql"
            partial.rename(target)
            checksums[target.name] = hashlib.sha256(target.read_bytes()).hexdigest()
        (output / "manifest.json").write_text(json.dumps({
            "project": PROJECT, "tool_image": IMAGE,
            "created_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "sha256": checksums,
            "migration_history_schema_present": not absent_history,
            "restore_tested": False,
            "storage_file_bytes_included": False,
            "note": "Logical exports use separate read snapshots. Auth/configuration and Storage file recovery need separate verification.",
        }, indent=2) + "\n")
        print(f"Database exports saved privately to {output}")
        print("Next: verify a local restore and preserve the four Storage files before cutover.")
    finally:
        env.pop("SUPABASE_DB_PASSWORD", None)
        password = None


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
