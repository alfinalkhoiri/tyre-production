import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    """Reset cache Django (termasuk counter DRF throttle) sebelum tiap test,
    supaya rate-limit login tidak bocor/menumpuk lintas test."""
    cache.clear()
    yield
