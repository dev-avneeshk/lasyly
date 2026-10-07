# Scratch files stay inside the workspace

Never write files to `/tmp`, `/private/tmp`, `$TMPDIR` or anywhere outside `/Users/ayushkumar/development/betroom`. Writing outside the workspace triggers a manual approval prompt that blocks unattended workflow runs.

Put throwaway scripts (Playwright checks, repro scripts), logs, patches, screenshots and SQL scratch files in:

`/Users/ayushkumar/development/betroom/.agents/tasks/lasyly-audit-2026-10-02/scratch/`

Create it with `mkdir -p` if it's missing, and run scripts from there by absolute path. Delete scratch files when a task finishes.
