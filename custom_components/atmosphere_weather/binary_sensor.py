"""Weather conditions suitable for triggers."""
from homeassistant.components.binary_sensor import BinarySensorEntity

from .entity import LocationEntity


async def async_setup_entry(hass, entry, async_add_entities):
    for location_id, coordinator in entry.runtime_data.items():
        async_add_entities([
            AtmosphereFlag(coordinator, "daylight", "Daylight", "is_day", bool),
            AtmosphereFlag(coordinator, "freezing", "Freezing", "temperature_2m", lambda value: value <= 0),
            AtmosphereFlag(coordinator, "precipitation_expected", "Precipitation expected", "next_precipitation",
                           lambda value: value >= 50),
        ], config_subentry_id=location_id)


class AtmosphereFlag(LocationEntity, BinarySensorEntity):
    def __init__(self, coordinator, metric, name, field, test):
        super().__init__(coordinator, metric, field)
        self._attr_name = name
        self.test = test

    @property
    def is_on(self):
        return None if self.value is None else self.test(self.value)
