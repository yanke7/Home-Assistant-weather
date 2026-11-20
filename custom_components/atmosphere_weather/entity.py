"""Shared location identity."""
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
