#!/usr/bin/env bash
# Guard regression suite. Run in CI on every change under .claude/ or scripts/.
# Every case asserts the guard's exit code: 2 = blocked, 0 = allowed.
cd "$(dirname "$0")/.." || exit 1
G=scripts/guards
pass=0; fail=0

check() { # check <expected> <guard> <json>
  local expected="$1" guard="$2" json="$3" actual
  actual=$(echo "$json" | "$G/$guard" 2>/dev/null; echo $?)
  actual=$(echo "$actual" | tail -1)
  if [ "$actual" = "$expected" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    echo "FAIL  $guard  expected=$expected actual=$actual"
    echo "      $json"
  fi
}

bash_json()  { printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$(jq -Rn --arg c "$1" '$c')"; }
write_json() { printf '{"tool_name":"Write","tool_input":{"file_path":%s,"content":"x"}}' "$(jq -Rn --arg c "$1" '$c')"; }

echo "— no-secrets"
check 2 no-secrets.sh "$(write_json '/repo/.env')"
check 2 no-secrets.sh "$(write_json '/repo/apps/web/.env.local')"
check 2 no-secrets.sh "$(write_json '/repo/certs/server.pem')"
check 2 no-secrets.sh "$(bash_json 'cat .env.production')"
check 2 no-secrets.sh "$(bash_json 'vercel env pull')"
check 2 no-secrets.sh "$(bash_json 'git commit -m "add key sk-abcdefghijklmnopqrstuvwx"')"
check 0 no-secrets.sh "$(write_json '/repo/apps/web/src/App.tsx')"
check 0 no-secrets.sh "$(bash_json 'cat .env.example')"
check 0 no-secrets.sh "$(bash_json 'pnpm test')"

echo "— no-prod"
check 2 no-prod.sh "$(bash_json 'git push --force origin feat/x')"
check 2 no-prod.sh "$(bash_json 'git push origin main')"
check 2 no-prod.sh "$(bash_json 'vercel --prod')"
check 2 no-prod.sh "$(bash_json 'vercel promote dpl_abc')"
check 2 no-prod.sh "$(bash_json 'psql $PROD_DATABASE -c "select 1"')"
check 2 no-prod.sh "$(bash_json 'psql -c "DROP TABLE users"')"
check 2 no-prod.sh "$(bash_json 'rm -rf /')"
check 0 no-prod.sh "$(bash_json 'git push origin feat/007-booking')"
check 0 no-prod.sh "$(bash_json 'vercel build')"
check 0 no-prod.sh "$(bash_json 'pnpm db:migrate')"
check 0 no-prod.sh "$(bash_json 'rm -rf node_modules/.cache')"

echo "— no-merge"
check 2 no-merge.sh "$(bash_json 'gh pr merge 42 --squash')"
check 2 no-merge.sh "$(bash_json 'gh pr review 42 --approve')"
check 2 no-merge.sh "$(bash_json 'gh pr ready 42')"
check 0 no-merge.sh "$(bash_json 'gh pr create --draft --title "feat: booking"')"
check 0 no-merge.sh "$(bash_json 'gh pr view 42')"

echo "— scope-check"
rm -f .claude/active-plan
check 0 scope-check.sh "$(write_json 'apps/web/src/App.tsx')"   # no active plan = permissive

echo evals/fixtures/example-plan.md > .claude/active-plan
ROOT="$(git rev-parse --show-toplevel)"
check 0 scope-check.sh "$(write_json "$ROOT/apps/api/routes/booking.ts")"      # in plan
check 0 scope-check.sh "$(write_json "$ROOT/packages/db/schema/booking.ts")"   # in plan
check 0 scope-check.sh "$(write_json "$ROOT/apps/api/routes/booking.test.ts")" # tests always allowed
check 0 scope-check.sh "$(write_json "$ROOT/docs/decisions/001-x.md")"         # docs always allowed
check 2 scope-check.sh "$(write_json "$ROOT/apps/web/src/App.tsx")"            # NOT in plan
check 2 scope-check.sh "$(write_json "$ROOT/package.json")"                    # NOT in plan
rm -f .claude/active-plan

echo
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ]
