"""Regression tests for provider data and stable location identity."""
from datetime import UTC, datetime
from types import SimpleNamespace
import unittest

from custom_components.atmosphere_weather.config_flow import async_clean_location, location_key
from custom_components.atmosphere_weather.entity import identity
from custom_components.atmosphere_weather.provider import normalize


class WeatherTests(unittest.IsolatedAsyncioTestCase):
    def test_dst_and_missing_values(self):
        now = datetime(2026, 11, 1, 5, tzinfo=UTC).timestamp()
        data = normalize({
            "current": {"temperature_2m": 0, "weather_code": 0, "is_day": 0},
            "hourly": {"time": [now - 3600, now, now + 3600], "temperature_2m": [-2, 0, 1],
                       "precipitation_probability": [0, 75]},
            "daily": {"time": [now], "sunrise": [None], "weather_code": [999]},
        }, "America/Toronto", now)
        self.assertEqual(data["timezone"], "America/Toronto")
        self.assertEqual(data["current"]["temperature_2m"], 0)
        self.assertEqual(data["current"]["condition"], "clear-night")
        self.assertEqual(data["current"]["next_precipitation"], 75)
        self.assertIsNone(data["current"]["sunrise"])
        self.assertIsNone(data["daily"][0]["condition"])
        self.assertIsNone(data["hourly"][1]["precipitation_probability"])
        self.assertNotEqual(data["hourly"][0]["datetime"], data["hourly"][1]["datetime"])

    async def test_invalid_location(self):
        for latitude, timezone in [(float("nan"), "UTC"), (91, "UTC"), (0, "Wrong/Zone")]:
            with self.assertRaises(ValueError):
                await async_clean_location(dict(name="Test", latitude=latitude, longitude=0, timezone=timezone))

    def test_rename_keeps_identity(self):
        data = dict(name="First", latitude=35.7, longitude=139.7, timezone="Asia/Tokyo")
        self.assertEqual(location_key(data), location_key(dict(data, name="Renamed")))
        location = SimpleNamespace(subentry_id="stable-id", title="First")
        coordinator = SimpleNamespace(location=location)
        before, after = SimpleNamespace(), SimpleNamespace()
        identity(before, coordinator, "weather")
        location.title = "Renamed"
        identity(after, coordinator, "weather")
        self.assertEqual(before._attr_unique_id, after._attr_unique_id)
        self.assertEqual(before._attr_device_info["identifiers"], after._attr_device_info["identifiers"])
