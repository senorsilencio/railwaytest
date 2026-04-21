# MasterPortal API Integrationsleitfaden für Mietspiegel-Geoportal

**Version**: MasterPortal API 2.61.0  
**Projektquelle**: https://bitbucket.org/geowerkstatt-hamburg/masterportalapi

---

## 1. OVERVIEW & ARCHITEKTUR

### Grundkonzept
MasterPortal API ist eine **OpenLayers 10.9.0-basierte TypeScript/JavaScript-Bibliothek** zum Einbetten umfangreicher Kartenfunktionalität in bestehende Webseiten. Es wurde von Geowerkstatt Hamburg entwickelt und basiert auf dem Feature-reichen Masterportal.

**Architektur-Stack:**
```
┌─────────────────────────────────┐
│  Your Web Application (HTML/JS) │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  MasterPortal API (2.61.0)      │
│  ├─ Maps & View Management      │
│  ├─ Layer Management (8 types)  │
│  ├─ Style Pipeline (WebGL)      │
│  ├─ 3D Support (OLCS/Cesium)    │
│  └─ Search & Data Integration   │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  OpenLayers 10.9.0              │
│  ├─ ol-mapbox-style 13.3.0      │
│  ├─ olcs 2.23.0 (3D)            │
│  ├─ proj4 2.10.0 (CRS)          │
│  └─ xml2js 0.6.2 (WFS)          │
└─────────────────────────────────┘
```

**Kernfunktionen:**
- ✅ 2D & 3D Kartensupport
- ✅ 8 Layer-Typen (WMS, WMTS, WFS, GeoJSON, OAF, VectorTile, Terrain3D, Tileset3D)
- ✅ WebGL-Renderer für High-Performance-Datenvisualisierung
- ✅ Stil-Pipeline mit Interpolation (ideal für Choropleth-Maps)
- ✅ Fehlerbehandlung mit Callbacks
- ✅ Koordinatentransformation (EPSG-Unterstützung)

---

## 2. INSTALLATION & SETUP

### NPM Installation
```bash
npm install @masterportal/masterportalapi
```

### Grundlegende HTML-Integration
```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="ol/ol.css">
    <script type="module" src="app.js"></script>
</head>
<body>
    <div id="map-container"></div>
</body>
</html>
```

### Minimalistisches JavaScript-Setup
```javascript
import * as mpapi from '@masterportal/masterportalapi';
import mapsAPI from '@masterportal/masterportalapi/src/maps/api.js';
import 'ol/ol.css';

// 1. Konfiguration definieren
const config = {
    target: 'map-container',           // Div-ID für Karte
    epsg: 'EPSG:25832',               // UTM Zone 32N (Hamburg)
    extent: [510000, 5850000, 625000, 6000000],
    startCenter: [565874, 5934140],
    startResolution: 132.29,
    namedProjections: [
        ['EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m'],
        ['EPSG:4326', '+proj=longlat +ellps=WGS84']
    ],
    layerConf: [...],  // siehe Abschnitt 3
    layers: [...]
};

// 2. Karte erstellen
const map = mapsAPI.map.createMap(config, '2D', {
    errorCallback: (error) => console.error('Map Error:', error)
});

// 3. Layer hinzufügen
map.addLayer('rental-prices-layer');
```

---

## 3. KONFIGURATIONSSTRUKTUR

### Portalconfig (portal.json)
```json
{
  "target": "map-div-id",
  "epsg": "EPSG:25832",
  "extent": [510000.0, 5850000.0, 625000.4, 6000000.0],
  "startResolution": 132.291595229,
  "startCenter": [565874, 5934140],
  "namedProjections": [
    ["EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +units=m"],
    ["EPSG:4326", "+proj=longlat +ellps=WGS84"]
  ],
  "options": [
    { "resolution": 264.583, "scale": 1000000, "zoomLevel": 0 },
    { "resolution": 132.292, "scale": 500000, "zoomLevel": 1 }
  ],
  "layerConf": "https://geodienste.hamburg.de/services.json",
  "styleConf": "https://geodienste.hamburg.de/style_v3.json",
  "layers": [
    {
      "id": "rental-layer-id",
      "name": "Mietpreise",
      "typ": "GeoJSON",
      "renderer": "webgl",
      "styleId": "rental-choropleth"
    }
  ]
}
```

