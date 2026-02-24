# locapi

A Cloudflare Worker that tracks your location, resolves it to points of interest (POIs) using OpenStreetMap, or maps it to defined "hidden zones" (like Home or Work) and serve it via an api.

## Setup

1.  **Install Dependencies**
    ```bash
    bun install
    ```

2.  **Configure Wrangler**
    Ensure you have a `wrangler.toml` file configured with your Cloudflare account details. You will need:
    - A KV Namespace bound as `LOC_KV`.
    - A `HIDDEN_ZONES` variable (can be set via `.dev.vars` for local development or secrets for production).

3.  **Environment Variables**
    - `HIDDEN_ZONES`: A JSON string defining your private zones.
      ```json
      [
        { "name": "Home", "lat": 18.300615, "lon": -64.825609, "radius": 0.5 },
        { "name": "Office", "lat": 44.380642140432165, "lon": -73.22706310693646, "radius": 0.2 }
      ]
      ```

## Development

Start the local development server:

```bash
bun run dev
```

## Deployment

Deploy to Cloudflare Workers:

```bash
bun run deploy
```

## Usage

### Update Location (POST)

Send a JSON payload to the worker root:

```http
POST /
Content-Type: application/json

{
  "lat": 48.8566,
  "lon": 2.3522,
  "batt": 85
}
```

**You can use an app [OwnTracks](https://github.com/owntracks) ([Android](https://github.com/owntracks/android) / [iOS](https://github.com/owntracks/ios)) to periodically send your location to the api**

### Get Current Status (GET)

Retrieve the last known location and battery level:

```http
GET /
```

**Response:**
```json
{
  "location": "Eiffel Tower (Paris, France)",
  "battery": 85
}
```
