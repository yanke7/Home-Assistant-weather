"""Hourly fishing conditions derived from the location's weather forecast."""
from datetime import UTC, datetime
from statistics import mean

import ephem

from .fish_profiles import FISH_PROFILES
from .provider import number, rows, timestamp

WATER_TYPES = ("lake", "river", "pond", "reservoir")


def fishing_forecast(payload, location, zone):
    observer = ephem.Observer()
    observer.lat = str(location["latitude"])
    observer.lon = str(location["longitude"])
    moon = ephem.Moon()
    weights = dict(temp=.25, cloud=.1, pressure=.15, wind=.1, rain=.1, twilight=.15, moon=.15)
    weights.update({
        "lake": {}, "river": dict(pressure=.05, rain=.2, moon=.1),
        "pond": dict(temp=.3, rain=.2, pressure=.2), "reservoir": dict(pressure=.1),
    }[location["fishing_water"]])
    events = {}
    for row in rows(payload.get("daily", {})):
        date = datetime.fromtimestamp(row["time"], zone).date()
        lunar = []
        for event in (observer.next_rising, observer.next_setting,
                      observer.next_transit, observer.next_antitransit):
            observer.date = datetime.fromtimestamp(row["time"], UTC)
            try:
                lunar.append(event(moon).datetime().replace(tzinfo=UTC).timestamp())
            except (ephem.AlwaysUpError, ephem.NeverUpError):
                pass
        observer.date = datetime.fromtimestamp(row["time"] + 43200, UTC)
        moon.compute(observer)
        events[date] = ([row.get(key) for key in ("sunrise", "sunset")], lunar, moon.phase)
    by_day = {}
    previous = None
    for row in rows(payload.get("hourly", {})):
        instant = row["time"]
        date = datetime.fromtimestamp(instant, zone).date()
        temp, cloud, wind, rain, pressure = (
            number(row.get(key)) for key in ("temperature_2m", "cloud_cover", "wind_speed_10m", "precipitation", "pressure_msl")
        )
        trend = pressure - previous if pressure is not None and previous is not None else None
        previous = pressure
        if date not in events or None in (temp, cloud, wind, rain, pressure):
            continue
        solar, lunar, phase = events[date]
        def near(times):
            return any(number(event) is not None and abs(instant - event) <= 3600 for event in times)
        factors = dict(wind=max(0, 1-wind/45), rain=max(0, 1-rain/5),
                       moon=.4 + .25*abs(phase-50)/50 + .35*near(lunar))
        if any(number(event) is not None for event in solar):
            factors["twilight"] = 1 if near(solar) else .45
        by_day.setdefault(date, []).append((instant, temp, cloud, trend, factors))
    result = {}
    for species in location["fishing_species"]:
        profile = FISH_PROFILES[species]
        low, high = profile["temp_range"]
        days = []
        for date, readings in by_day.items():
            hours = []
            for instant, temp, cloud, trend, factors in readings:
                values = dict(factors, temp=max(0, 1-max(low-temp,temp-high,0)/15),
                              cloud=max(0, 1-abs(cloud-profile["ideal_cloud"])/100))
                if trend is not None:
                    preferred = -1 if profile["prefers_low_pressure"] else 1
                    values["pressure"] = min(1, max(0, .75 + preferred*trend/8))
                score = sum(weights[k]*v for k,v in values.items()) / sum(weights[k] for k in values)
                hours.append({
                    "time": instant, "score": max(0,min(10,round((score-.5)/.035,1))),
                    "factors": [key for key in sorted(values, key=lambda key: weights[key]*values[key], reverse=True)
                                if values[key] >= .75][:3],
                })
            windows = [
                {"start": a["time"], "end": c["time"]+3600, "score": mean(h["score"] for h in (a,b,c))}
                for a,b,c in zip(hours,hours[1:],hours[2:])
                if b["time"]-a["time"] == c["time"]-b["time"] == 3600
            ]
            days.append({"date": date.isoformat(), "score": round(mean(h["score"] for h in hours)),
                         "hours": hours, "windows": windows})
        result[species] = days
    return result


def fishing_readings(days, now):
    """Find the current hour and best remaining window on the earliest eligible day."""
    current = next((day for day in days if any(h["time"] <= now < h["time"]+3600 for h in day["hours"])), None)
    hour = next((h for h in current["hours"] if h["time"] <= now < h["time"]+3600), None) if current else None
    window = next((best for day in days if (best := max(
        (w for w in day["windows"] if w["end"] > now), key=lambda w:w["score"], default=None))), None)
    return {
        "current": round(hour["score"]) if hour else None,
        "daily": current["score"] if current else None,
        "start": timestamp(window["start"]) if window else None,
        "end": timestamp(window["end"]) if window else None,
        "active": window["start"] <= now if window else None,
    }
