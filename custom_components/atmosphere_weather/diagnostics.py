"""Diagnostics without location, credentials, or readings."""


async def async_get_config_entry_diagnostics(hass, entry):
    return {
        "locations": len(entry.subentries),
        "available": sum(bool(item.last_update_success and item.data) for item in entry.runtime_data.values()),
        "commercial_endpoint": bool(entry.options.get("api_key")),
    }
