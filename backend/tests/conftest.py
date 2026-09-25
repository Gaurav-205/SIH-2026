import os
import sys
import tempfile

# Throwaway database and exports folder for the whole session (must be set before importing the app)
_tmp = tempfile.mkdtemp(prefix="atmosfusion-test-")
os.environ["ATMOSFUSION_DB"] = os.path.join(_tmp, "test.db")
os.environ["ATMOSFUSION_EXPORTS"] = os.path.join(_tmp, "exports")
os.environ.setdefault("ATMOSFUSION_SECRET", "test-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
