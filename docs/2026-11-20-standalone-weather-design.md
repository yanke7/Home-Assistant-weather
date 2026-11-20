# Atmosphere standalone integration

Status: proposed for user approval. This is a design, not an implementation or release.

## Requested outcome

Build the existing Atmosphere Weather dashboard into a globally installable Home Assistant custom integration, housed in the separate public repository `yanke7/Home-Assistant-weather` and local folder `Home-Assistant-weather`. Bundle the dashboard card, weather data retrieval, automation entities, location management, and themes. Remove collection calendars completely from the new product. Preserve the compact desktop/mobile experience. Users can create multiple locations from the card's Settings tab and select them from a dropdown.

Existing `dashboard-weather2` and the public `Home-Assistant/Weather` folder are migration sources, not the new distribution. Do not delete or replace live dashboards while building. The new repository does not exist at time of inspection. Almanac is available locally in `Home-Assistant-Almanac` and supplies the theme reference.

## Proposed approach and alternatives

Recommendation: one Python custom integration (`atmosphere_weather`) with bundled JavaScript card (`custom:atmosphere-weather-card`), direct Open-Meteo requests, and one Home Assistant config subentry/device per location. Use Home Assistant's own frontend, HTTP, weather, sensor, binary-sensor, config-entry, and WebSocket infrastructure; these are core facilities, not additional user-installed integrations. No dependency on weather.forecast_home, sun.sun, Almanac, calendar.waste, weather-radar-card, card-mod, a shared theme resource, or external JavaScript CDNs.

Keeping the existing weather entity and third-party radar card would be quicker but contradicts the standalone requirement. Making a browser-only card cannot maintain automation entities when dashboards are closed. The backend-plus-bundled-card approach meets both requirements.

Builder decision: Open-Meteo is the initial provider. Worldwide geographic coverage does not guarantee equal model accuracy, station coverage, or radar coverage everywhere. All weather is model-based and online. This is not a fully offline integration or an official severe-weather-alert service.

## Data providers and distribution constraints

- Open-Meteo Forecast API: current conditions, 48-hour display window and up to 7 daily forecast periods; request metric native values and explicit location timezone. Free public endpoint for personal/non-commercial installations. Optional commercial API key uses the documented customer endpoint, stored only in Home Assistant configuration and excluded from diagnostics and WebSocket replies. Never share a developer-owned key across installations.
- Open-Meteo geocoding: explicit city/postal search, result selection with region and country, or manual coordinates and an IANA timezone. Do not use browser geolocation automatically. Search terms/coordinates go to the provider only through the configured integration.
- RainViewer: optional bundled radar tab with recent observed frames, source timestamps and visible credit. Initial scope is past frames only, conservative maximum zoom 7 and bounded request rates, following the more restrictive transition documentation. No invented future frames. Geographic absence or provider failure must not be rendered as “no rain”.
- Bundle the map renderer and its license in the integration; no separate radar card installation. Use OpenStreetMap base tiles with visible attribution and compliant caching/identification. Lazy-load map tiles only when radar is visible; pause animation on hidden pages.
- Free-provider use is personal/non-commercial. Commercial installations can supply an Open-Meteo key and disable public radar; bespoke radar commercial support is out of scope. Do not advertise unrestricted commercial service or guaranteed global radar.
- Every installation fetches independently; no central Yanke cloud, account, analytics, subscriptions, or private relay.

## Home Assistant configuration and location lifecycle

One config entry stores provider options; location subentries are the source of truth. On initial setup, offer Home Assistant's configured home location as a clearly labeled editable default. Each location has an immutable generated ID, display name, latitude (-90..90), longitude (-180..180), and valid IANA timezone. Up to 20 saved locations initially; enforce this server-side and explain the limit in the UI. Reject duplicate coordinate/timezone locations without losing the user's form.

Card Settings has tabs: Locations, Appearance, and Data & privacy. Locations provides search/add, manual add, edit name/coordinates/timezone, and remove. Home Assistant administrators can mutate locations; other authorized users may select and view locations but cannot change configuration. Backend enforces permissions; disabling a button is not sufficient. Standard integration config/subentry flows provide the same lifecycle without needing the card.

