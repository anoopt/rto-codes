#!/bin/bash

# Ralph-Once: Execute one user story from the PRD using GitHub Copilot CLI
# Usage: ./plans/ralph-once.sh

set -e

PRD_FILE="plans/prd-openstreetmap-integration.json"
PROGRESS_FILE="plans/progress.txt"

# Ensure progress.txt exists
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# OpenStreetMap Integration Progress" > "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
  echo "## Completed Tasks" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
fi

# Use GitHub Copilot CLI to execute one task
copilot -p "@$PRD_FILE @$PROGRESS_FILE \
1. Read the PRD and progress file. \
2. Find the next incomplete user story (where \"passes\": false) and implement it completely. \
3. Follow the acceptance criteria exactly. \
4. After implementation: Run 'bun run typecheck', then 'bun run lint', then 'bun run build'. \
5. Update the user story in $PRD_FILE to set \"passes\": true and add notes about what was done. \
6. Append completion details to $PROGRESS_FILE. \
7. Commit your changes with message 'feat: [US-XXX] [story title]', then push to remote. \
ONLY DO ONE TASK AT A TIME." \
--allow-tool 'write' \
--allow-tool 'shell(bun)' \
--allow-tool 'shell(git add)' \
--allow-tool 'shell(git commit)' \
--allow-tool 'shell(git push)'
