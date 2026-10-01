#!/usr/bin/env python3
"""Run wrangler with the stored Cloudflare surrogate credential, cwd=repo root.
Usage: cf.py <wrangler args...>"""
import os, subprocess, sys
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import dynamic_credential_entry
entry = dynamic_credential_entry("custom.cloudflare", "access_token")
surrogate = str(entry["surrogate"]).strip()
assert surrogate.startswith("hsurr:"), "no surrogate"
env = dict(os.environ)
env["CLOUDFLARE_API_TOKEN"] = surrogate
env["CLOUDFLARE_ACCOUNT_ID"] = "1abe704f3449834965689b3b47db3926"
sys.exit(subprocess.run(["npx", "-y", "wrangler@4", *sys.argv[1:]], cwd=REPO, env=env).returncode)
