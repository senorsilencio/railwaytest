# MasterPortal API - Technische Referenz für Mietpreis-Visualization

## Schnelle Code-Snippets

### 1. BASIC MAP SETUP

```javascript
import mapsAPI from '@masterportal/masterportalapi/src/maps/api.js';
import 'ol/ol.css';

const config = {
    target: 'map',
    epsg: 'EPSG:25832',
    extent: [510000, 5850000, 625000, 6000000],
    startCenter: [565874, 5934140],
    startResolution: 132.29,
    layerConf: [...],
    layers: [...]
};

const map = mapsAPI.map.createMap(config, '2D');
```

---

## 2. CHOROPLETH-MAPS (Mietpreise nach Farbe)

### Scenario A: GeoJSON mit Interpolation

**Services.json:**
```json
{
    "id": "rental-choropleth",
    "typ": "GeoJSON",
    "url": "https://api.example.com/rental-zones.geojson",
    "renderer": "webgl"
}
```

**Portal.json - Layer Config:**
```json
{
    "id": "rental-choropleth",
    "renderer": "webgl",
    "style": {
        "polygon-fill-color": [
            "interpolate",
            ["linear"],
            ["get", "rent_sqm"],
            10, [0, 200, 60],
            15, [255, 255, 0],
            20, [255, 100, 0],
            30, [200, 0, 0]
        ],
        "polygon-stroke-color": "#333",
        "polygon-stroke-width": 1.5,
        "polygon-opacity": 0.75
    }
}
```

**GeoJSON Structure:**
```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "id": "stadtteil-1",
                "name": "Altstadt",
                "rent_sqm": 18.50,
                "avg_price": 1850
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[...]]
            }
        }
    ]
}
```

### Scenario B: Mehrfach-Kriterium Styling

```javascript
// Nach Stadtteil UND Preis färben
const style = {
    "polygon-fill-color": [
        "case",
        [">", ["get", "rent_sqm"], 25],
        "#cc0000",           // Teuer: Rot
        [">", ["get", "rent_sqm"], 20],
        "#ff6600",           // Mittel-Teuer: Orange
        [">", ["get", "rent_sqm"], 15],
        "#ffff00",           // Mittel: Gelb
        [">=", ["get", "rent_sqm"], 10],
        "#00cc00",           // Günstig: Grün
        "#999999"            // Default
    ]
};
```

---

## 3. HEATMAP MIT CLUSTERING

```javascript
{
    "id": "rental-heatmap",
    "typ": "GeoJSON",
    "url": "https://api.example.com/rental-offers.geojson",
    "clusterDistance": 80,  // Pixel-Radius für Clustering
    "renderer": "webgl",
    "isPointLayer": true
}
```

**JavaScript - Cluster-Styling:**
```javascript
import { Vector as VectorSource } from 'ol/source';
import GeoJSON from 'ol/format/GeoJSON';
import { Cluster } from 'ol/source';

const sourceGeoJSON = new VectorSource({
    features: new GeoJSON().readFeatures(geoJsonData)
});

const clusterSource = new Cluster({
    source: sourceGeoJSON,
    distance: 80  // Pixels
});

// Cluster-Feature Styling
function clusterStyle(feature) {
    const size = feature.get('features').length;
    
    let color, radius;
    if (size > 50) {
        radius = 30;
        color = '#cc0000';
    } else if (size > 20) {
        radius = 20;
        color = '#ff6600';
    } else {
        radius = 10;
        color = '#0099ff';
    }
    
    return new Style({
        image: new CircleStyle({
            radius: radius,
            fill: new Fill({ color: color }),
            stroke: new Stroke({
                color: '#fff',
                width: 2
            })
        }),
        text: new Text({
            text: size > 1 ? size.toString() : '',
            fill: new Fill({ color: '#fff' }),
            font: 'bold 12px Arial'
        })
    });
}
```

---

## 4. WMS-FILTER MIT CQL