A location edit retains its immutable ID and entity unique IDs, refreshes that location, and preserves unrelated locations. Renaming does not silently rename entity IDs. Removal identifies that location's device/entities and warns that dependent automations lose their source; removing the last location leaves a usable empty Settings state. Location operations are serialized and validated on the server to avoid duplicate/concurrent entries. No direct `.storage` edits.

Card dropdown shows all configured locations with their names. Selection is per card/browser and persisted using a card instance key; optional YAML location ID pins an initial location. Changing selection changes only the displayed data, not backend polling or which entities update. When a selected location is removed, fall back to the first remaining location; if none remain, show Add location. Do not overwrite another user's preference. Multiple cards can display different locations concurrently.

## Backend data and entities

One update coordinator per location. Normal weather polling every 15 minutes, shared among entities and every card displaying that location. Refresh failures use bounded exponential retry/backoff and provider Retry-After when present. Changing location settings invalidates obsolete data before the next request. No network I/O in entity properties. Cached data may be displayed with explicit age/stale status; entity availability must reflect failed or excessively old data rather than silently retaining healthy-looking readings. Missing values stay unknown, not zero.

Each device exposes:

- Weather entity with current condition, temperature, apparent temperature, humidity, pressure, wind speed/direction/gusts, visibility, and native hourly/daily forecast support where provided.
- Numeric sensors: temperature, apparent temperature, humidity, pressure, wind speed, wind gust speed, wind bearing, precipitation amount for the documented current interval, next-hour precipitation probability, cloud cover, UV index, and today's forecast high/low. Fields not supplied by the selected endpoint are unknown or omitted, never synthesized as observations.
- Timestamp sensors: next sunrise, next sunset, last successful weather update. Handle polar days/nights without manufactured event times.
- Binary sensors: daylight (provider current is_day), freezing (valid current temperature <=0 C), precipitation expected next hour (probability >=50%). Clearly document derived thresholds and forecast meaning. Missing inputs make derived entities unavailable/unknown.
- Diagnostic update status/data age if needed to expose stale readings reliably.

Stable unique IDs combine immutable location ID with metric key. Every device/entity is associated with its config subentry so removal and reload behave correctly. Use native units, device classes, state classes, and standard weather forecast methods; Home Assistant handles preferred entity units. Card supports metric/imperial preference independently without changing automation values. Locale and each location's timezone control display; use timezone-aware timestamps for DST and date boundaries. All locations update with browsers closed.

Backend WebSocket endpoints list locations/status, read normalized snapshots, search locations, and add/edit/remove locations. Read requests require authentication and appropriate entity access; management and provider configuration require admin. Validate input types, coordinate ranges, timezone, string lengths, and limits. No arbitrary backend URL fetching and no credentials in replies. Use standard config flows for sensitive provider credentials rather than sending keys through general snapshot endpoints.

## Dashboard and themes

Single compact overview: location dropdown, current conditions/sky, key metrics, hourly/daily outlook and radar. The old pickup strip becomes a brief weather summary (high/low, sunrise/sunset and precipitation outlook) derived from actual data. Desktop shows forecast and radar side by side; mobile uses Hourly/Daily/Radar tabs. Settings opens within the card as an accessible dialog with its own scroll area and visible close control. No full-page navigation needed for normal use.

Aim to fit default-text overview at desktop 1366x768 and phones 390x844 and 375x667 including HA chrome. Preserve readable touch controls and allow scrolling at larger accessibility text sizes or shorter screens instead of clipping content. Do not claim every possible screen size can fit without scrolling.

Match Almanac's theme names and IDs: Original, Brushed Steel, Amber Relay, Neon Grid, Midnight Drift, Aqua Current, Star Trek, Follow Appearance. Original adapts to location daylight/twilight/night using available solar/forecast times; the other themes share Almanac's palette and typography. Star Trek includes the distinctive amber/lilac segmented rails, not merely a color swap. Follow Appearance reads existing CSS variables if provided, with HA theme fallbacks; it never requires Almanac or a shared theme integration. Theme choice is remembered per browser/card, while saved locations are shared backend configuration.

