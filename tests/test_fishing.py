"""Fishing windows use contiguous hours and end-exclusive timestamps."""
from datetime import UTC, datetime
import unittest

from custom_components.atmosphere_weather.fishing import fishing_forecast, fishing_readings


class FishingTests(unittest.TestCase):
    def test_species_and_window_boundaries(self):
        start = datetime(2026, 6, 19, tzinfo=UTC).timestamp()
        payload = {
            "daily": {"time": [start], "sunrise": [start+3600], "sunset": [start+80000]},
            "hourly": {
                "time": [start+i*3600 for i in range(7)],
                "temperature_2m": [17]*7,
                "cloud_cover": [60]*7,
                "wind_speed_10m": [5]*7,
                "precipitation": [0, 0, 0, None, 0, 0, 0],
                "pressure_msl": [1010]*7,
            },
        }
        result = fishing_forecast(payload, {
            "latitude": 0, "longitude": 0, "timezone": "UTC",
            "fishing_water": "lake", "fishing_species": ["walleye", "pike"],
        })
        self.assertEqual(list(result), ["walleye", "pike"])
        days = result["walleye"]
        self.assertEqual([(w["start"]-start,w["end"]-start) for w in days[0]["windows"]],
                         [(0,10800),(14400,25200)])
        self.assertTrue(fishing_readings(days,start)["active"])
        self.assertFalse(fishing_readings(days,start+10800)["active"])
        self.assertIsNone(fishing_readings(days,start+25200)["start"])
        self.assertTrue(all(0 <= h["score"] <= 10 for h in days[0]["hours"]))
