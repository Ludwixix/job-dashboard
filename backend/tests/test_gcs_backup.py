from pathlib import Path

from job_dashboard import gcs_backup


class FakeBlob:
    def __init__(self, objects, name):
        self.objects = objects
        self.name = name
        self.generation = 1 if name in objects else 0

    def exists(self):
        return self.name in self.objects

    def reload(self):
        if self.name not in self.objects:
            raise Exception("NotFound")
        self.generation = 1

    def download_to_filename(self, filename):
        Path(filename).write_bytes(self.objects[self.name])

    def upload_from_filename(self, filename, if_generation_match=None):
        if if_generation_match is not None and if_generation_match != self.generation:
            raise Exception("PreconditionFailed")
        self.objects[self.name] = Path(filename).read_bytes()
        self.generation = (self.generation or 0) + 1


class FakeBucket:
    def __init__(self, objects):
        self.objects = objects

    def blob(self, name):
        return FakeBlob(self.objects, name)


class FakeClient:
    def __init__(self, objects):
        self.objects = objects

    def bucket(self, name):
        return FakeBucket(self.objects)


def test_gcs_backup_restores_health_database_even_when_jobs_db_exists(tmp_path, monkeypatch):
    objects = {"health.sqlite3": b"health-db", "jobs.sqlite3": b"jobs-db"}
    monkeypatch.setattr(gcs_backup, "_get_client", lambda: FakeClient(objects))
    (tmp_path / "jobs.sqlite3").write_bytes(b"baked-in-jobs")

    restored = gcs_backup.restore_from_gcs("bucket", tmp_path)

    assert restored == 1
    assert (tmp_path / "jobs.sqlite3").read_bytes() == b"baked-in-jobs"
    assert (tmp_path / "health.sqlite3").read_bytes() == b"health-db"


def test_gcs_backup_uploads_health_database(tmp_path, monkeypatch):
    objects = {}
    monkeypatch.setattr(gcs_backup, "_get_client", lambda: FakeClient(objects))
    (tmp_path / "health.sqlite3").write_bytes(b"health-db")

    uploaded = gcs_backup.backup_to_gcs("bucket", tmp_path)

    assert uploaded == 1
    assert objects["health.sqlite3"] == b"health-db"


def test_gcs_backup_force_restores_when_flag_set(tmp_path, monkeypatch):
    objects = {"health.sqlite3": b"health-db", "jobs.sqlite3": b"cloud-persistent-jobs"}
    monkeypatch.setattr(gcs_backup, "_get_client", lambda: FakeClient(objects))
    (tmp_path / "jobs.sqlite3").write_bytes(b"baked-in-stale-jobs")

    restored = gcs_backup.restore_from_gcs("bucket", tmp_path, force=True)

    assert restored == 2
    assert (tmp_path / "jobs.sqlite3").read_bytes() == b"cloud-persistent-jobs"
    assert (tmp_path / "health.sqlite3").read_bytes() == b"health-db"