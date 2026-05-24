# J's Journal

A personal journal, study tracker, and blog served with FastAPI and local static assets.

## Features
- Home page with creative daily life intro and journal highlights
- Study Progress page with categories for English, Biology, Chemistry, Physics, Mathematics, Information, Programming, and Others
- Text posts, image uploads, and downloadable file attachments
- Secure admin API protected by token header for content management
- Modern dark-mode UI with warm, soothing visual design

## Run locally
1. Install dependencies:
```bash
pip install -r requirements.txt
```
2. Start the server:
```bash
python "J's Journal.py"
```
3. Visit the public site:
- Home: `http://127.0.0.1:8000/static/index.html`
- Study: `http://127.0.0.1:8000/static/study.html`

## Admin API
- Set `JOURNAL_ADMIN_TOKEN` as an environment variable to override the default token.
- Pass the admin token with HTTP header `Authorization: Bearer <token>` or `X-Admin-Token: <token>`.

### Example create post request
`POST /api/admin/post`

### Example upload file request
`POST /api/admin/upload-file`

## Notes
- Static website assets live in `static/`
- Uploaded media is saved in `uploads/`
- Content data is persisted in `content_db.json`
