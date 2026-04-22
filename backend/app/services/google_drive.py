import io

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.config import settings

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
REDIRECT_URI = f"{settings.frontend_url}/auth/google/callback"


def get_oauth_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )


def get_authorization_url() -> tuple[str, str]:
    flow = get_oauth_flow()
    url, state = flow.authorization_url(access_type="offline", prompt="consent")
    return url, state


def exchange_code(code: str) -> dict:
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
    }


def download_drive_file(file_id: str, refresh_token: str) -> tuple[bytes, str]:
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    service = build("drive", "v3", credentials=creds)

    meta = service.files().get(fileId=file_id, fields="name,mimeType").execute()
    filename = meta.get("name", "documento.pdf")

    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    return buf.getvalue(), filename
