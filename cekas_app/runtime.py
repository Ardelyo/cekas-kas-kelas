"""Satu titik inisialisasi: database + (opsional) replikasi Cloud Storage."""

import logging

from .config import DB_PATH, CLASS_ID, GCS_BUCKET, GCS_OBJECT
from .database import CekasDB
from .gcs_store import GCSStore, restore_on_boot

logger = logging.getLogger("cekas.runtime")

store = GCSStore(GCS_BUCKET, GCS_OBJECT) if GCS_BUCKET else None
restore_state = restore_on_boot(DB_PATH, store) if store else "disabled"

db = CekasDB(DB_PATH)
db.get_or_create_class(CLASS_ID)
db.seed_initial_students(CLASS_ID)

if store:
    store.attach(db)
    logger.info("Replikasi Cloud Storage aktif (restore: %s) -> gs://%s/%s", restore_state, GCS_BUCKET, GCS_OBJECT)


def shutdown():
    if store:
        store.stop()
