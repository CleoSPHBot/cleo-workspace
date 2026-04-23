#!/usr/bin/env python3
"""
Webhook test script — Option 1 synthetic test
Pulls whoop.client_secret from AWS Secrets Manager and fires a signed
webhook payload at the Lambda endpoint.
"""

import hmac
import hashlib
import base64
import json
import time
import boto3
import requests

REGION = "us-west-2"
SECRET_ID = "com.sph.dev.whoop"
WEBHOOK_URL = "https://nldsq794q0.execute-api.us-west-2.amazonaws.com/webhook"

# Test payload — real sleep UUID from whoop_daily (Hannah, 2026-04-22)
# Using sleep.updated — direct UUID lookup, not a list search, so works with any age
PAYLOAD = {
    "type": "sleep.updated",
    "id": "1311bd81-928c-40f2-b898-9b61b7edb0b2",
    "user_id": 6729032,
}


def get_client_secret():
    client = boto3.client("secretsmanager", region_name=REGION)
    secret = client.get_secret_value(SecretId=SECRET_ID)
    data = json.loads(secret["SecretString"])
    return data["whoop.client_secret"]


def sign_payload(client_secret: str, body: str, timestamp: str) -> str:
    data = timestamp + body
    sig = hmac.new(
        client_secret.encode(),
        data.encode(),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(sig).decode()


def main():
    print("Fetching client secret from AWS Secrets Manager...")
    client_secret = get_client_secret()
    print("  ✅ Secret retrieved")

    body = json.dumps(PAYLOAD)
    timestamp = str(int(time.time()))
    signature = sign_payload(client_secret, body, timestamp)

    print(f"\nFiring webhook → {WEBHOOK_URL}")
    print(f"  type:    {PAYLOAD['type']}")
    print(f"  id:      {PAYLOAD['id']}")
    print(f"  user_id: {PAYLOAD['user_id']}")

    resp = requests.post(
        WEBHOOK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Whoop-Signature": signature,
            "X-Whoop-Signature-Timestamp": timestamp,
        },
    )

    print(f"\nResponse: HTTP {resp.status_code}")
    print(f"  Body: {resp.text}")

    if resp.status_code == 200:
        print("\n✅ Webhook accepted — check CloudWatch + whoop_daily in MongoDB")
    elif resp.status_code == 401:
        print("\n❌ HMAC validation failed — signature mismatch")
    else:
        print(f"\n❌ Unexpected status: {resp.status_code}")


if __name__ == "__main__":
    main()