### Services Definition (services.json)
```json
[
  {
    "id": "rental-choropleth",
    "name": "Mietpreise nach Stadtteil",
    "typ": "GeoJSON",
    "url": "https://api.example.com/rental-data.geojson",
    "renderer": "webgl"
  },
  {
    "id": "rental-points",
    "name": "Mietangebote",
    "typ": "GeoJSON",
    "url": "https://api.example.com/rental-listings.geojson",
    "renderer": "webgl",
    "isPointLayer": true,
    "hitTolerance": 20
  },
  {
    "id": "background-map",
    "name": "Basiskarte",
    "typ": "WMS",
    "url": "https://geodienste.hamburg.de/HH_WMS_HamburgDE",
    "layers": "Geobasiskarten_HHde",
    "format": "image/png",
    "version": "1.3.0",
    "transparent": true,
    "singleTile": false,
    "tilesize": 512
  }
]
```

---

## 4. API-ENDPOINTS & HAUPTFUNKTIONEN

### Karten-Verwaltung
```javascript
import mapsAPI from '@masterportal/masterportalapi/src/maps/api.js';

// 2D-Karte erstellen
const map2D = mapsAPI.map.createMap(config, '2D', settings);

// 3D-Karte erstellen (benötigt Cesium peer dependency)
const map3D = mapsAPI.map.createMap(config, '3D', settings);

// Layer dynamisch hinzufügen
map.addLayer('layer-id', {
    visibility: true,
    transparency: 0,
    errorCallback: (e) => console.error(e)
});

// Layer entfernen
map.removeLayer(layer);

// Layer Sichtbarkeit kontrollieren
layer.setVisible(true);

// Transparenz/Opacity setzen
layer.setOpacity(0.7);  // 0-1, wobei 1 = vollständig opak
```

### Layer-Quellen und Management
```javascript
import * as mpapi from '@masterportal/masterportalapi';

// **GeoJSON Layer**
const geoJsonLayer = mpapi.geojson.createLayer({
    id: 'rental-zones',
    url: 'https://api.example.com/zones.geojson',
    typ: 'GeoJSON'
}, {
    layerParams: {
        renderer: 'webgl',
        styleId: 'choropleth-style'
    }
});

// **WMS Layer**
const wmsLayer = mpapi.wms.createLayer({
    id: 'background',
    url: 'https://geodienste.hamburg.de/HH_WMS',
    layers: 'Geobasiskarten',
    typ: 'WMS',
    version: '1.3.0',
    format: 'image/png'
}, {layerParams: {}});

// **WFS Layer (Vektor-Features)**
const wfsLayer = mpapi.wfs.createLayer({
    id: 'rental-addresses',
    url: 'https://geodienste.hamburg.de/HH_WFS_Dienst',
    featureType: 'rental_addresses',
    typ: 'WFS',
    version: '1.1.0'
}, {layerParams: {}});

// **OAF (OGC API - Features) Layer**
const oafLayer = mpapi.oaf.createLayer({
    id: 'rental-points',
    url: 'https://api.hamburg.de/datasets/v1/rental',
    collection: 'rental_listings',
    typ: 'OAF'
}, {layerParams: {}});

// **WMTS Layer (Tile Matrix Set)**
const wmtsLayer = mpapi.wmts.createLayer({
    id: 'aerial',
    url: 'https://geodienste.hamburg.de/HH_WMTS',
    typ: 'WMTS',
    matrixSet: 'GoogleMapsCompatible_Level5'
}, {layerParams: {}});
```

### Ping (Service Availability Check)
```javascript
// Service-Verfügbarkeit prüfen
mpapi.ping({url: 'https://api.example.com/service'})
    .then(statusCode => console.log(`Service online, Status: ${statusCode}`))
    .catch(err => console.error('Service down:', err));
```

### Search Address (Adresssuche)
```javascript
// Nach Adresse oder Straße suchen
mpapi.search('Eiffelstraße 1, Hamburg', {
    map: map,
    zoom: true,
    zoomToParams: {duration: 1000, maxZoom: 8},
    searchStreets: true,
    searchAddress: true
})
.then(results => console.log('Search results:', results))
.catch(err => console.error('Search failed:', err));
```

---

## 5. LAYER-MANAGEMENT FÜR DATENVISUALISIERUNG

