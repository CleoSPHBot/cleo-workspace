#!/bin/bash
# Q Business search script
# Usage: bash qb-search.sh "your question"

QUERY="$1"
APP_ID="1b2dcad6-c48e-4f28-ba6e-b10e4a8e476f"
REGION="us-west-2"

if [ -z "$QUERY" ]; then
    echo "Usage: bash qb-search.sh \"your question\""
    exit 1
fi

aws qbusiness chat-sync \
    --application-id "$APP_ID" \
    --user-message "$QUERY" \
    --region "$REGION" \
    2>&1