Provide keyboard labels/focus states, screen-reader names, reduced-motion support, and an accessible location selector/settings dialog. HTML-escape labels/provider text; avoid unsafe HTML injection. Ship local assets only and make all source attribution visible. Use standard card-picker registration and automatically load versioned frontend assets from the integration.

## Packaging, migration, and release

Create `Home-Assistant-weather` as the standalone public repository only after design approval. Include custom_components/atmosphere_weather, manifest, config flow/subentry flow, translations/en, strings, diagnostics with redaction, brand assets, bundled card/map assets, license notices, HACS metadata, tests, CI, example dashboard configuration, README and migration instructions. GPL-3.0-only preserves compatibility with the Almanac code/palette reuse; preserve required notices for bundled third-party assets.

Initial release is 0.1.0 beta until exercised on a real Home Assistant installation. Publish tagged ZIP with the correct custom_components folder structure and honest release notes. Custom-repository installation should work by URL. Listing in the official/community catalog is a separate review process and must not be claimed as automatic.

The old public Weather folder can gain a migration link after the new repository is usable; retain old source/history rather than destructively deleting it. New domain/card type avoids collisions with existing inline yanke-atmosphere-card. Removing obsolete dependencies is user-controlled because other dashboards may use them.

Build, validate, and publish the new project as part of this work after approval. Do not restart the user's Home Assistant or silently replace their existing live dashboard; prepare migration instructions and request specific approval if a live installation requires a restart. Local development and test fixtures use public demo locations, never the user's address, real schedules, credentials, or backup files.

## Acceptance and verification

1. Fresh install with no external weather/calendar/theme/radar integration loads the bundled card and creates weather/sensors.
2. Adding two locations through Settings and through the integration flows creates separate persistent devices/entities. Dropdown changes only presentation; both devices update in the background.
3. Rename/edit/remove/duplicate/add-concurrently, empty location list, and last-location removal have defined behavior. IDs survive rename, reload, and restart.
4. Non-admin writes and unauthenticated access are denied; read access follows HA permissions; diagnostics redact credentials and exact coordinates.
5. Data parsing handles null arrays, unknown condition codes, polar sun events, date line, both hemispheres, DST spring/fall and fractional timezone offsets. Unit conversion and native forecast schemas are tested.
6. Timeout, throttling, invalid JSON, partial responses, and recovery produce explicit status, with no fabricated good weather, zero rain, or stale automation readings presented as fresh.
7. All eight themes work without Almanac; choice persists; selection and settings are keyboard accessible. Test mobile/desktop fit and accessibility overflow.
8. Radar uses bundled assets, attribution, observed timestamps and graceful unavailable states; no credentials or unbounded proxy URLs exposed.
9. Automated Python tests run against the supported Home Assistant release; JS tests cover data binding, theme persistence, location switching, forms, failure states and cleanup. Browser tests use demo fixtures. Run hassfest and HACS validation in CI and inspect results before claiming a validated release.

## Sources and implementation references

- Existing integration/frontend patterns: `Home-Assistant-Almanac/custom_components/almanac` and `Home-Assistant-Almanac/almanac-sky-card.js`.
- Existing dashboard: `dashboard-weather2/atmosphere-card.js`; public legacy package: `yanke7/Home-Assistant/Weather`.
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/geocoding-api
- https://open-meteo.com/en/pricing
- https://open-meteo.com/en/terms
- https://www.rainviewer.com/api/transition-faq.html
- https://www.rainviewer.com/api/weather-maps-api.html
- https://contributors.home-assistant.io/core/integrations/subentries/
- https://contributors.home-assistant.io/core/entities/weather/

Implementation details such as module names, test harness, exact UI spacing, and coordinator internals are left to the builder. Provider choice, entity independence, location behavior, theme parity, and release/migration boundaries above are the proposed product contract.