### GeoJSON Layer mit Heatmap/Clustering
```javascript
// Clustering-basierte Visualisierung
const rentalLayer = mpapi.geojson.createLayer({
    id: 'rental-points',
    url: 'https://api.example.com/rental-listings.geojson',
    clusterDistance: 80,  // Pixel-Abstand für Clustering
    renderer: 'webgl'
}, {
    layerParams: {
        renderer: 'webgl',
        isPointLayer: true
    },
    afterLoading: (features) => {
        console.log(`${features.length} Features geladen`);
    }
});

map.addLayer(rentalLayer);
```

### Choropleth-Darstellung (Data-Driven Styling)
```javascript
// Mietpreise nach Wert färben
const portalConfig = {
    target: 'map',
    layers: [{
        id: 'rental-choropleth',
        name: 'Mietpreise €/m²',
        typ: 'GeoJSON',
        renderer: 'webgl',
        url: 'https://api.example.com/rental-zones.geojson',
        
        // WebGL-Styling mit Interpolation für Farbgradienten
        style: {
            // Farbinterpolation nach Mietpreis
            'circle-fill-color': [
                'interpolate',
                ['linear'],           // Interpolationsmethode
                ['get', 'rent_sqm'],  // Feature-Eigenschaft
                0,    [0, 200, 60],    // 0 €/m² = grün
                10,   [255, 255, 0],   // 10 €/m² = gelb
                20,   [255, 100, 0],   // 20 €/m² = orange
                30    [200, 0, 0]      // 30+ €/m² = rot
            ],
            
            // Größe auch nach Daten skalieren
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'popularity'],
                0, 5,    // 0 Popularity = 5px
                100, 15  // 100 Popularity = 15px
            ],
            
            'circle-opacity': 0.8,
            'circle-rotate-with-view': true
        }
    }]
};

const map = mapsAPI.map.createMap(portalConfig, '2D');
```

### WMS Layer mit CQL Filter
```javascript
// WMS mit Datendefiniert aktiviertem Filter
const wmsRentalLayer = {
    id: 'wms-rental',
    typ: 'WMS',
    url: 'https://geodienste.hamburg.de/HH_WMS',
    layers: 'rental_zones',
    cqlFilter: "rent_sqm > 15 AND rent_sqm < 25",  // Nur 15-25 €/m²
    version: '1.3.0',
    format: 'image/png',
    transparent: true
};

// In Services-Definition aufnehmen und laden
map.addLayer('wms-rental');
```

### Heatmap mit Kernel-Renderer
```javascript
// Heatmap mit Kernel Density Estimation
import {Heatmap} from 'ol/layer';
import {Vector as VectorSource} from 'ol/source';

const heatmapLayer = new Heatmap({
    source: new VectorSource({
        // Mietangebote als Quellpunkte
        url: 'https://api.example.com/rental-offers.geojson',
        format: new GeoJSON()
    }),
    blur: 15,          // Blur-Effekt (Pixel)
    radius: 20,        // Radius pro Point (Pixel)
    weight: (feature) => {
        // Gewichtung nach Mietpreis
        return (feature.get('rent_per_sqm') - 10) / 20;
    },
    gradient: [
        '#00f', // Blau (niedrig)
        '#0ff', // Cyan
        '#0f0', // Grün
        '#ff0', // Gelb
        '#f00'  // Rot (hoch)
    ]
});
```

---

## 6. DATENQUELLEN-INTEGRATION

### GeoJSON von externen APIs laden
```javascript
// Beispiel: Mietpreisdaten von REST-API
async function loadRentalData() {
    const response = await fetch('https://api.example.com/rental-prices');
    const geoJsonData = await response.json();
    
    const rentalLayer = {
        id: 'live-rental-data',
        typ: 'GeoJSON',
        features: geoJsonData.features,  // Direkt übergeben
        renderer: 'webgl'
    };
    
    // Layer registrieren und hinzufügen
    const services = mpapi.rawLayerList.getLayerList();
    services.push(rentalLayer);
    
    map.addLayer('live-rental-data');
}
```

### WFS (Web Feature Service) Integration
```javascript
// WFS für direkte Feature-Abfragen
const wfsRentalLayer = {
    id: 'rental-wfs',
    name: 'Wohnungen (WFS)',
    url: 'https://geodienste.hamburg.de/HH_WFS_Rental',
    typ: 'WFS',
    featureType: 'apartments',      // Feature-Type vom Server
    outputFormat: 'application/json', // oder XML
    version: '2.0.0',
    featureNS: 'http://rental.hamburg.de',
    maxFeatures: 1000,
    
    // Filter-Optionen
    cqlFilter: "status='available' AND rent_sqm < 20"
};

// Laden mit Error-Handling
map.addLayer('rental-wfs', {
    errorCallback: (event) => {
        console.error(`WFS Error für Layer rental-wfs:`, event);
    }
});
```

