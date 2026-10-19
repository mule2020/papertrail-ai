import json
import os
import re
import time
import uuid

import boto3
from botocore.config import Config

REGION = os.environ["AWS_REGION"]
BUCKET = os.environ["BUCKET"]
s3 = boto3.client(
    "s3",
    region_name=REGION,
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(signature_version="s3v4"),
)
table = boto3.resource("dynamodb").Table(os.environ["DOCS_TABLE"])

ALLOWED_TYPES = {"image/png", "image/jpeg", "application/pdf"}


def resp(code, body):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return resp(400, {"error": "Body must be JSON"})

    filename = re.sub(r"[^A-Za-z0-9._-]", "_", body.get("filename", ""))[:100]
    content_type = body.get("contentType", "")
    if not filename:
        return resp(400, {"error": "filename is required"})
    if content_type not in ALLOWED_TYPES:
        return resp(400, {"error": f"contentType must be one of {sorted(ALLOWED_TYPES)}"})

    doc_id = uuid.uuid4().hex
    key = f"uploads/{user_id}/{doc_id}/{filename}"

    table.put_item(
        Item={
            "userId": user_id,
            "docId": doc_id,
            "filename": filename,
            "s3Key": key,
            "status": "UPLOADING",
            "createdAt": int(time.time()),
        }
    )

    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return resp(200, {"docId": doc_id, "uploadUrl": url})