import os
import sys
import tempfile

# Use a throwaway database for the whole test session (must be set before `auth` is imported)
os.environ["ATMOSFUSION_DB"] = os.path.join(tempfile.mkdtemp(prefix="atmosfusion-test-"), "test.db")
os.environ.setdefault("ATMOSFUSION_SECRET", "test-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
