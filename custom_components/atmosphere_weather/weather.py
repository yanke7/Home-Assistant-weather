"""Native weather entities and Home Assistant forecasts."""
from homeassistant.components.weather import SingleCoordinatorWeatherEntity, WeatherEntityFeature
from homeassistant.const import UnitOfLength, UnitOfPrecipitationDepth, UnitOfPressure, UnitOfSpeed, UnitOfTemperature

from .entity import identity


async def async_setup_entry(hass, entry, async_add_entities):
    for location_id, coordinator in entry.runtime_data.items():
        async_add_entities([AtmosphereWeather(coordinator)], config_subentry_id=location_id)


class AtmosphereWeather(SingleCoordinatorWeatherEntity):
    _attr_has_entity_name = True
    _attr_name = None
    _attr_attribution = "Weather data by Open-Meteo"
    _attr_supported_features = WeatherEntityFeature.FORECAST_HOURLY | WeatherEntityFeature.FORECAST_DAILY
    _attr_native_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_native_pressure_unit = UnitOfPressure.HPA
    _attr_native_wind_speed_unit = UnitOfSpeed.KILOMETERS_PER_HOUR
    _attr_native_precipitation_unit = UnitOfPrecipitationDepth.MILLIMETERS
    _attr_native_visibility_unit = UnitOfLength.KILOMETERS

    def __init__(self, coordinator):
        super().__init__(coordinator)
        identity(self, coordinator, "weather")

    def _current(self, field):
        return (self.coordinator.data or {}).get("current", {}).get(field)

    @property
    def condition(self):
        return self._current("condition")

    @property
    def native_temperature(self):
        return self._current("temperature_2m")

    @property
    def native_apparent_temperature(self):
        return self._current("apparent_temperature")

    @property
    def humidity(self):
        return self._current("relative_humidity_2m")

    @property
    def native_pressure(self):
        return self._current("pressure_msl")

    @property
    def native_wind_speed(self):
        return self._current("wind_speed_10m")

    @property
    def native_wind_gust_speed(self):
        return self._current("wind_gusts_10m")

    @property
    def wind_bearing(self):
        return self._current("wind_direction_10m")

    @property
    def cloud_coverage(self):
        return self._current("cloud_cover")

    def _async_forecast_daily(self):
        return (self.coordinator.data or {}).get("daily")

    def _async_forecast_hourly(self):
        return (self.coordinator.data or {}).get("hourly")
