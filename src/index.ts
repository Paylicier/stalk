
export interface Env {
    HIDDEN_ZONES: string;
    LOC_KV: KVNamespace;
}

/**
 * Calculate the distance between two GPS points in kilometers using the Haversine formula.
 * @param {number} lat1 - Origin point latitude
 * @param {number} lon1 - Origin point longitude
 * @param {number} lat2 - Destination point latitude
 * @param {number} lon2 - Destination point longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // approx radius of earth (km)

    const toRad = (value: number) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Get POI from OSM
 * @param {number} lat - Latitude of the point
 * @param {number} lon - Longitude of the point
 * @returns {Promise<Array<{ name: string, city: string, country: string, distance: number }>>} List of nearby POIs
 */
async function getPOIsFromOSM(lat: number, lon: number): Promise<Array<{ name: string, city: string, country: string, distance: number }>> {
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
        [out:json][timeout:25];
    (
      nwr(around:500, ${lat}, ${lon})
        ["name"]
        ["amenity"]
        ["amenity"!~"^(parking.*|waste.*|bench|toilets|recycling|vending_machine|shelter|post_box|fountain|drinking_water|telephone)$"]
        ["access"!~"^(private|no|permit|delivery|agricultural|forestry)$"];
    );

    out center;
    `

    return fetch(overpassUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: query
    })
        .then(response => response.json())
        .then(data => {
            const pois: Array<{ name: string, city: string, country: string, distance: number }> = [];
            data.elements.map((poi: any) => {
                const poiLat = poi.lat || poi.center.lat;
                const poiLon = poi.lon || poi.center.lon;

                pois.push({
                    name: poi.tags.name || 'Unknown',
                    city: poi.tags['addr:city'] || '',
                    country: poi.tags['addr:country'] || '',
                    distance: calculateDistanceInKm(lat, lon, poiLat, poiLon)
                });
            })
            return pois.sort((a, b) => a.distance - b.distance).slice(0, 5); // Return top 5 closest POIs
        })
        .catch(error => {
            console.error('Error fetching POIs from OSM:', error);
            return [];
        });
}

export default {
    async fetch(request, env, ctx): Promise<Response> {
        if (request.method === 'POST') {
            const body = await request.json();
            if (!body || body._type !== 'location') return new Response('[]');
            const { lat, lon, batt } = body;

            const HIDDEN_ZONES_ARRAY = JSON.parse(env.HIDDEN_ZONES) as Array<{ name: string, lat: number, lon: number, radius: number }>;
            const zone = HIDDEN_ZONES_ARRAY.find(zone => {
                const distance = calculateDistanceInKm(lat, lon, zone.lat, zone.lon);
                return distance <= zone.radius;
            });

            console.log(`Received location update: lat=${lat}, lon=${lon}, batt=${batt}`);
            console.log(`is in hidden zone: ${zone ? 'yes' : 'no'}`);
            console.log(`battery level: ${batt}`);

            if (zone) {
                await env.LOC_KV.put(`location`, `${zone.name}`);
                await env.LOC_KV.put(`battery`, batt);
            } else {
                const pois = await getPOIsFromOSM(lat, lon);
                const isPoiValid = pois[0] && pois[0].distance <= 0.2;
                const locationString = isPoiValid
                    ? `${pois[0].name} ${pois[0].city ? '(' + pois[0].city + (pois[0].country ? ', ' + pois[0].country : '') + ')' : ''}`
                    : `unknown`;

                await env.LOC_KV.put(`location`, locationString);
                await env.LOC_KV.put(`battery`, batt);
            }

            return new Response("[]");
        }
        if (request.method === 'GET') {
            return new Response(JSON.stringify({
                location: await env.LOC_KV.get(`location`) || 'unknown',
                battery: Number(await env.LOC_KV.get(`battery`) || 0)
            }), {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    },
} satisfies ExportedHandler<Env>;

