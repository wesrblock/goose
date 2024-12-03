#!/bin/bash

# Test script for goose-server session management API
# Demonstrates saving, loading, and listing sessions

# Set up variables
SERVER_URL="http://localhost:3000"  # Adjust if using a different port
SESSION_ID="test-session-$(date +%s)"
TEMP_DIR="/tmp/goose-test-sessions"

# Create temporary session directory
echo "Creating temporary session directory: $TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Function to pretty print JSON responses
pretty_print() {
    echo "$1" | python3 -m json.tool
}

# 1. Save a session
echo -e "\n=== Saving session ==="
SAVE_RESPONSE=$(curl -s -X POST "$SERVER_URL/session/save" \
    -H "Content-Type: application/json" \
    -d @- << EOF
{
    "session_id": "$SESSION_ID",
    "session_dir": "$TEMP_DIR",
    "content": "{\"type\":\"conversation\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"},{\"role\":\"assistant\",\"content\":\"Hi there!\"}]}"
}
EOF
)

echo "Save response:"
pretty_print "$SAVE_RESPONSE"

# 2. List available sessions
echo -e "\n=== Listing sessions ==="
LIST_RESPONSE=$(curl -s -X POST "$SERVER_URL/session/list" \
    -H "Content-Type: application/json" \
    -d "{
        \"session_dir\": \"$TEMP_DIR\"
    }")

echo "List response:"
pretty_print "$LIST_RESPONSE"

# 3. Load the saved session
echo -e "\n=== Loading session ==="
LOAD_RESPONSE=$(curl -s -X POST "$SERVER_URL/session/load" \
    -H "Content-Type: application/json" \
    -d "{
        \"session_id\": \"$SESSION_ID\",
        \"session_dir\": \"$TEMP_DIR\"
    }")

echo "Load response:"
pretty_print "$LOAD_RESPONSE"

echo -e "\nTest complete!"