#!/usr/bin/env bash
# Scan for committed secrets with a pinned, checksum-verified gitleaks.
#
#   bash scripts/security/scan-secrets.sh                 # the working tree
#   SECRETS_BASE=<sha> bash scripts/security/scan-secrets.sh
#
# 1. A negative control first: a planted token must be found, or the scanner is not working.
# 2. The tracked and new (not ignored) files, never .env or dependencies.
# 3. The commits after SECRETS_BASE, so a secret added and removed inside a pull request is
#    still caught. Without a usable base (the first push of a repository), the whole history.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The published checksums of gitleaks 8.30.1 for each supported platform.
version=8.30.1
platform="$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed -e 's/^x86_64$/x64/' -e 's/^aarch64$/arm64/')"
case "$platform" in
  linux_x64) sha256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
  linux_arm64) sha256=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;;
  darwin_x64) sha256=dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709 ;;
  darwin_arm64) sha256=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5 ;;
  *) echo "secret scan: no pinned gitleaks build for $platform" >&2; exit 2 ;;
esac
curl -fsSL --retry 3 "https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${platform}.tar.gz" -o "$work/scanner.tar.gz"
if command -v sha256sum >/dev/null; then actual="$(sha256sum "$work/scanner.tar.gz")"; else actual="$(shasum -a 256 "$work/scanner.tar.gz")"; fi
[ "${actual%% *}" = "$sha256" ] || { echo "secret scan: the gitleaks download does not match its pinned checksum" >&2; exit 1; }
tar -xzf "$work/scanner.tar.gz" -C "$work" gitleaks
# --verbose prints each finding's file, line and rule; --redact keeps the value itself out of logs.
leaks() { "$work/gitleaks" "$@" --config "$root/.gitleaks.toml" --redact --verbose --no-banner; }

mkdir "$work/control"
printf 'github_token = "%s"\n' "ghp_$(printf 'aBcD0123456789%.0s' 1 2)aBcD012345" > "$work/control/token.txt"
status=0
"$work/gitleaks" dir "$work/control" --config "$root/.gitleaks.toml" --redact --no-banner --exit-code 42 >"$work/control.log" 2>&1 || status=$?
[ "$status" -eq 42 ] || { echo "secret scan: the negative control was not detected; the scanner is not working" >&2; exit 1; }

mkdir "$work/source"
git -C "$root" ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' file; do
  [ -f "$root/$file" ] && [ ! -L "$root/$file" ] || continue
  mkdir -p "$work/source/$(dirname "$file")"
  cp "$root/$file" "$work/source/$file"
done
leaks dir "$work/source"

base="${SECRETS_BASE:-}"
if [[ "$base" =~ ^[0-9a-f]{40}$ ]] && [[ ! "$base" =~ ^0+$ ]] && git -C "$root" cat-file -e "${base}^{commit}" 2>/dev/null; then
  leaks git "$root" --log-opts="${base}..HEAD"
else
  leaks git "$root"
fi
echo "secret scan: no secrets found"