```json
{
    "id": "rental-wms",
    "typ": "WMS",
    "url": "https://geodienste.hamburg.de/HH_WFS_Rental",
    "layers": "rental_zones",
    "cqlFilter": "rent_sqm > 10 AND rent_sqm < 25",
    "version": "1.3.0",
    "format": "image/png"
}
```

**Dynamisch CQL Filter setzen:**
```javascript
function updateCQLFilter(minPrice, maxPrice) {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-wms');
    
    if (layer) {
        const source = layer.getSource();
        
        // WMS GetMap-Parameter aktualisieren
        const params = source.getParams();
        params.CQL_FILTER = `rent_sqm >= ${minPrice} AND rent_sqm <= ${maxPrice}`;
        source.updateParams(params);
        
        console.log('CQL Filter updated:', params.CQL_FILTER);
    }
}

// Usage
updateCQLFilter(12, 20);  // Nur 12-20 €/m²
```

---

## 5. DYNAMICA API-DATEN LADEN

### Real-time Updates via Fetch

```javascript
async function loadLiveRentalData() {
    try {
        // 1. API abrufen
        const response = await fetch('https://api.example.com/live-rentals', {
            headers: {
                'Authorization': 'Bearer YOUR_TOKEN',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        // 2. GeoJSON parsen
        const geoJsonData = await response.json();
        
        // 3. Layer-Source aktualisieren
        const layer = map.getLayers()
            .getArray()
            .find(l => l.get('id') === 'rental-points');
        
        const source = layer.getSource();
        
        // Alte Features löschen
        source.clear();
        
        // Neue Features hinzufügen
        const format = new GeoJSON();
        const features = format.readFeatures(geoJsonData);
        source.addFeatures(features);
        
        console.log(`✓ ${features.length} live rental listings loaded`);
        
    } catch (error) {
        console.error('Failed to load live data:', error);
    }
}

// Auto-Refresh alle 60 Sekunden
setInterval(loadLiveRentalData, 60000);
```

### Daten mit Filtern kombinieren

```javascript
async function loadFilteredRentals(options = {}) {
    const {
        minPrice = 10,
        maxPrice = 30,
        minRooms = 1,
        maxRooms = 5,
        bbox = null
    } = options;
    
    // URL mit Query-Parametern bauen
    const params = new URLSearchParams({
        min_price: minPrice,
        max_price: maxPrice,
        min_rooms: minRooms,
        max_rooms: maxRooms,
        limit: 1000
    });
    
    if (bbox) {
        params.append('bbox', bbox.join(','));
    }
    
    const url = `https://api.example.com/rentals?${params}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Layer aktualisieren
    const layer = map.getLayers().getArray()
        .find(l => l.get('id') === 'rental-points');
    
    layer.getSource().clear();
    layer.getSource().addFeatures(
        new GeoJSON().readFeatures(data)
    );
}

// Beispiel
loadFilteredRentals({
    minPrice: 12,
    maxPrice: 18,
    minRooms: 2,
    maxRooms: 3
});
```

---

## 6. WFS (Web Feature Service) QUERIES

### WFS Layer definieren

```json
{
    "id": "rental-wfs",
    "typ": "WFS",
    "url": "https://geodienste.hamburg.de/HH_WFS_Rental",
    "featureType": "rental_listings",
    "outputFormat": "application/json",
    "version": "2.0.0",
    "maxFeatures": 500
}
```

### Direkte WFS-Abfrage (GetFeature)

```javascript
async function queryWFS(featureType, filter) {
    const wfsUrl = 'https://geodienste.hamburg.de/HH_WFS_Rental';
    
    const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: featureType,
        outputFormat: 'application/json',
        CQL_FILTER: filter,
        maxFeatures: 1000
    });
    
    const url = `${wfsUrl}?${params}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data;
}

// Beispiel: Alle Wohnungen zwischen 15-20 €/m²
const results = await queryWFS(
    'rental_apartments',
    "rent_sqm >= 15 AND rent_sqm <= 20"
);

console.log(`Found ${results.features.length} apartments`);
```

---

