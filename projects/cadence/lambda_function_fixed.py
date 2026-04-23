import json
import os
import base64
import hashlib
import hmac
import secrets as secrets_mod
from datetime import datetime, timezone, timedelta
from urllib.parse import quote, urlencode

import boto3
import requests
from pymongo import MongoClient

# Module-level cache for warm Lambda invocations
_secrets_cache = None
_mongo_client = None

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_PROFILE_URL = "https://api.prod.whoop.com/developer/v1/user/profile/basic"
REDIRECT_URI = "https://nldsq794q0.execute-api.us-west-2.amazonaws.com/auth"
WHOOP_SCOPES = "offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement"

# Sleep, workout, and recovery are all v2 API endpoints (UUID-based IDs)
WHOOP_API_URLS = {
    "recovery.updated": "https://api.prod.whoop.com/developer/v2/recovery/{id}",
    "sleep.updated": "https://api.prod.whoop.com/developer/v2/activity/sleep/{id}",
    "workout.updated": "https://api.prod.whoop.com/developer/v2/activity/workout/{id}",
}
# Recovery list URL for matching sleep_id (v2)
WHOOP_RECOVERY_LIST_URL = "https://api.prod.whoop.com/developer/v2/recovery?limit=10"


def get_secrets():
    global _secrets_cache
    if _secrets_cache is not None:
        return _secrets_cache

    secret_id = os.environ["SECRET_ID"]
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager")
    secret_value = client.get_secret_value(SecretId=secret_id)
    _secrets_cache = json.loads(secret_value["SecretString"])
    return _secrets_cache


def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        secrets = get_secrets()
        _mongo_client = MongoClient(secrets["mongo.uri"])
    return _mongo_client


def get_collection(name):
    client = get_mongo_client()
    db_name = os.environ.get("DB_NAME", "cadence-dev")
    return client[db_name][name]


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def get_raw_body(event):
    body = event.get("body", "")
    if event.get("isBase64Encoded", False):
        body = base64.b64decode(body).decode("utf-8")
    return body


def get_header(event, name):
    headers = event.get("headers", {})
    return headers.get(name) or headers.get(name.lower(), "")


def validate_hmac_signature(event, raw_body):
    signature = get_header(event, "X-Whoop-Signature")
    timestamp = get_header(event, "X-Whoop-Signature-Timestamp")

    if not signature:
        print("AUTH_FAILURE: Missing X-Whoop-Signature header")
        return False

    if not timestamp:
        print("AUTH_FAILURE: Missing X-Whoop-Signature-Timestamp header")
        return False

    secrets = get_secrets()
    client_secret = secrets["whoop.client_secret"]

    data = timestamp + raw_body
    computed = hmac.new(
        client_secret.encode(), data.encode(), hashlib.sha256
    ).digest()
    computed_sig = base64.b64encode(computed).decode()

    if not hmac.compare_digest(signature, computed_sig):
        print("AUTH_FAILURE: Signature mismatch")
        return False

    return True


def get_access_token(user_id):
    collection = get_collection("user")
    user_doc = collection.find_one({"user_id": user_id})

    if not user_doc:
        print(f"TOKEN_ERROR: User not found: {user_id}")
        return None

    if "access_token" not in user_doc:
        print(f"TOKEN_ERROR: No access_token for user: {user_id}")
        return None

    last_updated = user_doc.get("last_updated")
    expires_in = user_doc.get("expires_in", 0)

    if last_updated and isinstance(last_updated, datetime):
        expiration = last_updated + timedelta(seconds=expires_in)
        if datetime.now(timezone.utc) <= expiration.replace(tzinfo=timezone.utc):
            return user_doc["access_token"]

    print(f"TOKEN_REFRESH: Token expired for user: {user_id}")
    return refresh_access_token(user_doc)


def refresh_access_token(user_doc):
    secrets = get_secrets()
    client_id = secrets["whoop.client_id"]
    client_secret = secrets["whoop.client_secret"]

    refresh_token = user_doc.get("refresh_token")
    scope = user_doc.get("scope", "")

    if not refresh_token:
        print(
            f"TOKEN_ERROR: No refresh_token for user: {user_doc.get('user_id')}")
        return None

    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": quote(scope, safe=""),
    }

    resp = requests.post(
        WHOOP_TOKEN_URL,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "*/*",
            "Cache-Control": "no-cache",
        },
    )

    if resp.status_code != 200:
        print(f"TOKEN_ERROR: Refresh failed ({resp.status_code}): {resp.text}")
        return None

    token_data = resp.json()
    new_access_token = token_data["access_token"]

    collection = get_collection("user")
    collection.update_one(
        {"user_id": user_doc["user_id"]},
        {
            "$set": {
                "access_token": new_access_token,
                "refresh_token": token_data["refresh_token"],
                "expires_in": token_data["expires_in"],
                "scope": token_data["scope"],
                "token_type": token_data["token_type"],
                "last_updated": datetime.now(timezone.utc),
            }
        },
    )

    print(f"TOKEN_REFRESH: Success for user: {user_doc['user_id']}")
    return new_access_token


