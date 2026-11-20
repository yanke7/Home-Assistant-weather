"""Open-Meteo request and normalization."""
from datetime import UTC, datetime
import math
from zoneinfo import ZoneInfo

CURRENT = ("temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,"
           "wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,weather_code,is_day,cloud_cover")
HOURLY = "temperature_2m,weather_code,is_day,precipitation_probability,precipitation,wind_speed_10m,visibility,uv_index"
DAILY = "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,precipitation_sum,sunrise,sunset"
CONDITIONS = {
    0: "sunny", 1: "partlycloudy", 2: "partlycloudy", 3: "cloudy",
    45: "fog", 48: "fog", 51: "rainy", 53: "rainy", 55: "rainy",
    56: "snowy-rainy", 57: "snowy-rainy", 61: "rainy", 63: "rainy",
    65: "pouring", 66: "snowy-rainy", 67: "snowy-rainy", 71: "snowy",
    73: "snowy", 75: "snowy", 77: "snowy", 80: "rainy", 81: "rainy",
    82: "pouring", 85: "snowy", 86: "snowy", 95: "lightning-rainy",
    96: "lightning-rainy", 99: "lightning-rainy",
}


def number(value):
    return value if type(value) in (int, float) and math.isfinite(value) else None


def timestamp(value):
    return datetime.fromtimestamp(value, UTC).isoformat() if number(value) is not None else None


def condition(code, day=None):
    return "clear-night" if code == 0 and day == 0 else CONDITIONS.get(code)


def rows(block):
    for index, instant in enumerate(block.get("time") or []):
        if number(instant) is not None:
            yield {key: values[index] for key, values in block.items()
                   if isinstance(values, list) and index < len(values)}


def normalize(payload, zone, now):
    current = payload["current"]
    if not isinstance(current, dict) or number(current.get("temperature_2m")) is None:
        raise ValueError("Missing current temperature")
    hourly = [row for row in rows(payload.get("hourly") or {}) if row["time"] >= now]
    daily = list(rows(payload.get("daily") or {}))
    result = {key: number(current.get(key)) for key in CURRENT.split(",")}
    result.update(
        condition=condition(result["weather_code"], result["is_day"]),
        observed_at=timestamp(current.get("time")),
        updated_at=timestamp(now),
        interval=number(current.get("interval")),
        temperature_high=number(daily[0].get("temperature_2m_max")) if daily else None,
        temperature_low=number(daily[0].get("temperature_2m_min")) if daily else None,
    )
    solar_events = [row[key] for row in daily for key in ("sunrise", "sunset")
                    if number(row.get(key)) is not None]
    result["sky_period"] = ("golden" if result["is_day"] else "twilight") if any(
        abs(instant - now) <= 2100 for instant in solar_events
    ) else ("night" if result["is_day"] == 0 else "day")
    for key in ("sunrise", "sunset"):
        result[key] = next((timestamp(row[key]) for row in daily
                            if number(row.get(key)) is not None and row[key] > now), None)
    next_hour = hourly[0] if hourly else {}
    result["next_precipitation"] = number(next_hour.get("precipitation_probability"))
    result["uv_index"] = number(next_hour.get("uv_index"))
    result["visibility"] = number(next_hour.get("visibility"))
    return {
        "current": result,
        "hourly": [forecast(row, False) for row in hourly[:48]],
        "daily": [forecast(row, True) for row in daily[:7]],
        "timezone": ZoneInfo(zone).key,
    }


def forecast(row, daily):
    return {
        "datetime": timestamp(row["time"]),
        "condition": condition(number(row.get("weather_code")), number(row.get("is_day"))),
        "native_temperature": number(row.get("temperature_2m_max" if daily else "temperature_2m")),
        "native_templow": number(row.get("temperature_2m_min")),
        "native_precipitation": number(row.get("precipitation_sum" if daily else "precipitation")),
        "precipitation_probability": number(row.get("precipitation_probability_max" if daily else "precipitation_probability")),
        "native_wind_speed": number(row.get("wind_speed_10m")),
    }