## 7. FEATURE INTERACTION & POPUP

```javascript
// Single Click - Feature-Eigenschaften anzeigen
map.on('click', (event) => {
    map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const props = feature.getProperties();
        
        console.log('Clicked Feature:', {
            id: props.id,
            address: props.address,
            rent: props.rent_total,
            rooms: props.room_count,
            sqm: props.area_sqm
        });
        
        // Popup/Modal anzeigen
        showPropertyModal(props);
    });
});

// Hover - Feature highlighten
let highlightedFeature = null;

map.on('pointermove', (event) => {
    const pixel = event.pixel;
    
    // Altes Highlight entfernen
    if (highlightedFeature) {
        highlightedFeature.setStyle(undefined);
    }
    
    // Neues Feature highlighten
    map.forEachFeatureAtPixel(pixel, (feature) => {
        highlightedFeature = feature;
        
        feature.setStyle(new Style({
            fill: new Fill({ color: 'rgba(0, 100, 200, 0.4)' }),
            stroke: new Stroke({ color: '#0066cc', width: 2 })
        }));
    });
});

// Double click - Zoom zu Feature
map.on('dblclick', (event) => {
    map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const geom = feature.getGeometry();
        const extent = geom.getExtent();
        
        map.getView().fit(extent, {
            duration: 500,
            padding: [50, 50, 50, 50]
        });
    });
});
```

---

## 8. STYLE-DYNAMISCHE ÄNDERUNG

### Feature-basiertes Styling ändern

```javascript
function updateStyleByProperty(layerId, property, colorScale) {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === layerId);
    
    if (!layer) return;
    
    const source = layer.getSource();
    
    source.forEachFeature((feature) => {
        const value = feature.get(property);
        const color = getColorFromScale(value, colorScale);
        
        feature.setStyle(new Style({
            fill: new Fill({ color: color }),
            stroke: new Stroke({ color: '#333', width: 1 })
        }));
    });
}

function getColorFromScale(value, scale) {
    // scale: [{value: 100, color: '#ff0000'}, ...]
    let closestEntry = scale[0];
    
    scale.forEach(entry => {
        if (Math.abs(entry.value - value) < Math.abs(closestEntry.value - value)) {
            closestEntry = entry;
        }
    });
    
    return closestEntry.color;
}

// Beispiel
updateStyleByProperty('rental-choropleth', 'rent_sqm', [
    { value: 10, color: '#00ff00' },   // Grün
    { value: 15, color: '#ffff00' },   // Gelb
    { value: 20, color: '#ff6600' },   // Orange
    { value: 30, color: '#cc0000' }    // Rot
]);
```

---

## 9. ZOOM & NAVIGATION

```javascript
// Zu bestimmter Extent zoomen
function zoomToExtent(extent) {
    map.getView().fit(extent, {
        size: map.getSize(),
        duration: 1000,
        padding: [20, 20, 20, 20]
    });
}

// Zu Koordinaten animiert zoomen
function animateToLocation(coords, zoom) {
    const view = map.getView();
    
    view.animate({
        center: coords,
        zoom: zoom,
        duration: 1000
    });
}

// Alle Features einer Layer zoomen
function zoomToAllFeatures(layerId) {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === layerId);
    
    if (!layer) return;
    
    const source = layer.getSource();
    const extent = source.getExtent();
    
    zoomToExtent(extent);
}

// Beispiele
zoomToExtent([510000, 5850000, 625000, 6000000]);
animateToLocation([565874, 5934140], 11);
zoomToAllFeatures('rental-points');
```

---

## 10. EXPORT & ANALYTICS

### Feature-Daten exportieren

```javascript
function exportFeaturesToGeoJSON(layerId, filename) {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === layerId);
    
    if (!layer) return;
    
    const source = layer.getSource();
    const features = source.getFeatures();
    
    // GeoJSON erzeugen
    const geoJson = new GeoJSON().writeFeaturesObject(features);
    
    // Download triggern
    const blob = new Blob(
        [JSON.stringify(geoJson, null, 2)],
        { type: 'application/json' }
    );
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'export.geojson';
    link.click();
    URL.revokeObjectURL(url);
}

// Beispiel
exportFeaturesToGeoJSON('rental-choropleth', 'rental-prices.geojson');
```

