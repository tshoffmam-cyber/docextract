import boto3
from botocore.exceptions import ClientError

from app.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
        )
    return _client


def upload_file(key: str, data: bytes, content_type: str) -> str:
    _get_client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"{settings.r2_public_url}/{key}"


def download_file(key: str) -> bytes:
    response = _get_client().get_object(Bucket=settings.r2_bucket_name, Key=key)
    return response["Body"].read()


def delete_file(key: str) -> bool:
    try:
        _get_client().delete_object(Bucket=settings.r2_bucket_name, Key=key)
        return True
    except ClientError:
        return False


def generate_presigned_url(key: str, expires: int = 3600) -> str:
    return _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.r2_bucket_name, "Key": key},
        ExpiresIn=expires,
    )
