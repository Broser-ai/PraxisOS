# VS Code agent tasks (local setup)

`.vscode/` is gitignored in this repository, so task definitions are not
committed. Create them locally if you want one-click access to the review gate.

Create `.vscode/tasks.json` with the following. It is ignored by Git, so it will
not appear in your commits.

```json
{
  "version": "2.0.0",
  "inputs": [
    {
      "id": "cursorBranch",
      "type": "promptString",
      "description": "Cursor branch to review (without origin/)",
      "default": "cursor/planway-total-kill-live-2c11"
    }
  ],
  "tasks": [
    {
      "label": "PraxisOS: Fetch branches",
      "type": "shell",
      "command": "git fetch --all --prune && git branch -r",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: List unmerged Cursor branches",
      "type": "shell",
      "command": "git fetch origin --prune && for b in $(git branch -r --format='%(refname:short)' | grep '^origin/cursor/'); do n=$(git rev-list --count origin/main..$b); [ \"$n\" -gt 0 ] && printf '%-52s %4s commits  %s\\n' \"${b#origin/}\" \"$n\" \"$(git log -1 --format='%cd' --date=short $b)\"; done | sort -k4 -r",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: Compare Cursor branch with main",
      "type": "shell",
      "command": "git fetch origin --prune && git diff --stat origin/main...origin/${input:cursorBranch} && git diff --name-status origin/main...origin/${input:cursorBranch}",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: Typecheck",
      "type": "shell",
      "command": "npm run typecheck",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: Tests",
      "type": "shell",
      "command": "npm test",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: Build",
      "type": "shell",
      "command": "npm run build",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: Governance guards",
      "type": "shell",
      "command": "npx vitest run tests/planway-absence.test.ts tests/agent-safety-invariants.test.ts",
      "problemMatcher": []
    },
    {
      "label": "PraxisOS: Full quality gate",
      "dependsOrder": "sequence",
      "dependsOn": [
        "PraxisOS: Typecheck",
        "PraxisOS: Tests",
        "PraxisOS: Build",
        "PraxisOS: Governance guards"
      ],
      "problemMatcher": []
    }
  ]
}
```

There is no `lint` script in `package.json`. Do not add a lint task that claims
to pass — add the script first if linting is wanted.

The same gate runs in CI on pull requests against `main`
(`.github/workflows/ci.yml`).
