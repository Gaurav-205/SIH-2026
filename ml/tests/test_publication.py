import json
import math

import pytest

from ml.daily.publication import publish_json


def test_invalid_publication_keeps_last_good_document(tmp_path):
    target = tmp_path / "latest.json"
    publish_json(target, {"value": 12})
    with pytest.raises(ValueError):
        publish_json(target, {"value": math.nan})
    assert json.loads(target.read_text()) == {"value": 12}
    assert not list(tmp_path.glob("*.tmp"))


def test_successful_publication_replaces_complete_document(tmp_path):
    target = tmp_path / "latest.json"
    publish_json(target, {"value": 1})
    publish_json(target, {"value": 2})
    assert json.loads(target.read_text()) == {"value": 2}