### OAF (OGC API - Features) Integration
```javascript
// Moderner OGC API Standard
const oafRentalLayer = {
    id: 'rental-oaf',
    name: 'Mietangebote (OAF)',
    url: 'https://api.hamburg.de/collections/rental_listings',
    typ: 'OAF',
    collection: 'rental_listings',
    crs: 'http://www.opengis.net/def/crs/EPSG/0/25832',
    
    // Pagination & Limits
    limit: 1000,
    
    // Eigenschaften-Filter
    properties: ['id', 'address', 'price', 'sqm', 'rooms']
};

mpapi.rawLayerList.getLayerList().push(oafRentalLayer);
map.addLayer('rental-oaf');
```

### Echtzeitdaten-Polling
```javascript
// Periodisches Neuladen von Mietpreisdaten
const refreshDataInterval = setInterval(async () => {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-choropleth');
    
    if (!layer) return;
    
    const source = layer.getSource();
    const response = await fetch('https://api.example.com/rental-zones');
    const newData = await response.json();
    
    source.clear();
    source.addFeatures(
        new GeoJSON().readFeatures(newData)
    );
}, 60000);  // Alle 60 Sekunden aktualisieren
```

---

## 7. STYLING & VISUALIZATION

### Default Canvas Renderer
```javascript
import {Style, Fill, Stroke, Icon, Text} from 'ol/style';

// Klassisches OL-Styling
const rentalStyle = new Style({
    fill: new Fill({
        color: 'rgba(255, 100, 0, 0.3)'  // Orange mit Transparenz
    }),
    stroke: new Stroke({
        color: '#ff6400',
        width: 2
    }),
    text: new Text({
        text: 'Mietpreis',
        fill: new Fill({color: '#000'})
    })
});

const layer = mpapi.geojson.createLayer({
    id: 'rentals',
    url: 'https://api.example.com/data.geojson'
}, {
    layerStyle: rentalStyle
});

// Custom Styles pro Feature
mpapi.geojson.setCustomStyles({
    Point: new Style({
        image: new Icon({
            src: 'https://cdn.example.com/rent-icon.png',
            scale: 0.5
        })
    }),
    Polygon: new Style({
        fill: new Fill({color: 'rgba(0, 0, 255, 0.2)'})
    })
});
```

### WebGL Styling (High-Performance)
```javascript
// Advanced WebGL Expression-based Styling
const webglConfig = {
    target: 'map',
    layers: [{
        id: 'rental-webgl',
        typ: 'GeoJSON',
        renderer: 'webgl',
        url: 'https://api.example.com/rentals.geojson',
        style: {
            // Farbe basierend auf Kategorie
            'circle-fill-color': [
                'match',
                ['get', 'apartment_type'],
                '1-room',   '#ff0000',
                '2-room',   '#ff7700',
                '3-room',   '#ffcc00',
                '4+-room',  '#00ff00',
                '#cccccc'   // Default
            ],
            
            // Größe basierend auf Preis/m²
            'circle-radius': [
                'interpolate',
                ['exponential', 2],  // Exponentielle Interpolation
                ['get', 'rent_sqm'],
                10, 3,    // Bei 10 €/m² = 3px
                30, 15    // Bei 30 €/m² = 15px
            ],
            
            'circle-opacity': 0.85,
            'circle-stroke-color': '#000',
            'circle-stroke-width': 1
        }
    }]
};

const map = mapsAPI.map.createMap(webglConfig, '2D');
```

### Conditional Styling
```javascript
// Bedingte Stylelierung nach Feature-Eigenschaften
const conditionalStyle = {
    'polygon-fill-color': [
        'case',
        ['<', ['get', 'rent_sqm'], 12],
        '#00aa00',        // Grün: günstig
        ['<', ['get', 'rent_sqm'], 18],
        '#ffff00',        // Gelb: mittel
        ['<', ['get', 'rent_sqm'], 25],
        '#ff8800',        // Orange: teuer
        '#ff0000'         // Rot: sehr teuer
    ],
    'polygon-stroke-color': '#333',
    'polygon-stroke-width': 2,
    'polygon-opacity': 0.7
};
```

---

## 8. 3D-VISUALISIERUNG

