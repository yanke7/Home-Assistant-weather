"""Standalone Atmosphere Weather integration."""
import asyncio
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.helpers import config_validation as cv

from .coordinator import DOMAIN, WeatherCoordinator
from .websocket import register

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PLATFORMS = [Platform.WEATHER, Platform.SENSOR, Platform.BINARY_SENSOR]
CARD_PATH = "/atmosphere_weather/atmosphere-weather-card.js"
CARD_URL = f"{CARD_PATH}?v=0.1.7"


async def async_setup(hass, config):
    await hass.http.async_register_static_paths([
        StaticPathConfig(CARD_PATH, str(Path(__file__).parent / "www" / "atmosphere-weather-card.js"), False),
        StaticPathConfig("/atmosphere_weather/sky.js", str(Path(__file__).parent / "www" / "sky.js"), False),
        StaticPathConfig("/atmosphere_weather/trek-logo.jpg", str(Path(__file__).parent / "www" / "trek-logo.jpg"), False),
        StaticPathConfig("/atmosphere_weather/trek-oswald.woff2", str(Path(__file__).parent / "www" / "trek-oswald.woff2"), False),
    ])
    register(hass)
    frontend.add_extra_js_url(hass, CARD_URL)
    return True


async def async_setup_entry(hass, entry):
    entry.runtime_data = {
        location.subentry_id: WeatherCoordinator(hass, entry, location)
        for location in entry.subentries.values()
    }
    for coordinator in entry.runtime_data.values():
        entry.async_on_unload(coordinator.async_add_listener(lambda: None))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(reload_entry))
    for coordinator in entry.runtime_data.values():
        entry.async_create_background_task(hass, coordinator.async_refresh(), f"{DOMAIN} initial weather")
    return True


async def reload_entry(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    await asyncio.gather(*(coordinator.async_shutdown() for coordinator in entry.runtime_data.values()))
    return True
