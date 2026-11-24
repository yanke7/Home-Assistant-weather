"""Configure Atmosphere and its saved locations."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.util import dt as dt_util

from .coordinator import DOMAIN

LIMIT = 20


async def async_clean_location(data):
    name = data["name"].strip()
    latitude = float(data["latitude"])
    longitude = float(data["longitude"])
    zone = data["timezone"].strip()
    if not name or len(name) > 80 or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Enter a name and valid coordinates")
    if await dt_util.async_get_time_zone(zone) is None:
        raise ValueError("Enter a valid IANA time zone")
    return dict(name=name, latitude=latitude, longitude=longitude, timezone=zone)


def location_key(data):
    return f"{data['latitude']:.5f},{data['longitude']:.5f},{data['timezone']}"


def fields(defaults):
    return vol.Schema({vol.Required(key, default=defaults[key]): kind
                       for key, kind in (("name", str), ("latitude", vol.Coerce(float)),
                                         ("longitude", vol.Coerce(float)), ("timezone", str))})


def home(hass):
    return dict(name=hass.config.location_name or "Home", latitude=hass.config.latitude,
                longitude=hass.config.longitude, timezone=hass.config.time_zone)


class AtmosphereFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @classmethod
    def async_get_supported_subentry_types(cls, config_entry):
        return {"location": LocationFlow}

    @staticmethod
    def async_get_options_flow(config_entry):
        return ProviderOptions()

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        errors = {}
        if user_input is not None:
            try:
                data = await async_clean_location(user_input)
            except ValueError:
                errors["base"] = "invalid_location"
            else:
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="Atmosphere Weather", data={}, subentries=[{
                    "data": data, "title": data["name"], "subentry_type": "location",
                    "unique_id": location_key(data),
                }])
        return self.async_show_form(step_id="user", data_schema=fields(user_input or home(self.hass)), errors=errors)


class ProviderOptions(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            user_input["api_key"] = user_input.get("api_key", "").strip()
            return self.async_create_entry(data={**self.config_entry.options, **user_input})
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Optional("api_key", description={"suggested_value": self.config_entry.options.get("api_key", "")}): str,
            vol.Required("radar", default=self.config_entry.options.get("radar", True)): bool,
        }))


class LocationFlow(config_entries.ConfigSubentryFlow):
    async def async_step_user(self, user_input=None):
        return await self.async_location_form("user", user_input)

    async def async_step_reconfigure(self, user_input=None):
        return await self.async_location_form("reconfigure", user_input, self._get_reconfigure_subentry())

    async def async_location_form(self, step, user_input, existing=None):
        entry = self._get_entry()
        errors = {}
        if user_input is not None:
            try:
                data = await async_clean_location(user_input)
            except ValueError:
                errors["base"] = "invalid_location"
            else:
                key = location_key(data)
                if any(item.unique_id == key and item != existing for item in entry.subentries.values()):
                    errors["base"] = "duplicate_location"
                elif existing is None and len(entry.subentries) >= LIMIT:
                    errors["base"] = "location_limit"
                elif existing is not None:
                    return self.async_update_and_abort(
                        entry, existing, title=data["name"], data={**existing.data, **data}, unique_id=key,
                    )
                else:
                    return self.async_create_entry(title=data["name"], data=data, unique_id=key)
        defaults = existing.data if existing else home(self.hass)
        return self.async_show_form(step_id=step, data_schema=fields(user_input or defaults), errors=errors)
