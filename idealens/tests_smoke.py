"""Run all tests:  python tests_smoke.py     (first time: python -m pip install pytest)"""
import sys
try:
    import pytest
except ImportError:
    print("pytest is missing. Install it with:  python -m pip install pytest")
    sys.exit(1)
code = pytest.main(["-q", "tests"])
print("ALL TESTS PASSED" if code == 0 else "SOME TESTS FAILED")
sys.exit(code)
