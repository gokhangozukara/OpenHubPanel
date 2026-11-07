#!/usr/bin/env bash
set -euo pipefail

# Run on Linux (including WSL on the maintainer's laptop). Build a staged source
# archive, not a second Git checkout. No runtime environment files are included.
source_archive=$(realpath "${1:?Source archive is required}")
output_archive=$(realpath -m "${2:?Output archive is required}")
build_root="${XDG_CACHE_HOME:-$HOME/.cache}/openhubpanel/builds"
mkdir -p "$build_root"
build_dir=$(mktemp -d "$build_root/build.XXXXXXXX")
tar -xf "$source_archive" -C "$build_dir"
cd "$build_dir"
npm exec --yes --package=pnpm@12.18.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@12.18.0 -- pnpm build
mkdir -p .next-release/apps/web/.next .next-release/runtime
cp -a apps/web/.next/standalone/. .next-release/
cp -a apps/web/.next/static .next-release/apps/web/.next/static
cp "$(command -v node)" .next-release/runtime/node
node_root=$(dirname "$(dirname "$(command -v node)")")
cp "$node_root/LICENSE" .next-release/runtime/NODE-LICENSE
cp LICENSE .next-release/LICENSE
node scripts/licenses.mjs
cp docs/dependency-licenses.json .next-release/THIRD_PARTY_PACKAGES.json
mkdir -p .next-release/third-party-notices
while IFS= read -r -d '' notice; do
  notice_target=".next-release/third-party-notices/${notice#node_modules/.pnpm/}"
  mkdir -p "$(dirname "$notice_target")"
  cp "$notice" "$notice_target"
done < <(find node_modules/.pnpm -type f \( -iname 'LICENSE*' -o -iname 'NOTICE*' \) -print0)
npm exec --yes --package=pnpm@12.18.0 -- pnpm exec esbuild scripts/operator-bootstrap.ts --bundle --platform=node --format=esm --outfile=.next-release/operator-bootstrap.mjs
mkdir -p .next-release/connectors
cp infra/connectors/hubstag.cjs .next-release/connectors/hubstag.cjs
cp infra/connectors/push.cjs .next-release/connectors/push.cjs
cp infra/connectors/firebase-push.cjs .next-release/connectors/firebase-push.cjs
cp infra/connectors/legacy-login.cjs .next-release/connectors/legacy-login.cjs
cp infra/connectors/legacy-session.cjs .next-release/connectors/legacy-session.cjs
cp infra/connectors/legacy-session-browser.js .next-release/connectors/legacy-session-browser.js
cp scripts/operator-backup.mjs .next-release/operator-backup.mjs
sha256sum "$source_archive" | cut -d ' ' -f1 > .next-release/SOURCE_ARCHIVE_SHA256
tar -czf "$output_archive" -C .next-release .
sha256sum "$output_archive"
printf 'Build directory retained for verification: %s\n' "$build_dir"
