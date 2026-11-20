"""Readings and forecast metrics for automations."""
from datetime import datetime

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import DEGREE, PERCENTAGE, UnitOfPrecipitationDepth, UnitOfPressure, UnitOfSpeed, UnitOfTemperature

from .entity import LocationEntity

TEMPERATURE = SensorDeviceClass.TEMPERATURE, UnitOfTemperature.CELSIUS
WIND = SensorDeviceClass.WIND_SPEED, UnitOfSpeed.KILOMETERS_PER_HOUR
STAMP = SensorDeviceClass.TIMESTAMP, None
METRICS = (
    ("temperature_2m", "Temperature", *TEMPERATURE),
    ("apparent_temperature", "Feels like", *TEMPERATURE),
    ("relative_humidity_2m", "Humidity", SensorDeviceClass.HUMIDITY, PERCENTAGE),
    ("pressure_msl", "Pressure", SensorDeviceClass.ATMOSPHERIC_PRESSURE, UnitOfPressure.HPA),
    ("wind_speed_10m", "Wind speed", *WIND),
    ("wind_gusts_10m", "Wind gusts", *WIND),
    ("wind_direction_10m", "Wind direction", None, DEGREE),
    ("precipitation", "Current interval precipitation", SensorDeviceClass.PRECIPITATION, UnitOfPrecipitationDepth.MILLIMETERS),
    ("next_precipitation", "Next hour precipitation probability", None, PERCENTAGE),
    ("cloud_cover", "Cloud cover", None, PERCENTAGE),
    ("uv_index", "Next hour UV index", None, None),
    ("visibility", "Next hour visibility", SensorDeviceClass.DISTANCE, "m"),
    ("temperature_high", "Forecast high", *TEMPERATURE),
    ("temperature_low", "Forecast low", *TEMPERATURE),
    ("sunrise", "Next sunrise", *STAMP),
    ("sunset", "Next sunset", *STAMP),
    ("updated_at", "Last successful update", *STAMP),
)


async def async_setup_entry(hass, entry, async_add_entities):
    for location_id, coordinator in entry.runtime_data.items():
        async_add_entities([AtmosphereSensor(coordinator, *metric) for metric in METRICS],
                           config_subentry_id=location_id)


class AtmosphereSensor(LocationEntity, SensorEntity):
    def __init__(self, coordinator, field, name, device_class, unit):
        super().__init__(coordinator, field, field)
        self._attr_name = name
        self._attr_device_class = device_class
        self._attr_native_unit_of_measurement = unit
        if unit is not None and device_class != SensorDeviceClass.PRECIPITATION:
            self._attr_state_class = SensorStateClass.MEASUREMENT

    @property
    def native_value(self):
        value = self.value
        if value is not None and self.device_class == SensorDeviceClass.TIMESTAMP:
            return datetime.fromisoformat(value)
        return value
