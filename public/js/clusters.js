import { statusColors } from "./config.js";

const clusterIconCache = new Map();
const noiseIconCache = new Map();

function parseCoord(v) {
    return typeof v === "number" ? v : parseFloat(v.replace(",", "."));
}

function getClusterIcon(weight) {

    const key = String(weight);
    if (clusterIconCache.has(key)) return clusterIconCache.get(key);

    const radius = Math.min(10 + weight * 0.4, 30);
    const diameter = radius * 2;

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg"
              width="${diameter}" height="${diameter}"
              viewBox="0 0 ${diameter} ${diameter}">
            <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#0066cc"/>
            <text x="${radius}" y="${radius + 4}" 
                  text-anchor="middle"
                  font-family="Arial" font-size="12"
                  fill="white">${weight}</text>
        </svg>`;

    const icon = new H.map.Icon(svg, {
        size: { w: diameter, h: diameter },
        anchor: { x: radius, y: radius }
    });

    clusterIconCache.set(key, icon);
    return icon;
}

function getNoiseIcon(color) {
    if (noiseIconCache.has(color)) return noiseIconCache.get(color);

    const icon = new H.map.Icon(`/public/images/dot-${color}.svg`, {
        size: { w: 28, h: 32 }
    });

    noiseIconCache.set(color, icon);
    return icon;
}

export function createClusterLayer(customers, state) {

    const dataPoints = [];
    for (let i = 0; i < customers.length; i++) {
        const c = customers[i];

        const lat = parseCoord(c.LatitudeMeasure);
        const lng = parseCoord(c.LongitudeMeasure);
        if (isNaN(lat) || isNaN(lng)) continue;

        dataPoints.push(
            new H.clustering.DataPoint(lat, lng, null, {
                id: c.CustomerInternalID,
                title: c.CustomerName,
                color: statusColors[c.Z_Classificao_KUT] || "green"
            })
        );
    }

    const theme = {

        getClusterPresentation(cluster) {
            const weight = cluster.getWeight();
            const icon = getClusterIcon(weight);

            const marker = new H.map.Marker(cluster.getPosition(), {
                icon,
                min: cluster.getMinZoom(),
                max: cluster.getMaxZoom()
            });

            marker.setData(cluster);
            return marker;
        },

        getNoisePresentation(noisePoint) {
            const data = noisePoint.getData();
            const icon = getNoiseIcon(data.color);

            const marker = new H.map.Marker(noisePoint.getPosition(), {
                icon,
                min: noisePoint.getMinZoom()
            });

            marker.setData(noisePoint);
            return marker;
        }
    };

    const provider = new H.clustering.Provider(dataPoints, {
        clusteringOptions: {
            eps: 64,
            minWeight: 10
        },
        theme
    });

    provider.addEventListener("tap", evt => {
        const marker = evt.target;
        const point = marker.getData();

        if (point?.isCluster()) {
            const bounds = buildClusterBounds(point);
            state.map.getViewModel().setLookAtData({ bounds });
            return;
        }

        const { id, title } = point.getData();
        const url = `https://${state.salesCloudURL}/sap/public/byd/runtime?bo_ns=http://sap.com/thingTypes&bo=COD_GENERIC&node=Root&operation=OnExtInspect&param.InternalID=${id}&param.Type=COD_ACCOUNT_TT&sapbyd-agent=TAB`;

        state.ui.addBubble(
            new H.ui.InfoBubble(marker.getGeometry(), {
                content:
                    `<div style="font-family:'72',Arial;padding:0.5rem;">
                        <a href="${decodeURIComponent(url)}" target="_blank"
                           style="text-decoration:none;color:#0066cc;font-size:14px;">
                            <strong>${id} - ${title}</strong><br>
                            <span style="font-size:12px;">Abrir no CRM →</span>
                        </a>
                    </div>`
            })
        );
    });

    return new H.map.layer.ObjectLayer(provider);
}

function buildClusterBounds(cluster) {
    let minLat = 90, maxLat = -90;
    let minLng = 180, maxLng = -180;

    cluster.forEachDataPoint(dp => {
        const { lat, lng } = dp.getPosition();
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    });

    return new H.geo.Rect(maxLat, minLng, minLat, maxLng);
}
``