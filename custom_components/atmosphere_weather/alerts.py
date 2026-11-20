"""Location-specific official weather alerts."""
import asyncio
from datetime import UTC, datetime
import re
import time

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession

CANADA = "https://api.weather.gc.ca/collections/weather-alerts/items"
USA = "https://api.weather.gov/alerts/active"
RANK = {"warning": 0, "watch": 1, "advisory": 2}
USER_AGENT = "Atmosphere Weather (https://github.com/yanke7/Home-Assistant-weather)"


def expiry(value):
    try:
        date = datetime.fromisoformat(value)
        return date if date.tzinfo else None
    except (TypeError, ValueError):
        return None


def normalize_alerts(features, source, now):
    """Keep active warnings, watches, and advisories, including upcoming hazards."""
    alerts = {}
    for feature in features:
        item = feature.get("properties") or {}
        if source == "ECCC":
            kind = item.get("alert_type")
            if item.get("status_en", "").lower() not in {"issued", "continued", "updated", "extended"}:
                continue
            name = item.get("alert_short_name_en") or item.get("alert_name_en")
            area = item.get("feature_name_en")
            description = item.get("alert_text_en")
            end = expiry(item.get("expiration_datetime"))
            issued = expiry(item.get("publication_datetime"))
        else:
            if item.get("status") != "Actual" or item.get("messageType") == "Cancel":
                continue
            name = item.get("event")
            match = re.search(r"\b(warning|watch|advisory)\b", name or "", re.I)
            kind = match[0].lower() if match else None
            area = item.get("areaDesc")
            description = item.get("description")
            instruction = item.get("instruction")
            if instruction:
                description = "\n\n".join(filter(None,(description,instruction)))
            end = expiry(item.get("expires"))
            issued = expiry(item.get("sent"))
        if kind not in RANK or not name or not end or end <= now or (issued and issued > now):
            continue
        key = (kind, name.lower(), description)
        alerts.setdefault(key, {
            "kind":kind, "title":name, "area":area or "", "description":description or "",
            "expires":end.isoformat(), "source":source,
        })
    return sorted(alerts.values(),key=lambda item: (RANK[item["kind"]],item["title"]))


class Alerts:
    """Cache one request per relevant agency per saved location."""

    def __init__(self, hass, location):
        self.hass = hass
        self.latitude = round(location["latitude"], 4)
        self.longitude = round(location["longitude"], 4)
        self.cache = {}
        self.lock = asyncio.Lock()

    async def fetch(self, source, url, params):
        async with async_get_clientsession(self.hass).get(
            url, params=params, headers={"User-Agent":USER_AGENT,"Accept":"application/geo+json"},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            response.raise_for_status()
            return normalize_alerts((await response.json())["features"], source, datetime.now(UTC))

    async def get(self):
        lat, lon = self.latitude, self.longitude
        queries = {}
        # Broad geographic gates limit requests. The agencies match the exact point.
        if 41 <= lat <= 84 and -142 <= lon <= -50:
            queries["ECCC"] = (CANADA, {
                "f":"json", "skipGeometry":"true", "limit":100,
                "filter":f"INTERSECTS(geometry, POINT({lon} {lat}))",
            })
        if ((18 <= lat <= 72 and -180 <= lon <= -60)
                or (50 <= lat <= 55 and 170 <= lon <= 180)
                or (13 <= lat <= 21 and 144 <= lon <= 147)
                or (-15 <= lat <= -10 and -172 <= lon <= -168)):
            queries["NWS"] = (USA, {"point":f"{lat},{lon}"})
        async with self.lock:
            due = [source for source in queries if time.monotonic() >= self.cache.get(source,(0,[]))[0]]
            results = await asyncio.gather(*(self.fetch(source,*queries[source]) for source in due),return_exceptions=True)
            for source, result in zip(due,results):
                retry, previous = self.cache.get(source,(0,[]))
                if isinstance(result,Exception):
                    self.cache[source] = time.monotonic()+60, previous
                else:
                    self.cache[source] = time.monotonic()+120, result
            now = datetime.now(UTC)
            return sorted(
                (item for _,items in self.cache.values() for item in items if expiry(item["expires"]) > now),
                key=lambda item: RANK[item["kind"]],
            )
