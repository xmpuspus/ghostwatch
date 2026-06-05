"""Tests for the Esri Wayback release-index parser used at build time."""

from __future__ import annotations

from scripts.bake_wayback import parse_releases


def test_parses_and_sorts_oldest_first():
    cfg = {
        "10842": {"itemTitle": "World Imagery (Wayback 2026-05-28)"},
        "10": {"itemTitle": "World Imagery (Wayback 2014-02-20)"},
        "577": {"itemTitle": "World Imagery (Wayback 2017-01-11)"},
    }
    out = parse_releases(cfg)
    assert [r["date"] for r in out] == ["2014-02-20", "2017-01-11", "2026-05-28"]
    assert out[0] == {"rnum": "10", "date": "2014-02-20"}


def test_rnum_is_stringified():
    out = parse_releases({100: {"itemTitle": "World Imagery (Wayback 2020-06-01)"}})
    assert out == [{"rnum": "100", "date": "2020-06-01"}]


def test_skips_entries_without_a_date():
    cfg = {
        "1": {"itemTitle": "World Imagery (no date here)"},
        "2": {"itemTitle": "World Imagery (Wayback 2019-03-15)"},
        "3": {},
    }
    out = parse_releases(cfg)
    assert out == [{"rnum": "2", "date": "2019-03-15"}]


def test_empty_config_yields_no_releases():
    assert parse_releases({}) == []
