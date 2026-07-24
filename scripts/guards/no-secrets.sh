#!/usr/bin/env bash
# Blocks any read or write of credential material, and any command that would
# print a secret into a transcript.
source "$(dirname "$0")/_lib.sh"

# Paths that are never read or written by an agent.
SECRET_PATHS='(^|/)\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|(^|/)id_rsa|(^|/)id_ed25519|(^|/)\.npmrc$|(^|/)\.netrc$|(^|/)credentials(\.json)?$|(^|/)service-account.*\.json$|(^|/)\.vercel/'
# Template files carry no secrets and are legitimately edited.
SAFE='\.env\.(example|sample|template)$|\.env\.(example|sample|template)([[:space:]]|$)'

if [ -n "$FILE_PATH" ] \
   && echo "$FILE_PATH" | grep -qE "$SECRET_PATHS" \
   && ! echo "$FILE_PATH" | grep -qE "$SAFE"; then
  block "'$FILE_PATH' is credential material. Agents never read or write it."
fi

if [ -n "$COMMAND" ]; then
  READERS='(cat|less|more|head|tail|bat|strings|xxd|cp|mv|scp|curl[[:space:]]+-T)'
  SECRET_ARG='(\.env|[^[:space:]]+\.(pem|key|p12|pfx)|id_rsa|id_ed25519|\.npmrc|\.netrc|credentials\.json|service-account[^[:space:]]*\.json)'
  if echo "$COMMAND" | grep -qE "\b${READERS}[[:space:]][^|;&]*${SECRET_ARG}" \
     && ! echo "$COMMAND" | grep -qE "$SAFE"; then
    block "command would expose credential material."
  fi
  if echo "$COMMAND" | grep -qE '\b(vercel[[:space:]]+env[[:space:]]+(pull|ls)|printenv|env)[[:space:]]*$'; then
    block "command would dump environment variables into the transcript."
  fi
  if echo "$COMMAND" | grep -qE '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|postgres(ql)?://[^:[:space:]]+:[^@[:space:]]+@)'; then
    block "command contains what looks like a live credential."
  fi
fi

exit 0
