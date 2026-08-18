"""Pin the revoked-contractor and flood-district layers to the frontend contract.

Both pages name real firms and real places, so a drifting field or a total that
stops matching its own records is worse here than anywhere else on the site.
These tests pin the baked shape to web/src/types/accountability.ts and re-derive
every headline from the records under it.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "public" / "data"
TYPES = ROOT / "web" / "src" / "types" / "accountability.ts"
sys.path.insert(0, str(ROOT / "scripts"))

pytestmark = pytest.mark.skipif(
    not (DATA / "contractors.json").exists(), reason="accountability layers not baked"
)


def ts_fields(interface: str) -> set[str]:
    """Field names declared on one interface in accountability.ts."""
    body = TYPES.read_text().split(f"export interface {interface} {{")[1].split("}")[0]
    return {
        line.split(":")[0].strip().rstrip("?")
        for line in body.splitlines()
        if ":" in line and not line.strip().startswith("//")
    }


def contractors() -> dict:
    return json.loads((DATA / "contractors.json").read_text())


def floods() -> dict:
    return json.loads((DATA / "flood_districts.json").read_text())


def test_firm_shape_matches_frontend_type():
    firms = contractors()["data"]["firms"]
    assert firms, "no revoked firms baked"
    assert set(firms[0]) == ts_fields("RevokedFirm")


def test_firm_project_shape_matches_frontend_type():
    for f in contractors()["data"]["firms"]:
        for p in f["projects"]:
            assert set(p) == ts_fields("RevokedFirmProject")
            return


def test_flood_district_shape_matches_frontend_type():
    districts = floods()["data"]["districts"]
    assert districts, "no flood districts baked"
    assert set(districts[0]) == ts_fields("FloodDistrict")


def test_flood_site_shape_matches_frontend_type():
    for d in floods()["data"]["districts"]:
        for s in d["sites"]:
            assert set(s) == ts_fields("FloodSite")
            return


def test_every_revoked_firm_carries_a_pcab_number():
    for f in contractors()["data"]["firms"]:
        assert re.fullmatch(r"\d+", f["pcab_id"]), f"{f['name']} has no PCAB registration number"


def test_contractor_totals_count_each_contract_once():
    """A joint venture belongs on both partners' cards and must count once in a
    total. Summing the cards claimed 4,272 contracts against 4,253 real ones, and
    reported more flood-control sites checked than exist."""
    data = contractors()["data"]
    firms, totals = data["firms"], data["totals"]
    assert totals["firms"] == len(firms)
    assert totals["assessed"] <= sum(f["assessed"] for f in firms)
    assert totals["not_visible"] <= sum(f["tiers"].get("NOT_VISIBLE", 0) for f in firms)
    assert totals["verified"] <= sum(f["tiers"].get("VERIFIED", 0) for f in firms)
    assert totals["contracts"] <= sum(f["contracts"] for f in firms)
    assert totals["value"] <= sum(f["value"] for f in firms) + 1


def test_assessed_never_exceeds_the_contracts_it_is_drawn_from():
    """The page reads 'N of them carry a satellite read'. N above the population
    is an impossible sentence, and it shipped once."""
    totals = contractors()["data"]["totals"]
    assert totals["assessed"] <= totals["flood_control_contracts"]


def test_assessed_excludes_unverified():
    """UNVERIFIED means the imagery could not be read. Counting it as checked
    overstated the assessed set by 52 percent."""
    for f in contractors()["data"]["firms"]:
        real = sum(v for k, v in f["tiers"].items() if k != "UNVERIFIED")
        assert f["assessed"] == real


def test_the_page_can_state_the_baseline_comparison():
    """Without it a reader takes the red count as evidence against nine named
    firms, and the measurement does not support that."""
    base = contractors()["data"]["totals"]["baseline"]
    for key in (
        "firm_not_visible_rate",
        "site_not_visible_rate",
        "firm_verified_rate",
        "site_verified_rate",
    ):
        assert isinstance(base[key], (int, float))
        assert 0 <= base[key] <= 1


def test_firm_tier_counts_match_the_project_list_they_price():
    """The card prints a count from `tiers` and a peso figure summed from
    `projects`. A NOT_VISIBLE project with no coordinates never reaches
    highlights.json, so it would count in one and not the other."""
    for f in contractors()["data"]["firms"]:
        listed = sum(1 for p in f["projects"] if p["verification_status"] == "NOT_VISIBLE")
        assert f["tiers"].get("NOT_VISIBLE", 0) == listed, f"{f['pcab_id']} count/list drift"


def test_firm_projects_are_completed_only():
    """The card is headed "Completed flood-control sites". An ongoing project
    reading construction_detected would otherwise land under that heading."""
    feats = json.loads((DATA / "highlights.json").read_text())["data"]["features"]
    status = {f["properties"]["id"]: f["properties"]["status"] for f in feats}
    for f in contractors()["data"]["firms"]:
        for p in f["projects"]:
            assert status.get(p["id"]) == "COMPLETED", f"{p['id']} reads {status.get(p['id'])}"


def test_firm_project_lists_hold_only_highlight_tiers():
    """A firm card links each project to /map?id=, and only highlight tiers are
    on that map. A context-tier project there would be a dead link."""
    for f in contractors()["data"]["firms"]:
        for p in f["projects"]:
            assert p["verification_status"] in {"NOT_VISIBLE", "VERIFIED", "PARTIAL"}


def test_flood_totals_derive_from_district_records():
    data = floods()["data"]
    districts, totals = data["districts"], data["totals"]
    assert totals["districts"] == len(districts)
    assert totals["not_visible"] == sum(d["not_visible"] for d in districts)
    assert totals["projects"] == sum(d["projects"] for d in districts)


def test_flood_site_lists_hold_only_not_visible():
    for d in floods()["data"]["districts"]:
        assert len(d["sites"]) == d["not_visible"]
        for s in d["sites"]:
            assert s["verification_status"] == "NOT_VISIBLE"


def test_both_layers_carry_their_own_disclaimer():
    """The map disclaimer does not travel to these pages, and both name people
    or places, so each file states its own limit."""
    for doc in (contractors(), floods()):
        assert doc["disclaimer"].strip()


def test_revoked_disclaimer_separates_the_firm_from_the_project():
    text = contractors()["disclaimer"].lower()
    assert "not a finding about any" in text
    assert "prompt to look" in text


def test_flood_disclaimer_refuses_the_did_it_work_reading():
    text = floods()["disclaimer"].lower()
    assert "not a claim that any project failed" in text


def test_flood_disclaimer_says_the_match_is_administrative():
    """The join is a district-name match, never a spatial one against the mapped
    water. The page must not let "in the flood area" stand for that."""
    text = floods()["disclaimer"].lower()
    assert "geographic" in text


def test_flood_districts_sit_in_the_regions_the_monsoon_covered():
    """Province names repeat across the country. Matching on the name alone put
    Cagayan de Oro City (Region X) and Isabela City (Region IX) on this page."""
    allowed = {"Region I", "Region II", "Region III", "Cordillera Administrative Region"}
    for d in floods()["data"]["districts"]:
        assert d["region"] in allowed, f"{d['district']} sits in {d['region']}"
        assert "de Oro" not in d["district"]


def test_every_flood_district_names_a_province_a_source_covers():
    """PhilSA mapped Regions 1 and 2 plus Abra and Zambales; PAGASA named
    Benguet. Kalinga, Apayao and Mountain Province were on the page with no
    source putting the water there."""
    sourced = {
        "Ilocos Norte",
        "Ilocos Sur",
        "La Union",
        "Pangasinan",
        "Abra",
        "Benguet",
        "Zambales",
        "Cagayan",
        "Isabela",
        "Nueva Vizcaya",
        "Quirino",
    }
    for d in floods()["data"]["districts"]:
        assert any(p.lower() in d["district"].lower() for p in sourced), (
            f"{d['district']} names no province a cited source covers"
        )


def test_flood_sites_are_completed_only():
    """The page says "completed flood-control site". Counting every status put
    990 ongoing and 12 terminated or not-started sites behind that noun."""
    doc = floods()["data"]
    ids = {s["id"] for d in doc["districts"] for s in d["sites"]}
    feats = json.loads((DATA / "highlights.json").read_text())["data"]["features"]
    status = {f["properties"]["id"]: f["properties"]["status"] for f in feats}
    for pid in ids:
        assert status.get(pid) == "COMPLETED", f"{pid} reads {status.get(pid)}"


def test_flood_totals_cover_every_aggregate_the_page_prints():
    doc = floods()["data"]
    districts, totals = doc["districts"], doc["totals"]
    for key in ("not_visible", "verified", "partial", "projects"):
        assert totals[key] == sum(d[key] for d in districts), key
    assert abs(totals["not_visible_value"] - sum(d["not_visible_value"] for d in districts)) < 1


def test_a_case_never_claims_a_disagreement_with_an_unassessed_map_tier():
    """A bridge sits in the context tier, so the map never measured it. The card
    said two passes landed one tier apart for all eight of them."""
    cases = json.loads((DATA / "cases.json").read_text())["data"]
    for c in cases:
        if c.get("map_tier") == "UNVERIFIED":
            assert c.get("is_limit_case"), f"{c['project_id']} is unassessed but not a limit case"


def test_flood_event_cites_a_source_url():
    event = floods()["data"]["event"]
    assert event["source_url"].startswith("https://")
    assert event["start"] and event["end"]


def test_case_gallery_leads_with_flood_control_not_bridges():
    """The gallery is the page the home hero sends people to. It shipped 38
    bridges and 36 inconclusive reads on a site about flood control, because
    nobody rebaked it after the pivot."""
    cases = json.loads((DATA / "cases.json").read_text())["data"]
    assert len(cases) >= 40
    limit_cases = [c for c in cases if c.get("is_limit_case")]
    assert len(limit_cases) <= len(cases) // 4, "bridges must stay the minority"
    flood = [c for c in cases if not c.get("is_limit_case")]
    assert len(flood) >= 30


def test_case_gallery_shows_the_method_working():
    """A gallery where nothing reads as a clear signal argues against the
    product it demonstrates."""
    cases = json.loads((DATA / "cases.json").read_text())["data"]
    clear = [c for c in cases if c["classification"] in {"VERIFIED", "PARTIAL", "NOT_VISIBLE"}]
    assert len(clear) >= len(cases) // 2, "over half the gallery reads inconclusive"


def test_manifest_separates_source_date_from_bake_date():
    """The footer prints both. One date standing in for the other told readers
    the DPWH record was five months fresher than it is."""
    manifest = json.loads((DATA / "manifest.json").read_text())
    assert manifest["source_date"] < manifest["built_at"][:10]
    assert manifest["source_revision"]
