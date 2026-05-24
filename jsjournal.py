import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
IMAGE_DIR = UPLOAD_DIR / "images"
FILE_DIR = UPLOAD_DIR / "files"
DATA_FILE = BASE_DIR / "content_db.json"
ADMIN_TOKEN = os.getenv("JOURNAL_ADMIN_TOKEN", "ilovegrace0116")

for directory in (UPLOAD_DIR, IMAGE_DIR, FILE_DIR):
    directory.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="J's Journal",
    version="1.0",
    description="A personal journal, study tracker, and blog served with FastAPI.",
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def read_data() -> Dict[str, Any]:
    if not DATA_FILE.exists():
        return {"posts": [], "study": []}
    with DATA_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_data(data: Dict[str, Any]) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)


def get_admin_token(
    authorization: Optional[str] = Header(None),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
) -> str:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif x_admin_token:
        token = x_admin_token.strip()

    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized admin token")
    return token


class AttachmentItem(BaseModel):
    label: Optional[str] = None
    url: str
    filename: Optional[str] = None


class PostEntry(BaseModel):
    title: str = Field(..., min_length=1)
    category: str = "Daily Life"
    body: str = Field(..., min_length=1)
    images: Optional[List[str]] = []
    attachments: Optional[List[AttachmentItem]] = []


class StudyEntry(BaseModel):
    subject: str = Field(..., min_length=1)
    progress: int = Field(0, ge=0, le=100)
    notes: str = Field(..., min_length=1)
    resources: Optional[List[AttachmentItem]] = []


@app.get("/", response_class=RedirectResponse)
def root() -> RedirectResponse:
    return RedirectResponse(url="/static/index.html")


@app.get("/study", response_class=RedirectResponse)
def study_page() -> RedirectResponse:
    return RedirectResponse(url="/static/study.html")


@app.get("/api/content")
def get_public_content(category: Optional[str] = None) -> JSONResponse:
    """
    Return public content. If `category` query param is provided, filter posts by category.
    """
    data = read_data()
    if category:
        filtered = data.copy()
        filtered_posts = [p for p in data.get("posts", []) if (p.get("category") or "").lower() == category.lower()]
        filtered["posts"] = filtered_posts
        return JSONResponse(filtered)
    return JSONResponse(data)


@app.get("/api/study")
def get_study_content() -> JSONResponse:
    data = read_data()
    return JSONResponse({"study": data.get("study", [])})


@app.post("/api/admin/post")
def create_post(
    post: PostEntry,
    token: str = Depends(get_admin_token),
) -> JSONResponse:
    data = read_data()
    new_post = post.dict()
    new_post["id"] = f"post-{int(datetime.utcnow().timestamp() * 1000)}"
    new_post["created_at"] = datetime.utcnow().strftime("%Y-%m-%d")
    data.setdefault("posts", []).insert(0, new_post)
    write_data(data)
    return JSONResponse({"message": "Post created", "post": new_post})


@app.put("/api/admin/post/{entry_id}")
def update_post(
    entry_id: str,
    post: PostEntry,
    token: str = Depends(get_admin_token),
) -> JSONResponse:
    data = read_data()
    posts = data.get("posts", [])

    for index, entry in enumerate(posts):
        if entry.get("id") == entry_id:
            updated = entry.copy()
            updated.update(post.dict())
            posts[index] = updated
            write_data(data)
            return JSONResponse({"message": "Post updated", "post": updated})

    raise HTTPException(status_code=404, detail="Post not found")


@app.delete("/api/admin/post/{entry_id}")
def delete_post(entry_id: str, token: str = Depends(get_admin_token)) -> JSONResponse:
    data = read_data()
    posts = data.get("posts", [])
    updated_posts = [entry for entry in posts if entry.get("id") != entry_id]
    if len(updated_posts) == len(posts):
        raise HTTPException(status_code=404, detail="Post not found")
    data["posts"] = updated_posts
    write_data(data)
    return JSONResponse({"message": "Post deleted", "entry_id": entry_id})


@app.post("/api/admin/study")
def create_study_item(
    entry: StudyEntry,
    token: str = Depends(get_admin_token),
) -> JSONResponse:
    data = read_data()
    new_item = entry.dict()
    new_item["id"] = f"study-{int(datetime.utcnow().timestamp() * 1000)}"
    data.setdefault("study", []).append(new_item)
    write_data(data)
    return JSONResponse({"message": "Study item created", "item": new_item})


@app.put("/api/admin/study/{study_id}")
def update_study_item(
    study_id: str,
    entry: StudyEntry,
    token: str = Depends(get_admin_token),
) -> JSONResponse:
    data = read_data()
    study = data.get("study", [])

    for index, item in enumerate(study):
        if item.get("id") == study_id:
            updated = item.copy()
            updated.update(entry.dict())
            study[index] = updated
            write_data(data)
            return JSONResponse({"message": "Study item updated", "item": updated})

    raise HTTPException(status_code=404, detail="Study item not found")


@app.delete("/api/admin/study/{study_id}")
def delete_study_item(study_id: str, token: str = Depends(get_admin_token)) -> JSONResponse:
    data = read_data()
    study = data.get("study", [])
    filtered = [item for item in study if item.get("id") != study_id]
    if len(filtered) == len(study):
        raise HTTPException(status_code=404, detail="Study item not found")
    data["study"] = filtered
    write_data(data)
    return JSONResponse({"message": "Study item deleted", "study_id": study_id})


def save_upload_file(directory: Path, upload: UploadFile) -> Dict[str, str]:
    safe_name = upload.filename.replace(" ", "_")
    timestamp = int(datetime.utcnow().timestamp() * 1000)
    target = directory / f"{timestamp}_{safe_name}"
    with target.open("wb") as buffer:
        buffer.write(upload.file.read())
    return {
        "filename": upload.filename,
        "url": f"/uploads/{directory.name}/{target.name}",
    }


@app.post("/api/admin/upload-image")
def upload_image(
    image: UploadFile = File(...),
    token: str = Depends(get_admin_token),
) -> JSONResponse:
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")
    result = save_upload_file(IMAGE_DIR, image)
    return JSONResponse({"message": "Image uploaded", "image": result})


@app.post("/api/admin/upload-file")
def upload_file(
    file: UploadFile = File(...),
    token: str = Depends(get_admin_token),
) -> JSONResponse:
    result = save_upload_file(FILE_DIR, file)
    return JSONResponse({"message": "File uploaded", "file": result})


@app.get("/api/admin/token-status")
def token_status(token: str = Depends(get_admin_token)) -> JSONResponse:
    return JSONResponse({"message": "Admin token is valid"})
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
