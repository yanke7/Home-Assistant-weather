"""Authenticated frontend and admin-only location management."""
from types import MappingProxyType
import re
import time
from urllib.parse import urlsplit

import aiohttp
import voluptuous as vol
from homeassistant.components import websocket_api as ws
from homeassistant.config_entries import ConfigSubentry
from homeassistant.helpers import entity_registry
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .config_flow import LIMIT, clean_location, home, location_key
from .coordinator import DOMAIN
from .fishing import FISH_PROFILES, WATER_TYPES

PREFIX = DOMAIN + "/"
LOCATION = {
    vol.Required("name"): str,
    vol.Required("latitude"): vol.Coerce(float),
    vol.Required("longitude"): vol.Coerce(float),
    vol.Required("timezone"): str,
}


def loaded(hass):
    return next(iter(hass.config_entries.async_loaded_entries(DOMAIN)), None)


def location_entity(hass, connection, location_id):
    entity_id = entity_registry.async_get(hass).async_get_entity_id("weather", DOMAIN, f"{location_id}_weather")
    if entity_id and connection.user.permissions.check_entity(entity_id, "read"):
        return entity_id
    return None


def home_location_id(hass, entry):
    locations = entry.subentries.values()
    named = next((item for item in locations if item.title.casefold() == "home"), None)
    if named:
        return named.subentry_id
    key = location_key(home(hass))
    return next((item.subentry_id for item in locations if item.unique_id == key), None)


def location_controls(hass, msg, is_home):
    camera = msg.get("camera_entity", "").strip()
    url = msg.get("camera_url", "").strip()
    thermostat = msg.get("thermostat_entity", "").strip() if is_home else ""
    if camera and url:
        raise ValueError("Choose a Home Assistant camera or a direct camera URL.")
    for entity, domain in ((camera, "camera"), (thermostat, "climate")):
        if entity and (not entity.startswith(domain + ".") or hass.states.get(entity) is None):
            raise ValueError(f"Choose an existing {domain} entity.")
    if url:
        parsed = urlsplit(url)
        if (len(url) > 2048 or parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username is not None or parsed.password is not None):
            raise ValueError("Enter a direct HTTP or HTTPS camera URL without embedded credentials.")
    return {key: value for key, value in {
        "camera_entity": camera, "camera_url": url,
        "camera_video": bool(msg.get("camera_video")) if url else False,
        "thermostat_entity": thermostat,
    }.items() if value}


