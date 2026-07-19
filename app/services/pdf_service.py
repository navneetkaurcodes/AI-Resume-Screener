import os
import shutil
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings

UPLOAD_FOLDER = settings.upload_dir


def save_pdf(file: UploadFile):
    """
    Save uploaded PDF to the uploads folder.

    Returns:
        filename: Stored filename
        file_path: Full path of the saved file
    """

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    original_name = os.path.basename(file.filename or "resume.pdf")
    safe_name = "".join(c for c in original_name if c.isalnum() or c in ("-", "_", "."))
    safe_name = safe_name[-100:] or "resume.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    filename = f"{uuid4()}_{safe_name}"

    file_path = os.path.join(UPLOAD_FOLDER, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return filename, file_path