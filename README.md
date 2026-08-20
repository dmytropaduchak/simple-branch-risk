# simple-branch-risk

Checks whether the repository default branch has basic branch protection (reviews, status checks, no force-push) and reports gaps on the pull request or workflow summary.

On private repositories the token may need **admin** rights to read protection settings.

## What it checks

- protection enabled at all
- required pull request reviews
- required status checks
- force pushes disabled
- branch deletions disabled
- admins enforced (advisory)

## Usage

```yaml
name: Branch risk
on:
  pull_request:
  schedule:
    - cron: "0 9 * * 1"

permissions:
  contents: read
  pull-requests: write

jobs:
  simple-branch-risk:
    runs-on: ubuntu-latest
    steps:
      - uses: dmytropaduchak/simple-branch-risk@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Read protection + post comments |
| `fail-on` | `none` | `none` / `medium` / `high` |

## Develop

```bash
npm install && npm run build
```