### 3D-Karte mit Cesium
```javascript
// 3D-Support aktivieren
import load3DScript from '@masterportal/masterportalapi/src/lib/load3DScript';

// Cesium Library laden
load3DScript('https://geoportal-hamburg.de/mastercode/cesium/latest/Cesium.js', 
    function callback3DLoaded() {
        // Nach dem Laden der 3D-Library
        const map3D = mapsAPI.map.createMap({
            map2D: map2D,
            cesiumParameter: {
                fxaa: true,
                globe: {
                    enableLighting: true,
                    maximumScreenSpaceError: 2,
                    tileCacheSize: 20
                }
            }
        }, '3D');
        
        map3D.setEnabled(true);
    }
);
```

### 3D Tileset Layer (z.B. 3D Gebäude)
```javascript
// 3D Gebäudemodelle (LoD2)
const tileset3D = {
    id: '3d-buildings',
    name: 'Gebäude LoD2',
    url: 'https://daten-hamburg.de/gdi3d/datasource-data/LoD2',
    typ: 'TileSet3D',
    styleId: '3DTileSetStyle',
    cesium3DTilesetOptions: {
        maximumScreenSpaceError: 6
    }
};

// Gelände-Layer
const terrain = {
    id: 'terrain',
    name: 'Gelände',
    url: 'https://daten-hamburg.de/gdi3d/datasource-data/Gelaende',
    typ: 'Terrain3D',
    cesiumTerrainProviderOptions: {
        requestVertexNormals: true
    }
};

// Entities (einzelne 3D-Objekte)
const buildings = mpapi.entities.createLayer({
    id: '3d-entities',
    typ: 'Entities3D',
    entities: [
        {
            url: 'https://cdn.example.com/building.glb',
            latitude: 53.5631,
            longitude: 9.9800,
            height: 25,
            scale: 1,
            allowPicking: true
        }
    ]
}, map3D);
```

---

## 9. FEHLERBEHANDLUNG

### Fehler-Callbacks
```javascript
// Globaler Error Callback
function handleLayerError(errorEvent) {
    console.error('Layer Error Event:', {
        type: errorEvent.type,
        message: errorEvent.message,
        tile: errorEvent.tile || null
    });
    
    // Layer aus Karte entfernen bei kritischem Fehler
    if (errorEvent.type === 'error') {
        console.warn('Removing layer due to critical error');
    }
}

// Bei Map-Erstellung
const map = mapsAPI.map.createMap(config, '2D', {
    errorCallback: handleLayerError
});

// Bei Layer-Addition
map.addLayer('rental-layer', {
    errorCallback: (event) => {
        console.error(`Layer 'rental-layer' Error:`, event);
    }
});
```

### Service Availability Check
```javascript
// Vor dem Laden Layer-Verfügbarkeit prüfen
async function ensureServiceAvailable(serviceUrl) {
    try {
        const statusCode = await mpapi.ping({url: serviceUrl});
        if (statusCode === 200) {
            console.log('✓ Service verfügbar');
            return true;
        }
    } catch (error) {
        console.error(`✗ Service nicht erreichbar: ${error}`);
        return false;
    }
}

// Verwendung
if (await ensureServiceAvailable('https://api.example.com/rental')) {
    map.addLayer('rental-data');
}
```

---

## 10. PRAKTISCHES BEISPIEL: MIETSPIEGEL-INTEGRATION