def fetch_whoop_resource(event_type, resource_id, access_token):
    url_template = WHOOP_API_URLS.get(event_type)
    if not url_template:
        print(f"FETCH_ERROR: No URL mapping for event type: {event_type}")
        return None

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Cache-Control": "no-cache",
    }

    # recovery.updated sends a sleep UUID as the id; there is no GET /recovery/{uuid}.
    # Instead, fetch the recent recovery list and match by sleep_id.
    if event_type == "recovery.updated":
        resp = requests.get(WHOOP_RECOVERY_LIST_URL, headers=headers)
        if resp.status_code != 200:
            print(f"FETCH_ERROR: WHOOP API returned {resp.status_code} for {event_type} "
                  f"id={resource_id}: {resp.text}")
            return None
        records = resp.json().get("records", [])
        for record in records:
            if record.get("sleep_id") == resource_id:
                return record
        print(f"FETCH_WARNING: No recovery record found with sleep_id={resource_id}")
        return None

    url = url_template.replace("{id}", str(resource_id))
    resp = requests.get(url, headers=headers)

    if resp.status_code == 200:
        return resp.json()

    print(f"FETCH_ERROR: WHOOP API returned {resp.status_code} for {event_type} "
          f"id={resource_id}: {resp.text}")
    return None


def extract_date_from_response(resource_type, data):
    """Extract YYYY-MM-DD date from WHOOP API response timestamps."""
    if resource_type == "recovery":
        ts = data.get("created_at")
    else:
        ts = data.get("start")

    if ts and isinstance(ts, str) and len(ts) >= 10:
        return ts[:10]

    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def upsert_whoop_daily(user_id, event_type, data):
    """Upsert WHOOP data into whoop_daily collection, nested by resource type."""
    resource_type = event_type.split(".")[0]
    date_str = extract_date_from_response(resource_type, data)
    now = datetime.now(timezone.utc)

    collection = get_collection("whoop_daily")
    result = collection.update_one(
        {"user_id": user_id, "date": date_str},
        {
            "$set": {
                resource_type: data,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_id": user_id,
                "date": date_str,
                "created_at": now,
            },
        },
        upsert=True,
    )

    action = "updated" if result.modified_count > 0 else "inserted"
    print(
        f"DAILY_UPSERT: whoop_daily {action}: user_id={user_id} date={date_str} type={resource_type}")


def mark_event_processed(event_doc_id, success, error_msg=None):
    """Mark webhook event as processed or failed in webhook_event."""
    if event_doc_id is None:
        return

    update = {
        "$set": {
            "processed": success,
            "processed_at": datetime.now(timezone.utc),
        }
    }
    if error_msg:
        update["$set"]["error"] = error_msg

    try:
        collection = get_collection("webhook_event")
        collection.update_one({"_id": event_doc_id}, update)
    except Exception as e:
        print(f"MARK_ERROR: Failed to mark event {event_doc_id}: {e}")


def html_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "text/html"},
        "body": body,
    }


def redirect_response(url):
    return {
        "statusCode": 302,
        "headers": {"Location": url},
        "body": "",
    }


def handle_login(event):
    app_secrets = get_secrets()
    state = secrets_mod.token_hex(16)

    params = urlencode({
        "response_type": "code",
        "client_id": app_secrets["whoop.client_id"],
        "state": state,
        "scope": WHOOP_SCOPES,
        "redirect_uri": REDIRECT_URI,
    })

    url = f"{WHOOP_AUTH_URL}?{params}"
    print(f"LOGIN: Redirecting to WHOOP OAuth, state={state}")
    return redirect_response(url)


