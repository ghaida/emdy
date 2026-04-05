#!/bin/bash
#
# Interactive version bump.
# Usage: npm run bump
#
# Asks what kind of release, bumps package.json, commits, tags,
# and offers to push.

set -euo pipefail
cd "$(dirname "$0")/.."

# Check for clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  echo "  Hold on — you have uncommitted changes."
  echo "  Commit or stash them first, then try again."
  echo ""
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")

echo ""
echo "  Current version: $CURRENT_VERSION"
echo ""
echo "  What kind of release is this?"
echo ""
echo "    1) patch — bug fix, nothing new"
echo "    2) minor — new feature"
echo "    3) major — big milestone"
echo ""
printf "  Pick one [1/2/3]: "
read -r CHOICE

case "$CHOICE" in
  1|patch) BUMP_TYPE="patch" ;;
  2|minor) BUMP_TYPE="minor" ;;
  3|major) BUMP_TYPE="major" ;;
  *)
    echo "  Cancelled."
    exit 1
    ;;
esac

# Split and bump
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$BUMP_TYPE" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TAG="v$NEW_VERSION"

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "  Error: Tag $TAG already exists."
  exit 1
fi

echo ""
echo "  $CURRENT_VERSION → $NEW_VERSION"
echo ""
printf "  Look good? [Y/n]: "
read -r CONFIRM

if [[ "$CONFIRM" =~ ^[Nn] ]]; then
  echo "  Cancelled."
  exit 1
fi

# Update package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update site/version.json
SITE_VERSION="../site/version.json"
if [ -f "$SITE_VERSION" ]; then
  node -e "
    const fs = require('fs');
    const v = { version: '$NEW_VERSION', url: 'https://github.com/ghaida/emdy/releases/latest' };
    fs.writeFileSync('$SITE_VERSION', JSON.stringify(v, null, 2) + '\n');
  "
fi

# Commit and tag
git add package.json
git add -f ../site/version.json 2>/dev/null || true
git commit -m "release: v$NEW_VERSION"
git tag -a "$TAG" -m "v$NEW_VERSION"

echo ""
echo "  Tagged v$NEW_VERSION"
echo ""
printf "  Push now? [Y/n]: "
read -r PUSH

if [[ ! "$PUSH" =~ ^[Nn] ]]; then
  git push && git push --tags
  echo ""
  echo "  Pushed! GitHub release workflow will take it from here."
else
  echo ""
  echo "  When you're ready:  git push && git push --tags"
fi
echo ""
