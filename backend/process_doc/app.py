import os
import time
from urllib.parse import unquote_plus

import boto3

textract = boto3.client("textract")
table = boto3.resource("dynamodb").Table(os.environ["DOCS_TABLE"])


def set_status(user_id, doc_id, status, **extra):
    names = {"#s": "status"}
    values = {":s": status}
    sets = ["#s = :s"]
    for i, (k, v) in enumerate(extra.items()):
        names[f"#e{i}"] = k
        values[f":e{i}"] = v
        sets.append(f"#e{i} = :e{i}")
    table.update_item(
        Key={"userId": user_id, "docId": doc_id},
        UpdateExpression="SET " + ", ".join(sets),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def handler(event, context):
    for rec in event["Records"]:
        bucket = rec["s3"]["bucket"]["name"]
        key = unquote_plus(rec["s3"]["object"]["key"])
        parts = key.split("/")
        # expected: uploads/<userId>/<docId>/<filename>
        if len(parts) != 4 or parts[0] != "uploads":
            print(f"Skipping unexpected key: {key}")
            continue
        _, user_id, doc_id, _name = parts

        try:
            result = textract.detect_document_text(
                Document={"S3Object": {"Bucket": bucket, "Name": key}}
            )
            lines = [b["Text"] for b in result["Blocks"] if b["BlockType"] == "LINE"]
            text = "\n".join(lines)
            set_status(user_id, doc_id, "EXTRACTED", text=text, extractedAt=int(time.time()))
            print(f"Extracted {len(lines)} lines for {doc_id}")
        except Exception as e:  # don't re-raise: S3 would retry the invoke
            print(f"Extraction failed for {key}: {e}")
            set_status(user_id, doc_id, "FAILED", error=str(e)[:500])