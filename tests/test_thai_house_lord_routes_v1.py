# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest

from thai_dignities_v1 import build_dignity_research, build_house_lords_research
from thai_house_lord_routes_v1 import build_house_lord_routes_research
from thai_houses_v1 import build_whole_sign_houses_research


class ThaiPhase2E2HouseLordRouteTests(unittest.TestCase):
    def _fixture(self):
        positions = {
            "sun": {"sign_index": 4, "longitude_deg": 130.0},
            "moon": {"sign_index": 3, "longitude_deg": 100.0},
            "mars": {"sign_index": 9, "longitude_deg": 280.0},
            "mercury": {"sign_index": 5, "longitude_deg": 165.0},
            "jupiter": {"sign_index": 8, "longitude_deg": 250.0},
            "venus": {"sign_index": 6, "longitude_deg": 200.0},
            "saturn": {"sign_index": 10, "longitude_deg": 305.0},
            "rahu": {"sign_index": 10, "longitude_deg": 310.0},
        }
        houses = build_whole_sign_houses_research(
            lagna_longitude_deg=5.0,
            planet_positions=positions,
        )
        lords = build_house_lords_research(houses["houses"])
        dignities = build_dignity_research(positions)
        return houses, lords, dignities

    def test_twelve_source_house_routes_are_preserved(self):
        houses, lords, dignities = self._fixture()
        result = build_house_lord_routes_research(
            houses_research=houses,
            house_lords_research=lords,
            dignities_research=dignities,
        )
        self.assertTrue(result["available"])
        self.assertEqual(len(result["routes"]), 12)
        self.assertEqual([r["source_house"]["house_number"] for r in result["routes"]], list(range(1, 13)))

    def test_aries_lagna_first_house_lord_mars_routes_to_tenth_house(self):
        houses, lords, dignities = self._fixture()
        result = build_house_lord_routes_research(
            houses_research=houses,
            house_lords_research=lords,
            dignities_research=dignities,
        )
        route = result["routes"][0]
        self.assertEqual(route["source_house"]["house_number"], 1)
        self.assertEqual(route["lord_planet"]["key"], "mars")
        self.assertEqual(route["destination_house"]["house_number"], 10)
        self.assertEqual(route["route_key"], "H1:mars->H10")

    def test_one_planet_ruling_multiple_houses_keeps_separate_source_routes(self):
        houses, lords, dignities = self._fixture()
        result = build_house_lord_routes_research(
            houses_research=houses,
            house_lords_research=lords,
            dignities_research=dignities,
        )
        mars_routes = [r for r in result["routes"] if r["lord_planet"]["key"] == "mars"]
        self.assertEqual([r["source_house"]["house_number"] for r in mars_routes], [1, 8])
        self.assertEqual({r["destination_house"]["house_number"] for r in mars_routes}, {10})

    def test_source_and_destination_domains_are_structural_not_predictions(self):
        houses, lords, dignities = self._fixture()
        result = build_house_lord_routes_research(
            houses_research=houses,
            house_lords_research=lords,
            dignities_research=dignities,
        )
        route = result["routes"][0]
        self.assertIn("self", route["source_house"]["domains"])
        self.assertIn("work", route["destination_house"]["domains"])
        self.assertEqual(route["source_house"]["reading_role"], "subject_domain_carried_by_house_lord")
        self.assertEqual(route["destination_house"]["reading_role"], "placement_context_or_modifier")
        self.assertIsNone(route["interpretation"])
        self.assertIsNone(route["combined_judgement"])
        self.assertIsNone(route["prediction"])
        self.assertIsNone(route["score"])

    def test_basic_and_advanced_statuses_attach_only_as_context_facts(self):
        houses, lords, dignities = self._fixture()
        result = build_house_lord_routes_research(
            houses_research=houses,
            house_lords_research=lords,
            dignities_research=dignities,
        )
        mars = result["routes"][0]
        self.assertIn("ucca", mars["lord_position_context"]["basic_status_keys"])
        self.assertIsNone(mars["lord_position_context"]["status_judgement"])

    def test_missing_house_or_lord_research_does_not_fabricate_routes(self):
        missing_houses = build_house_lord_routes_research(
            houses_research={"available": False},
            house_lords_research={"available": True},
        )
        self.assertFalse(missing_houses["available"])
        self.assertEqual(missing_houses["routes"], [])
        missing_lords = build_house_lord_routes_research(
            houses_research={"available": True},
            house_lords_research={"available": False},
        )
        self.assertFalse(missing_lords["available"])
        self.assertEqual(missing_lords["routes"], [])

    def test_promotion_gate_keeps_synthesis_and_gemini_closed(self):
        houses, lords, dignities = self._fixture()
        result = build_house_lord_routes_research(
            houses_research=houses,
            house_lords_research=lords,
            dignities_research=dignities,
        )
        gate = result["promotion_gate"]
        self.assertTrue(gate["route_structure_validated"])
        self.assertTrue(gate["source_and_destination_domains_validated"])
        self.assertTrue(gate["dignity_context_attached_as_facts"])
        self.assertFalse(gate["route_interpretation_allowed"])
        self.assertFalse(gate["dignity_net_valence_allowed"])
        self.assertFalse(gate["pair_or_aspect_synthesis_allowed"])
        self.assertFalse(gate["combined_judgement_allowed"])
        self.assertFalse(gate["event_judgement_allowed"])
        self.assertFalse(gate["scores_allowed"])
        self.assertFalse(gate["gemini_interpretation_allowed"])


if __name__ == "__main__":
    unittest.main()
