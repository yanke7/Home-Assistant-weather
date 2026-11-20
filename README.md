# Atmosphere Weather for Home Assistant

Atmosphere bundles a weather dashboard, worldwide Open-Meteo forecasts, recent precipitation radar, and native Home Assistant entities. Each saved location updates independently, even with all dashboards closed.

[![Install Atmosphere Weather with My Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=yanke7&repository=Home-Assistant-weather&category=integration)

## Install

Atmosphere targets Home Assistant **2026.11 or later**.

1. Add `https://github.com/yanke7/Home-Assistant-weather` as a custom **Integration** repository in Marketplace or HACS, then download it. Alternatively, extract the release ZIP into the Home Assistant configuration directory so it contains `custom_components/atmosphere_weather/manifest.json`.
2. Restart Home Assistant and add **Atmosphere Weather** through **Settings → Devices & services → Add integration**. The initial form defaults to your Home Assistant location and lets you change it.
3. Add the **Atmosphere Weather** card to a panel dashboard. The integration loads its own card resource. See [the example dashboard](examples/dashboard.yaml).

```yaml
type: custom:atmosphere-weather-card
```

Use a unique optional `storage_key` per dashboard card to remember its selection, theme and units independently. An optional `location` config subentry ID sets the initial selection.

## Animated sky

The main panel uses a bundled Three.js scene to show drifting clouds, rain, snow, fog, or stars based on the selected location’s conditions. Motion pauses offscreen and when the app is in the background. Reduced-motion settings and browsers without WebGL use the static sky. The card loads Three.js from Home Assistant.

## Locations and themes

Open the card's settings gear and select **Locations**. Administrators can search by city or postal code, enter coordinates and an IANA timezone manually, or edit and remove a saved location. Up to 20 locations are supported. The header dropdown switches the displayed location. Edits preserve entity IDs. Removing a location unregisters its entities, so check automations that use them first.

In **Locations → Edit**, choose a Home Assistant camera or enter a direct browser-playable camera URL. Use the image format for an MJPEG stream or snapshot URL, and the video format for MP4 or browser-native HLS. For RTSP, first expose the feed as a Home Assistant camera entity. A dashboard served over HTTPS needs an HTTPS feed for reliable direct playback. The preview is hidden for locations without a camera. Tap the preview to expand it, then tap again to close it.

For **Home**, choose a climate entity under **Home thermostat**. The card displays the reported room temperature, or the target if room temperature is unavailable. Tap it to open Home Assistant’s climate controls.

**Appearance** offers Original, Brushed Steel, Amber Relay, Neon Grid, Midnight Drift, Aqua Current, Star Trek and Follow Appearance. Follow Appearance uses shared appearance variables when available and falls back to your Home Assistant theme. Theme and display units are local to the browser. Entity units follow Home Assistant settings.

## Automations

Find the device for your location under the integration. Its native weather entity supports `weather.get_forecasts` for hourly and daily forecasts. Separate sensors expose temperature, feels-like temperature, humidity, pressure, wind speed, direction and gusts, precipitation, cloud cover, forecast highs and lows, upcoming sunrise and sunset, and the last successful update. UV index and visibility represent the next forecast hour.

Use **Freezing** for temperatures at or below 0 °C, **Daylight** for the provider's day/night flag, and **Precipitation expected** for at least 50% probability in the next forecast hour. Weather is model-based. The current precipitation sensor is an amount over the provider's current interval, typically 15 minutes. Failed refreshes mark the entities unavailable. The card may display the previous snapshot with its last update time.

## Official weather alerts

For supported locations in Canada and the United States, Atmosphere displays active warnings, watches, and advisories beneath current conditions. Tap the banner to read the alert, affected area, expiry, and issuing agency. The banner is hidden when no active alert is available.

Home Assistant queries [ECCC GeoMet](https://eccc-msc.github.io/open-data/msc-data/alerts/readme_alerts-geomet_en/) and the [U.S. National Weather Service](https://www.weather.gov/documentation/services-web-alerts) using the selected location's coordinates. The dashboard refreshes about once a minute and the integration caches successful agency responses for two minutes. This is a dashboard display and does not send emergency notifications.

## Providers and privacy

Home Assistant sends each location's coordinates and time zone to [Open-Meteo](https://open-meteo.com/en/docs) on a 15-minute schedule. City and postal searches use its geocoding API. The default endpoint is for personal, non-commercial use. An optional commercial Open-Meteo key can be set in the integration options. [Open-Meteo pricing](https://open-meteo.com/en/pricing)

The bundled radar shows recent observed frames and uses [RainViewer](https://www.rainviewer.com/api/transition-faq.html) and [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles. Home Assistant serves the OpenStreetMap base tiles through its built-in Map tiles service. The browser requests the precipitation overlay from RainViewer. Coverage and freshness vary. Disable radar in integration options if preferred. Public radar is also disabled when a commercial forecast key is configured.

## Moving from the old Weather card

Save your existing dashboard configuration. Add the integration and replace the old `custom:yanke-atmosphere-card` panel card with `custom:atmosphere-weather-card`. The new card needs only its type. The previous calendar, weather entity and radar card options can be removed from this view. Remove old resources only after checking whether other dashboards use them.

## Development

Run `npm ci && npm run build` after editing `frontend/sky.js`. The generated bundle and Three.js license are shipped with the integration.

Run `python -m unittest discover -s tests` with Home Assistant 2026.11 installed in Python 3.14, and `node --check custom_components/atmosphere_weather/www/atmosphere-weather-card.js`. Licensed under [GPL-3.0-only](LICENSE).