### Vollständiges Setup
```javascript
// 1. Imports
import * as mpapi from '@masterportal/masterportalapi';
import mapsAPI from '@masterportal/masterportalapi/src/maps/api.js';
import 'ol/ol.css';

// 2. Konfiguration
const rentalMapConfig = {
    target: 'rental-map',
    epsg: 'EPSG:25832',
    extent: [510000, 5850000, 625000, 6000000],
    startCenter: [565874, 5934140],
    startResolution: 132.29,
    
    // Services Definition
    layerConf: [
        {
            id: 'base-map',
            name: 'Basiskarte',
            typ: 'WMS',
            url: 'https://geodienste.hamburg.de/HH_WMS_HamburgDE',
            layers: 'Geobasiskarten_HHde',
            format: 'image/png',
            version: '1.3.0',
            transparent: true
        },
        {
            id: 'rental-choropleth',
            name: 'Mietpreise nach Stadtteil',
            typ: 'GeoJSON',
            url: 'https://api.example.com/rental-zones.geojson',
            renderer: 'webgl'
        },
        {
            id: 'rental-points',
            name: 'Aktuelle Angebote',
            typ: 'GeoJSON',
            url: 'https://api.example.com/rental-listings.geojson',
            renderer: 'webgl',
            isPointLayer: true,
            clusterDistance: 80
        }
    ],
    
    // Initial sichtbare Layer
    layers: [
        {
            id: 'base-map'
        },
        {
            id: 'rental-choropleth',
            renderer: 'webgl',
            style: {
                'circle-fill-color': [
                    'interpolate', ['linear'], ['get', 'rent_sqm'],
                    10, [0, 200, 60],      // Grün
                    15, [255, 255, 0],     // Gelb
                    20, [255, 100, 0],     // Orange
                    25, [200, 0, 0]        // Rot
                ],
                'circle-opacity': 0.75
            }
        }
    ]
};

// 3. Karte initialisieren
const map = mapsAPI.map.createMap(rentalMapConfig, '2D', {
    errorCallback: (error) => {
        console.error('Map Error:', error);
        // User-Feedback anzeigen
        showNotification('Fehler beim Laden der Kartendaten');
    }
});

// 4. Dynamische Layer-Verwaltung
document.getElementById('toggle-choropleth').addEventListener('click', () => {
    const layer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-choropleth');
    layer?.setVisible(!layer.getVisible());
});

// 5. Such-Funktionalität
document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value;
    const results = await mpapi.search(query, {
        map: map,
        zoom: true,
        zoomToParams: {duration: 800, maxZoom: 12}
    });
    console.log('Suchergebnisse:', results);
});

// 6. Echtzeitdaten-Refresh
setInterval(async () => {
    const source = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-points')
        ?.getSource();
    
    if (source) {
        const response = await fetch('https://api.example.com/latest-listings');
        const newData = await response.json();
        source.clear();
        source.addFeatures(
            new GeoJSON().readFeatures(newData)
        );
    }
}, 120000);  // Alle 2 Min aktualisieren
```

---

## 11. ABHÄNGIGKEITEN & VERSIONEN

| Paket | Version | Zweck |
|-------|---------|-------|
| **ol** | 10.9.0 | Core Mapping Library |
| **ol-mapbox-style** | 13.3.0 | Mapbox Style Integration |
| **olcs** | 2.23.0 | 3D Support (Cesium) |
| **proj4** | 2.10.0 | Koordinatentransformation |
| **xml2js** | 0.6.2 | WFS/XML Parsing |
| **dayjs** | 1.11.10 | Datum-Utilities |
| **@cesium/engine** | 23.0.0 | 3D Rendering (Peer Dependency) |

---

## 12. BEST PRACTICES FÜR MIETSPIEGEL

### Performance-Optimierung
```javascript
// Nur notwendige Features laden
const config = {
    ...rentalMapConfig,
    layerConf: rentalMapConfig.layerConf.map(service => {
        if (service.id === 'rental-points') {
            service.maxFeatures = 500;  // Limit
            service.bbox = [510000, 5850000, 625000, 6000000];
        }
        return service;
    })
};

// WebGL Renderer für große Datenmengen
const setupForLargeDataset = {
    renderer: 'webgl',
    isPointLayer: true,
    excludeTypesFromParsing: ['unknown']
};
```

### Daten-Caching
```javascript
// Layer-Daten lokal cachen
const cachedLayers = new Map();

async function getCachedLayer(layerId) {
    if (!cachedLayers.has(layerId)) {
        const response = await fetch(`/api/layer/${layerId}`);
        const data = await response.json();
        cachedLayers.set(layerId, data);
    }
    return cachedLayers.get(layerId);
}
```

### Filter & Suche
```javascript
// Effiziente Filterung mit CQL
function filterRentalsByPrice(maxPrice) {
    const services = mpapi.rawLayerList.getLayerList();
    const wmsService = services.find(s => s.id === 'rental-wms');
    
    if (wmsService) {
        wmsService.cqlFilter = `rent_sqm < ${maxPrice}`;
        map.addLayer('rental-wms');
    }
}
```

---

## 13. DOKUMENTATION & RESSOURCEN

- **Official Docs**: https://masterportal.org
- **Repository**: https://bitbucket.org/geowerkstatt-hamburg/masterportalapi
- **OpenLayers Docs**: https://openlayers.org/doc/
- **OGC Standards**: https://www.ogc.org/
- **Hamburg GDI Services**: https://geodienste.hamburg.de/

---

**Ende des Leitfadens** | MasterPortal API 2.61.0
