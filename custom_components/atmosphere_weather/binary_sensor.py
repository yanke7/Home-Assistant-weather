"""Weather conditions suitable for triggers."""
from homeassistant.components.binary_sensor import BinarySensorEntity

from .entity import FishingEntity, LocationEntity


async def async_setup_entry(hass, entry, async_add_entities):
    for location_id, coordinator in entry.runtime_data.items():
        async_add_entities([
            AtmosphereFlag(coordinator, "daylight", "Daylight", "is_day", bool),
            AtmosphereFlag(coordinator, "freezing", "Freezing", "temperature_2m", lambda value: value <= 0),
            AtmosphereFlag(coordinator, "precipitation_expected", "Precipitation expected", "next_precipitation",
                           lambda value: value >= 50),
        ] + [FishingWindow(coordinator, species, "active", "Fishing window active")
             for species in coordinator.location.data.get("fishing_species", [])
        ], config_subentry_id=location_id)


class AtmosphereFlag(LocationEntity, BinarySensorEntity):
    def __init__(self, coordinator, metric, name, field, test):
        super().__init__(coordinator, metric, field)
        self._attr_name = name
        self.test = test

    @property
    def is_on(self):
        return None if self.value is None else self.test(self.value)


class FishingWindow(FishingEntity, BinarySensorEntity):
    @property
    def is_on(self):
        return self.value
