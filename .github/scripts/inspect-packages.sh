#!/usr/bin/env bash
# Checks what a package holds before it is published: a published version cannot be taken back.
#
#   inspect-packages.sh vsix <file.vsix>   the extension
#   inspect-packages.sh cli <file.tgz>     the npm package of the command line
#
# Fails when a file is in the package that is not expected there, such as sources, tests,
# node_modules or source maps, or when a file the package needs is missing.
set -euo pipefail

kind="${1:?vsix or cli}"
file="${2:?the package to inspect}"

case "$kind" in
  vsix)
    entries="$(unzip -Z1 "$file")"
    allowed='^(extension\.vsixmanifest|\[Content_Types\]\.xml)$
^extension/(package\.json|package\.nls(\.[a-z-]+)?\.json|readme\.md|changelog\.md|LICENSE\.txt|language-configuration\.json)$
^extension/dist/extension\.cjs$
^extension/dist/chunks/[^/]+\.cjs$
^extension/dist/webview/index\.html$
^extension/dist/webview/assets/[^/]+\.(js|css)$
^extension/dist/skill/dav-(diagrams|reading|cli)/.+\.(md|mjs|dav)$
^extension/media/(icon\.png|file-icon-[a-z]+\.svg)$
^extension/syntaxes/[^/]+\.json$'
    required='extension/package.json
extension/readme.md
extension/changelog.md
extension/LICENSE.txt
extension/dist/extension.cjs
extension/dist/webview/index.html
extension/dist/webview/assets/webview.js
extension/dist/webview/assets/webview.css
extension/dist/skill/dav-diagrams/SKILL.md
extension/dist/skill/dav-reading/SKILL.md
extension/dist/skill/dav-cli/SKILL.md
extension/media/icon.png'
    ;;
  cli)
    entries="$(tar -tzf "$file")"
    allowed='^package/(package\.json|README\.md|LICENSE|dist/dav\.mjs)$'
    required='package/package.json
package/README.md
package/LICENSE
package/dist/dav.mjs'
    ;;
  *)
    echo "Unknown kind: $kind" >&2
    exit 2
    ;;
esac

# Directory entries end with a slash and hold nothing themselves.
entries="$(printf '%s\n' "$entries" | grep -v '/$' | LC_ALL=C sort)"

status=0
unexpected="$(printf '%s\n' "$entries" | grep -Ev -f <(printf '%s\n' "$allowed") || true)"
if [ -n "$unexpected" ]; then
  echo "$file holds files that are not expected in it:" >&2
  printf '%s\n' "$unexpected" | sed 's/^/  /' >&2
  status=1
fi
missing="$(LC_ALL=C comm -13 <(printf '%s\n' "$entries") <(printf '%s\n' "$required" | LC_ALL=C sort))"
if [ -n "$missing" ]; then
  echo "$file lacks files it needs:" >&2
  printf '%s\n' "$missing" | sed 's/^/  /' >&2
  status=1
fi
if [ "$status" -eq 0 ]; then
  echo "$file: $(printf '%s\n' "$entries" | wc -l | tr -d ' ') files, all expected."
fi
exit "$status"