### Statistiken berechnen

```javascript
function calculateStatistics(layerId, property) {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === layerId);
    
    if (!layer) return null;
    
    const source = layer.getSource();
    const values = [];
    
    source.forEachFeature((feature) => {
        const value = feature.get(property);
        if (typeof value === 'number') {
            values.push(value);
        }
    });
    
    if (values.length === 0) return null;
    
    values.sort((a, b) => a - b);
    
    return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((a, b) => a + b) / values.length,
        median: values[Math.floor(values.length / 2)],
        stdDev: Math.sqrt(
            values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length
        )
    };
}

// Beispiel
const stats = calculateStatistics('rental-choropleth', 'rent_sqm');
console.log('Mietpreis-Statistiken:', stats);
// Output:
// {
//     count: 103,
//     min: 10.5,
//     max: 35.2,
//     mean: 17.8,
//     median: 17.2,
//     stdDev: 5.4
// }
```

---

## 11. FEHLERBEHANDLUNG & LOGGING

```javascript
/**
 * Layer-Load Error Handling
 */
function setupErrorHandling(map) {
    const layers = map.getLayers().getArray();
    
    layers.forEach(layer => {
        const source = layer.getSource();
        
        if (!source) return;
        
        // Tile Load Errors
        source.on('tileloaderror', (event) => {
            console.warn(`Tile load error for layer ${layer.get('id')}:`, event);
            // Optional: Retry-Logik
        });
        
        // Feature Load Errors
        source.on('featuresloaderror', (event) => {
            console.error(`Feature load error:`, event);
            showNotification(
                `Fehler beim Laden von Features: ${layer.get('name')}`,
                'error'
            );
        });
        
        // Generic Errors
        source.on('error', (event) => {
            console.error(`Generic error:`, event);
        });
    });
}

setupErrorHandling(map);
```

---

## 12. PERFORMANCE-OPTIMIERUNG

### Feature Limit

```javascript
{
    "id": "large-dataset",
    "typ": "GeoJSON",
    "url": "https://api.example.com/data.geojson",
    "renderer": "webgl",
    "maxFeatures": 5000  // Limit Features
}
```

### Lazy Loading

```javascript
let isLoading = false;

map.getView().on('change:resolution', async () => {
    if (isLoading) return;
    
    const zoom = map.getView().getZoom();
    
    // Erst bei Zoom > 10 detaillierte Layer laden
    if (zoom > 10) {
        isLoading = true;
        await loadDetailedRentalData();
        isLoading = false;
    }
});
```

### Clustering für große Datenmengen

```javascript
const source = new VectorSource({
    url: 'https://api.example.com/rentals.geojson',
    format: new GeoJSON()
});

const cluster = new Cluster({
    source: source,
    distance: 100  // Cluster wenn < 100px entfernt
});

const layer = new VectorLayer({
    source: cluster,
    style: clusterStyle
});
```

---

## 13. API ENDPOINTS ÜBERSICHT

| Funktion | Endpoint-Typ | Beispiel |
|----------|-------------|---------|
| **GeoJSON Daten** | REST GET | `https://api.example.com/rental-zones.geojson` |
| **WMS Tiles** | OGC WMS | `https://geodienste.hamburg.de/HH_WMS` |
| **WFS Features** | OGC WFS | `https://geodienste.hamburg.de/HH_WFS` |
| **OAF Collection** | OGC API | `https://api.hamburg.de/collections/rentals` |
| **Tile Server** | WMTS | `https://server.example.com/wmts` |
| **Search/Gazetteer** | REST | `https://api.example.com/geocode` |

---

**Dokumentation Ende** | Für Fragen: https://bitbucket.org/geowerkstatt-hamburg/masterportalapi
