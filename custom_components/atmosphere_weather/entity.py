"""Shared location identity."""
from datetime import UTC, datetime

from .fishing import fishing_readings

from homeassistant.core import callback
from homeassistant.helpers.event import async_track_utc_time_change
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .coordinator import DOMAIN


def identity(entity, coordinator, metric):
    location = coordinator.location
    entity._attr_unique_id = f"{location.subentry_id}_{metric}"
    entity._attr_device_info = DeviceInfo(
        identifiers={(DOMAIN, location.subentry_id)}, name=location.title,
        entry_type=DeviceEntryType.SERVICE, manufacturer="Atmosphere Weather",
    )


class LocationEntity(CoordinatorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator, metric, field):
        super().__init__(coordinator)
        identity(self, coordinator, metric)
        self.field = field

    @property
    def value(self):
        return (self.coordinator.data or {}).get("current", {}).get(self.field)


class FishingEntity(LocationEntity):
    def __init__(self, coordinator, species, field, label):
        super().__init__(coordinator, f"fishing_{species}_{field}", field)
        self.species = species
        self._attr_name = f"{species.replace('_', ' ').title()} {label}"

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(async_track_utc_time_change(
            self.hass, self._refresh_clock, minute=(0, 15, 30, 45), second=0,
        ))

    @callback
    def _refresh_clock(self, _now):
        self.async_write_ha_state()

    @property
    def available(self):
        return super().available and self.value is not None

    @property
    def value(self):
        days = (self.coordinator.data or {}).get("fishing", {}).get(self.species, [])
        return fishing_readings(days, datetime.now(UTC).timestamp())[self.field]