def handle_auth(event):
    query = event.get("queryStringParameters") or {}
    code = query.get("code")
    state = query.get("state", "")

    if not code:
        print("AUTH_ERROR: Missing authorization code")
        return html_response(400, "<h1>Error</h1><p>Missing authorization code.</p>")

    print(f"AUTH: Received callback, state={state}")

    # Exchange authorization code for tokens
    app_secrets = get_secrets()
    token_resp = requests.post(
        WHOOP_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": app_secrets["whoop.client_id"],
            "client_secret": app_secrets["whoop.client_secret"],
            "redirect_uri": REDIRECT_URI,
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "*/*",
            "Cache-Control": "no-cache",
        },
    )

    if token_resp.status_code != 200:
        print(
            f"AUTH_ERROR: Token exchange failed ({token_resp.status_code}): {token_resp.text}")
        return html_response(500, "<h1>Error</h1><p>Token exchange failed.</p>")

    token_data = token_resp.json()
    access_token = token_data["access_token"]
    print("AUTH: Token exchange successful")

    # Fetch user profile to get user_id
    profile_resp = requests.get(
        WHOOP_PROFILE_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Cache-Control": "no-cache",
        },
    )

    if profile_resp.status_code != 200:
        print(
            f"AUTH_ERROR: Profile fetch failed ({profile_resp.status_code}): {profile_resp.text}")
        return html_response(500, "<h1>Error</h1><p>Failed to fetch user profile.</p>")

    profile = profile_resp.json()
    user_id = profile.get("user_id")
    print(f"AUTH: User profile fetched, user_id={user_id}")

    # Upsert user document in user
    collection = get_collection("user")
    now = datetime.now(timezone.utc)

    collection.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "access_token": access_token,
                "refresh_token": token_data["refresh_token"],
                "expires_in": token_data["expires_in"],
                "scope": token_data["scope"],
                "token_type": token_data["token_type"],
                "last_updated": now,
            },
            "$setOnInsert": {
                "user_id": user_id,
                "first_name": profile.get("first_name"),
                "last_name": profile.get("last_name"),
                "email": profile.get("email"),
                "created_at": now,
            },
        },
        upsert=True,
    )

    name = profile.get("first_name", "User")
    print(f"AUTH: User {user_id} ({name}) stored in user")

    return html_response(200,
                         f"<h1>Authorization Successful</h1>"
                         f"<p>Welcome, {name}! Your WHOOP account (user_id: {user_id}) has been connected.</p>"
                         )


def handle_webhook(event):
    # 1. Extract raw body
    raw_body = get_raw_body(event)

    # 2. Validate HMAC signature
    if not validate_hmac_signature(event, raw_body):
        return response(401, {"error": "Unauthorized"})

    # 3. Parse body as JSON
    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, Exception) as e:
        print(f"PARSE_ERROR: {e}")
        return response(400, {"error": "Invalid JSON body"})

    # 4. Validate required fields
    event_type = payload.get("type")
    resource_id = payload.get("id")
    user_id = payload.get("user_id")

    if not event_type:
        print(f"VALIDATION_ERROR: Missing 'type': {raw_body}")
        return response(400, {"error": "Missing required field: type"})
    if resource_id is None:
        print(f"VALIDATION_ERROR: Missing 'id': {raw_body}")
        return response(400, {"error": "Missing required field: id"})
    if user_id is None:
        print(f"VALIDATION_ERROR: Missing 'user_id': {raw_body}")
        return response(400, {"error": "Missing required field: user_id"})

    # 5. Store raw webhook event
    event_doc_id = None
    try:
        webhook_doc = dict(payload)
        webhook_doc["time_stamp"] = datetime.now(timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.%f"
        )[:-3] + "Z"
        webhook_doc["processed"] = False

        collection = get_collection("webhook_event")
        result = collection.insert_one(webhook_doc)
        event_doc_id = result.inserted_id
        print(
            f"WEBHOOK_STORED: type={event_type} id={resource_id} user_id={user_id}")
    except Exception as e:
        print(f"MONGO_ERROR: Failed to store webhook event: {e}")

    # 6. Process update events
    if event_type.endswith(".updated"):
        try:
            access_token = get_access_token(user_id)
            if not access_token:
                raise Exception(f"No access token for user {user_id}")

            data = fetch_whoop_resource(event_type, resource_id, access_token)
            if not data:
                raise Exception(
                    f"No data from WHOOP API for {event_type} id={resource_id}")

            upsert_whoop_daily(user_id, event_type, data)
            mark_event_processed(event_doc_id, True)

        except Exception as e:
            print(f"PROCESS_ERROR: {e}")
            mark_event_processed(event_doc_id, False, str(e))

    # 7. Delete events — log only (matches C++ behavior)
    elif event_type.endswith(".deleted"):
        print(
            f"DELETE_EVENT: type={event_type} id={resource_id} user_id={user_id}")

    else:
        print(f"UNKNOWN_EVENT: type={event_type}")

    # 8. Always return 200 after valid HMAC
    return response(200, {"status": "ok"})


def lambda_handler(event, context):
    # Route based on HTTP method and path
    http_ctx = event.get("requestContext", {}).get("http", {})
    method = http_ctx.get("method", event.get("httpMethod", "POST"))
    path = http_ctx.get("path", event.get("path", "/"))

    if method == "GET" and path.endswith("/login"):
        return handle_login(event)

    if method == "GET" and path.endswith("/auth"):
        return handle_auth(event)

    # Default: POST webhook handler
    return handle_webhook(event)
