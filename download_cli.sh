#!/usr/bin/env sh
set -euo pipefail

REPO="block/goose"
FILE="goose"
OUT_FILE="rgoose"
GITHUB_API_ENDPOINT="api.github.com"

alias errcho='>&2 echo'

function gh_curl() {
  curl -sL -H "Accept: application/vnd.github.v3.raw" $@
}

PARSER="map(select(.prerelease == true and has(\"assets\") and (.assets | length > 0))) | sort_by(.published_at) | reverse | .[0].assets | map(select(.name == \"$FILE\"))[0].id"

# Find the goose binary asset id
echo "Looking up the most recent goose binary release...\n"
ASSET_ID=`gh_curl https://$GITHUB_API_ENDPOINT/repos/$REPO/releases | jq "$PARSER"`
if [ "$ASSET_ID" = "null" ]; then
  errcho "ERROR: $FILE asset not found"
  exit 1
fi

# Download the goose binary
echo "Downloading goose...\n"
curl -sL --header 'Accept: application/octet-stream' https://$GITHUB_API_ENDPOINT/repos/$REPO/releases/assets/$ASSET_ID > $OUT_FILE
chmod +x $OUT_FILE

LOCAL_BIN="$HOME/.local/bin"
if [ ! -d "$LOCAL_BIN" ]; then
  echo "Directory $LOCAL_BIN does not exist. Creating it now..."
  mkdir -p "$LOCAL_BIN"
  echo "Directory $LOCAL_BIN created successfully.\n"
fi

echo "Sending goose to $LOCAL_BIN/$OUT_FILE\n"
chmod +x $OUT_FILE
mv $OUT_FILE $LOCAL_BIN/$OUT_FILE

# Check if the directory is in the PATH
if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
  echo "The directory $LOCAL_BIN is not in your PATH."
  echo "To add it, append the following line to your shell configuration file (e.g., ~/.bashrc or ~/.zshrc):"
  echo ""
  echo "    export PATH=\"$LOCAL_BIN:\$PATH\""
  echo ""
  echo "Then reload your shell configuration file by running:"
  echo ""
  echo "    source ~/.bashrc    # or source ~/.zshrc\n"
fi

# Initialize config args with the default name
CONFIG_ARGS="-n default"

# Check for GOOSE_PROVIDER environment variable
if [ -n "${GOOSE_PROVIDER:-}" ]; then
    CONFIG_ARGS="$CONFIG_ARGS -p $GOOSE_PROVIDER"
fi

# Check for GOOSE_MODEL environment variable
if [ -n "${GOOSE_MODEL:-}" ]; then
    CONFIG_ARGS="$CONFIG_ARGS -m $GOOSE_MODEL"
fi

$LOCAL_BIN/$OUT_FILE configure $CONFIG_ARGS

echo "You can now run Goose using: $OUT_FILE session\n"
