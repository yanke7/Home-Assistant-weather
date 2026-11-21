"""Fetch one location independently of open dashboards."""
from datetime import UTC, datetime, timedelta
import logging

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .alerts import Alerts
from .fishing import fishing_forecast
from .provider import CURRENT, DAILY, HOURLY, normalize

DOMAIN = "atmosphere_weather"
LOGGER = logging.getLogger(__name__)


class WeatherCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry, location):
        super().__init__(hass, LOGGER, config_entry=entry, name=location.title,
                         update_interval=timedelta(minutes=15))
        self.location = location
        self.alerts = Alerts(hass, location.data)
        self.options = entry.options
        self.failures = 0
        self.last_update_success = False

    async def _async_update_data(self):
        location = self.location.data
        key = self.options.get("api_key")
        host = "customer-api.open-meteo.com" if key else "api.open-meteo.com"
        params = {
            "latitude": location["latitude"], "longitude": location["longitude"],
            "timezone": location["timezone"], "timeformat": "unixtime",
            "current": CURRENT, "hourly": HOURLY, "daily": DAILY, "forecast_days": 7,
        }
        fishing = self.options.get("fishing_enabled") and location.get("fishing_enabled")
        if fishing:
            params["hourly"] += ",cloud_cover,pressure_msl"
        if key:
            params["apikey"] = key
        delay = 0
        try:
            async with async_get_clientsession(self.hass).get(
                f"https://{host}/v1/forecast", params=params,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as response:
                if response.status == 429:
                    header = response.headers.get("Retry-After", "")
                    delay = int(header) if header.isdigit() else 0
                response.raise_for_status()
                payload = await response.json()
            data = normalize(payload, location["timezone"], datetime.now(UTC).timestamp())
        except (aiohttp.ClientError, TimeoutError, ValueError, TypeError, KeyError):
            self.failures = min(self.failures + 1, 4)
            self.update_interval = timedelta(seconds=max(delay, min(3600, 300 * 2**self.failures)))
            raise UpdateFailed("Open-Meteo weather is temporarily unavailable") from None
        if fishing:
            data["fishing"] = fishing_forecast(payload, location)
        self.failures = 0
        self.update_interval = timedelta(minutes=15)
        return data
