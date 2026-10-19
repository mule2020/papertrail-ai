import json
import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

table = boto3.resource("dynamodb").Table(os.environ["DOCS_TABLE"])


def _default(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"Not serializable: {type(o)}")


def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]

    kwargs = {"KeyConditionExpression": Key("userId").eq(user_id)}
    items = []
    while True:
        res = table.query(**kwargs)
        items.extend(res["Items"])
        if "LastEvaluatedKey" not in res:
            break
        kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]

    docs = []
    for item in items:
        # keep the response small and internal fields private
        for field in ("text", "userId", "s3Key"):
            item.pop(field, None)
        docs.append(item)
    docs.sort(key=lambda d: d.get("createdAt", 0), reverse=True)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"documents": docs}, default=_default),
    }