@ws.websocket_command({vol.Required("type"): PREFIX + "snapshot", vol.Optional("location"): str})
@ws.async_response
async def snapshot(hass, connection, msg):
    entry = loaded(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_loaded", "Set up Atmosphere Weather in Devices & services.")
        return
    locations = []
    allowed = {}
    home_id = home_location_id(hass, entry)
    for location in entry.subentries.values():
        entity = location_entity(hass, connection, location.subentry_id)
        if entity or connection.user.is_admin:
            item = {"id": location.subentry_id, **location.data, "entity": entity}
            item["is_home"] = location.subentry_id == home_id
            for field in ("camera_entity", "thermostat_entity"):
                if item.get(field) and not connection.user.permissions.check_entity(item[field], "read"):
                    item.pop(field)
            if not item["is_home"]:
                item.pop("thermostat_entity", None)
            locations.append(item)
            allowed[item["id"]] = item
    selected = allowed.get(msg.get("location")) or next(iter(locations), None)
    coordinator = entry.runtime_data.get(selected["id"]) if selected else None
    connection.send_result(msg["id"], {
        "locations": locations, "selected": selected,
        "weather": coordinator.data if coordinator else None,
        "fresh": bool(coordinator and coordinator.last_update_success and coordinator.data),
        "fishing_enabled": entry.options.get("fishing_enabled", False),
        "fish_species": list(FISH_PROFILES),
        "radar": entry.options.get("radar", True) and not entry.options.get("api_key"),
    })


@ws.websocket_command({
    vol.Required("type"): PREFIX + "save_location", vol.Optional("location"): str, **LOCATION,
    vol.Optional("camera_entity"): str, vol.Optional("camera_url"): str,
    vol.Optional("camera_video"): bool, vol.Optional("thermostat_entity"): str,
})
@ws.require_admin
@ws.async_response
async def save_location(hass, connection, msg):
    entry = loaded(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_loaded", "Atmosphere Weather is loading.")
        return
    try:
        data = clean_location(msg)
        key = location_key(data)
        existing = entry.subentries.get(msg.get("location"))
        if msg.get("location") and existing is None:
            raise ValueError("This location was removed.")
        if any(item.unique_id == key and item != existing for item in entry.subentries.values()):
            raise ValueError("This location is already saved.")
        is_home = bool(existing and existing.subentry_id == home_location_id(hass, entry))
        controls = {field: existing.data[field] for field in (
            "camera_entity", "camera_url", "camera_video", "thermostat_entity",
        ) if existing and field in existing.data}
        controls.update({field: msg[field] for field in {
            "camera_entity", "camera_url", "camera_video", "thermostat_entity",
        } if field in msg})
        data.update(location_controls(hass, controls, is_home))
        if existing:
            data.update({key: value for key, value in existing.data.items() if key.startswith("fishing_")})
        if existing is None:
            if len(entry.subentries) >= LIMIT:
                raise ValueError(f"Save up to {LIMIT} locations.")
            existing = ConfigSubentry(data=MappingProxyType(data), title=data["name"],
                                      subentry_type="location", unique_id=key)
            hass.config_entries.async_add_subentry(entry, existing)
        else:
            hass.config_entries.async_update_subentry(entry, existing, data=data, title=data["name"], unique_id=key)
    except ValueError as error:
        connection.send_error(msg["id"], "invalid_location", str(error))
        return
    connection.send_result(msg["id"], {"location": existing.subentry_id})


@ws.websocket_command({vol.Required("type"): PREFIX + "remove_location", vol.Required("location"): str})
@ws.require_admin
@ws.async_response
async def remove_location(hass, connection, msg):
    entry = loaded(hass)
    if entry is None or msg["location"] not in entry.subentries:
        connection.send_error(msg["id"], "not_found", "Location no longer exists.")
        return
    hass.config_entries.async_remove_subentry(entry, msg["location"])
    connection.send_result(msg["id"])


async def get_json(hass, url, params=None):
    async with async_get_clientsession(hass).get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        resp.raise_for_status()
        return await resp.json()


@ws.websocket_command({vol.Required("type"): PREFIX + "search", vol.Required("query"): str})
@ws.require_admin
@ws.async_response
async def search(hass, connection, msg):
    query = msg["query"].strip()
    if not 2 <= len(query) <= 100:
        connection.send_error(msg["id"], "invalid_query", "Enter 2 to 100 characters.")
        return
    try:
        data = await get_json(hass, "https://geocoding-api.open-meteo.com/v1/search",
                              {"name": query, "count": 8, "language": "en", "format": "json"})
        results = [
            dict(name=", ".join(dict.fromkeys(part for part in (row.get("name"), row.get("admin1"), row.get("country")) if part))[:80],
                 latitude=row["latitude"], longitude=row["longitude"], timezone=row["timezone"])
            for row in data.get("results", []) if row.get("timezone")
        ]
    except (aiohttp.ClientError, TimeoutError, ValueError, KeyError):
        connection.send_error(msg["id"], "unavailable", "Location search is temporarily unavailable.")
        return
    connection.send_result(msg["id"], results)


@ws.websocket_command({vol.Required("type"): PREFIX + "radar", vol.Required("location"): str})
@ws.async_response
async def radar(hass, connection, msg):
    entry = loaded(hass)
    if (entry is None or not entry.options.get("radar", True) or entry.options.get("api_key")
            or msg["location"] not in entry.subentries
            or not (connection.user.is_admin or location_entity(hass, connection, msg["location"]))):
        connection.send_error(msg["id"], "unavailable", "Radar is unavailable or disabled.")
        return
    now = time.monotonic()
    last, frames = hass.data.get(PREFIX + "radar_cache", (-1000, []))
    if now - last >= 300:
        hass.data[PREFIX + "radar_cache"] = now, frames
        try:
            data = await get_json(hass, "https://api.rainviewer.com/public/weather-maps.json")
            frames = [item for item in data["radar"]["past"][-6:]
                      if isinstance(item.get("time"), int) and isinstance(item.get("path"), str)
                      and re.fullmatch(r"/v2/radar/[A-Za-z0-9_/-]+", item["path"])]
        except (aiohttp.ClientError, TimeoutError, ValueError, KeyError):
            frames = []
        hass.data[PREFIX + "radar_cache"] = now, frames
    connection.send_result(msg["id"], [frame for frame in frames if time.time() - frame["time"] <= 7200])


@ws.websocket_command({vol.Required("type"): PREFIX + "alerts", vol.Required("location"): str})
@ws.async_response
async def alerts(hass, connection, msg):
    entry = loaded(hass)
    identifier = msg["location"]
    if not entry or identifier not in entry.subentries or not (
        connection.user.is_admin or location_entity(hass, connection, identifier)
    ):
        connection.send_error(msg["id"], "unavailable", "Weather alerts are unavailable.")
        return
    coordinator = entry.runtime_data.get(identifier)
    connection.send_result(msg["id"], await coordinator.alerts.get() if coordinator else [])



@ws.websocket_command({
    vol.Required("type"): PREFIX + "save_fishing", vol.Required("enabled"): bool,
    vol.Optional("location"): str, vol.Optional("water"): vol.In(WATER_TYPES),
    vol.Optional("species"): [vol.In(FISH_PROFILES)],
})
@ws.require_admin
@ws.async_response
async def save_fishing(hass, connection, msg):
    entry = loaded(hass)
    if not entry:
        connection.send_error(msg["id"], "not_loaded", "Atmosphere Weather is loading.")
        return
    if "location" in msg:
        location = entry.subentries.get(msg["location"])
        species = list(dict.fromkeys(msg.get("species", [])))
        if not location or len(species) > 4 or (msg["enabled"] and not species):
            connection.send_error(msg["id"], "invalid_fishing", "Select one to four species for this location.")
            return
        removed = set(location.data.get("fishing_species", [])) - set(species)
        registry = entity_registry.async_get(hass)
        for fish in removed:
            for field in ("current", "daily", "start", "end", "active"):
                domain = "binary_sensor" if field == "active" else "sensor"
                entity = registry.async_get_entity_id(domain, DOMAIN, f"{location.subentry_id}_fishing_{fish}_{field}")
                if entity:
                    registry.async_remove(entity)
        hass.config_entries.async_update_subentry(entry, location, data={
            **location.data, "fishing_enabled": msg["enabled"],
            "fishing_water": msg.get("water", "lake"), "fishing_species": species,
        })
    else:
        hass.config_entries.async_update_entry(entry, options={**entry.options, "fishing_enabled": msg["enabled"]})
    connection.send_result(msg["id"])


def register(hass):
    for command in (snapshot, save_location, remove_location, search, radar, alerts, save_fishing):
        ws.async_register_command(hass, command)
