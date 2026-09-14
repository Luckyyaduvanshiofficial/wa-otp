from datetime import datetime, timezone

from app.services.quota import month_window, pb_date, reset_utc_iso


def test_month_window_mid_month():
    now = datetime(2026, 9, 13, 15, 30, 45, tzinfo=timezone.utc)
    start, end = month_window(now)
    assert start == datetime(2026, 9, 1, tzinfo=timezone.utc)
    assert end == datetime(2026, 10, 1, tzinfo=timezone.utc)
    assert reset_utc_iso(now) == "2026-10-01T00:00:00Z"


def test_month_window_year_rollover():
    now = datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    start, end = month_window(now)
    assert start == datetime(2026, 12, 1, tzinfo=timezone.utc)
    assert end == datetime(2027, 1, 1, tzinfo=timezone.utc)


def test_month_window_january():
    now = datetime(2026, 1, 2, tzinfo=timezone.utc)
    _, end = month_window(now)
    assert end == datetime(2026, 2, 1, tzinfo=timezone.utc)


def test_pb_date_format_matches_pb_filters():
    now = datetime(2026, 9, 13, 15, 30, 45, tzinfo=timezone.utc)
    assert pb_date(now) == "2026-09-13 15:30:45"
