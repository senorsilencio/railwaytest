/**
 * MasterPortal API - Mietspiegel Geoportal Integration
 * Praktisches Beispiel zur Visualisierung von Mietpreisdaten
 * 
 * Verwendung:
 * 1. npm install @masterportal/masterportalapi
 * 2. Konfigurieren Sie die API-Endpoints in den Config-Objekten
 * 3. Ersetzen Sie 'rental-map' mit Ihrer Ziel-Div-ID
 */

import * as mpapi from '@masterportal/masterportalapi';
import mapsAPI from '@masterportal/masterportalapi/src/maps/api.js';
import { GeoJSON } from 'ol/format';
import 'ol/ol.css';

// ============================================================================
// KONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://api.example.com';

const RENTAL_MAP_CONFIG = {
    target: 'rental-map',  // Div-ID in HTML
    epsg: 'EPSG:25832',    // UTM Zone 32N (Hamburg)
    extent: [510000, 5850000, 625000, 6000000],
    startCenter: [565874, 5934140],
    startResolution: 132.29,
    
    namedProjections: [
        ['EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs'],
        ['EPSG:4326', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs']
    ],
    
    options: [
        { resolution: 264.583, scale: 1000000, zoomLevel: 0 },
        { resolution: 132.292, scale: 500000, zoomLevel: 1 },
        { resolution: 66.146, scale: 250000, zoomLevel: 2 },
        { resolution: 26.458, scale: 100000, zoomLevel: 3 },
        { resolution: 10.583, scale: 40000, zoomLevel: 5 },
        { resolution: 2.646, scale: 10000, zoomLevel: 7 },
        { resolution: 1.323, scale: 5000, zoomLevel: 8 },
        { resolution: 0.132, scale: 500, zoomLevel: 11 }
    ],
    
    // Service-Registry
    layerConf: [
        {
            id: 'base-map',
            name: 'Basiskarte Hamburg',
            typ: 'WMS',
            url: 'https://geodienste.hamburg.de/HH_WMS_HamburgDE',
            layers: 'Geobasiskarten_HHde',
            format: 'image/png',
            version: '1.3.0',
            transparent: true,
            singleTile: false,
            tilesize: 512
        },
        {
            id: 'rental-zones-choropleth',
            name: 'Mietpreise nach Stadtteil',
            typ: 'GeoJSON',
            url: `${API_BASE_URL}/rental-zones-choropleth.geojson`,
            renderer: 'webgl'
        },
        {
            id: 'rental-listings',
            name: 'Aktuelle Mietangebote',
            typ: 'GeoJSON',
            url: `${API_BASE_URL}/rental-listings.geojson`,
            renderer: 'webgl',
            isPointLayer: true,
            clusterDistance: 80
        },
        {
            id: 'rental-wfs',
            name: 'Wohnungen (WFS-Service)',
            typ: 'WFS',
            url: 'https://geodienste.hamburg.de/HH_WFS_Rental',
            featureType: 'apartments',
            outputFormat: 'application/json',
            version: '2.0.0'
        }
    ],
    
    // Initial sichtbare Layer
    layers: [
        {
            id: 'base-map'
        },
        {
            id: 'rental-zones-choropleth',
            renderer: 'webgl'
        }
    ]
};

// ============================================================================
// STYLING DEFINITIONEN
// ============================================================================

/**
 * Choropleth Stil für Mietpreise
 * Interpoliert Farben basierend auf property 'rent_sqm'
 */
const CHOROPLETH_STYLE = {
    'polygon-fill-color': [
        'interpolate',
        ['linear'],           // Lineare Interpolation
        ['get', 'rent_sqm'],  // Feature-Property
        10,   [0, 200, 60],     // < 10 €/m² = Grün
        12,   [144, 238, 144],  // 10-12 = Light Green
        15,   [255, 255, 0],    // 12-15 = Gelb
        18,   [255, 215, 0],    // 15-18 = Gold
        20,   [255, 140, 0],    // 18-20 = Orange
        25,   [255, 69, 0],     // 20-25 = Orange-Red
        30,   [220, 20, 60],    // 25-30 = Crimson
        1000, [128, 0, 0]       // > 30 = Dunkelrot
    ],
    'polygon-stroke-color': '#333333',
    'polygon-stroke-width': 1.5,
    'polygon-opacity': 0.75
};

/**
 * Stil für Mietangebots-Punkte
 * Größe und Farbe basierend auf Preis
 */
const POINTS_STYLE = {
    'circle-radius': [
        'interpolate',
        ['exponential', 1.5],
        ['get', 'rent_total'],    // Gesamtmiete
        500,  4,                  // 500€ = 4px
        2500, 12                  // 2500€ = 12px
    ],
    
    'circle-fill-color': [
        'match',
        ['get', 'room_count'],
        1, '#ff6b6b',             // 1-Zimmer = Rot
        2, '#ffd93d',             // 2-Zimmer = Gelb
        3, '#6bcf7f',             // 3-Zimmer = Grün
        4, '#4d96ff',             // 4-Zimmer = Blau
        '#cccccc'                 // Sonstige = Grau
    ],
    
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2,
    'circle-opacity': 0.8
};

/**
 * Stil für Cluster
 */
const CLUSTER_STYLE = {
    'circle-radius': [
        'interpolate',
        ['linear'],
        ['feature-state', 'cluster_count'],
        2, 8,
        50, 25
    ],
    'circle-fill-color': '#3399cc',
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 2
};

// ============================================================================
// MAP INITIALISIERUNG
// ============================================================================

let map = null;
let rentalPointsLayer = null;
let rentalChoropletLayer = null;

/**
 * Initialisiert die Mietspiegel-Karte
 */
async function initializeRentalMap() {
    console.log('Initializing Rental Price Map...');
    
    try {
        // Karte erstellen
        map = mapsAPI.map.createMap(RENTAL_MAP_CONFIG, '2D', {
            errorCallback: handleMapError
        });
        
        // Logging
        console.log('✓ Map created successfully');
        console.log(`✓ Initial zoom level: ${map.getView().getZoom()}`);
        
        // Layer hinzufügen
        await loadRentalLayers();
        
        // Event Listener registrieren
        setupEventListeners();
        
        // UI initialisieren
        initializeUI();
        
        console.log('✓ Rental Map fully initialized');
        
    } catch (error) {
        console.error('✗ Map initialization failed:', error);
        showNotification('Fehler beim Laden der Karte', 'error');
    }
}

/**
 * Erforderliche Rental-Layer laden
 */
async function loadRentalLayers() {
    // Layer-Verfügbarkeit prüfen
    const services = [
        RENTAL_MAP_CONFIG.layerConf[1],  // rental-zones-choropleth
        RENTAL_MAP_CONFIG.layerConf[2]   // rental-listings
    ];
    
    for (const service of services) {
        try {
            const statusCode = await mpapi.ping({url: service.url});
            console.log(`✓ Service '${service.id}' reachable (${statusCode})`);
            
            // Layer zur Karte hinzufügen
            map.addLayer(service.id, {
                errorCallback: (error) => {
                    console.error(`Layer '${service.id}' Error:`, error);
                }
            });
            
        } catch (error) {
            console.warn(`✗ Service '${service.id}' not available:`, error);
            showNotification(`Layer ${service.name} konnte nicht geladen werden`, 'warning');
        }
    }
}

/**
 * Fehlerbehandlung für Karten-Events
 */
function handleMapError(errorEvent) {
    console.error('Map Error Event:', {
        type: errorEvent.type,
        message: errorEvent.message,
        tile: errorEvent.tile
    });
    
    // Spezifische Error-Typen behandeln
    switch (errorEvent.type) {
        case 'tileloaderror':
            console.warn('Tile loading failed, may be temporary');
            break;
        case 'imageloaderror':
            console.error('Image loading failed');
            break;
        case 'error':
            console.error('Critical map error');
            showNotification('Kartenfehler - Bitte aktualisieren Sie die Seite', 'error');
            break;
    }
}

// ============================================================================
// DATEN-MANIPULATION
// ============================================================================

/**
 * Externe Mietpreisdaten von API laden
 * @returns {Promise<GeoJSON>}
 */
async function fetchRentalData() {
    try {
        const response = await fetch(`${API_BASE_URL}/rental-zones.geojson`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const geoJsonData = await response.json();
        console.log(`✓ Loaded ${geoJsonData.features.length} features`);
        
        return geoJsonData;
        
    } catch (error) {
        console.error('Failed to fetch rental data:', error);
        showNotification('Fehler beim Laden der Mietpreisdaten', 'error');
        return null;
    }
}

/**
 * Rental-Daten mit GeoJSON aktualisieren
 */
async function updateRentalData() {
    if (!map) return;
    
    const choropletLayer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-zones-choropleth');
    
    if (!choropletLayer) {
        console.warn('Choropleth layer not found');
        return;
    }
    
    const source = choropletLayer.getSource();
    const newData = await fetchRentalData();
    
    if (newData) {
        source.clear();
        const features = new GeoJSON().readFeatures(newData);
        source.addFeatures(features);
        console.log('✓ Rental data updated');
    }
}

/**
 * Mietpreise nach Filter filtern
 * @param {number} minPrice - Mindesmiete €/m²
 * @param {number} maxPrice - Maximalmiete €/m²
 */
function filterRentalsByPrice(minPrice, maxPrice) {
    const pointsLayer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-listings');
    
    if (!pointsLayer) return;
    
    const source = pointsLayer.getSource();
    source.forEachFeature(feature => {
        const rent = feature.get('rent_sqm');
        const isInRange = rent >= minPrice && rent <= maxPrice;
        feature.set('visible', isInRange);
    });
    
    console.log(`✓ Filtered to ${minPrice}-${maxPrice} €/m²`);
}

/**
 * Mietpreise nach Zimmeranzahl filtern
 * @param {number} roomCount - Anzahl Zimmer
 */
function filterRentalsByRooms(roomCount) {
    const pointsLayer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-listings');
    
    if (!pointsLayer) return;
    
    const source = pointsLayer.getSource();
    source.forEachFeature(feature => {
        const rooms = feature.get('room_count');
        feature.set('visible', rooms === roomCount);
    });
    
    console.log(`✓ Filtered to ${roomCount}-room apartments`);
}

// ============================================================================
// SEARCH & ZOOM
// ============================================================================

/**
 * Nach Adresse suchen und zur Position zoomen
 * @param {string} query - Suchbegriff (z.B. "Eiffelstraße 1 Hamburg")
 */
async function searchAddress(query) {
    try {
        const results = await mpapi.search(query, {
            map: map,
            zoom: true,
            zoomToParams: {
                duration: 1000,
                maxZoom: 14
            },
            searchAddress: true,
            searchStreets: true
        });
        
        console.log('✓ Search results:', results);
        showNotification(`Found ${results.length} results`);
        
        return results;
        
    } catch (error) {
        console.error('✗ Search failed:', error);
        showNotification('Adresssuche fehlgeschlagen', 'error');
    }
}

/**
 * Zu Extent/Bounds zoomen
 * @param {number[]} extent - [minX, minY, maxX, maxY]
 */
function zoomToExtent(extent) {
    if (!map) return;
    
    const view = map.getView();
    const size = map.getSize();
    
    view.fit(extent, {
        size: size,
        duration: 1000,
        padding: [50, 50, 50, 50]
    });
    
    console.log('✓ Zoomed to extent');
}

/**
 * Zu Koordinaten zoomen
 * @param {number[]} center - [x, y]
 * @param {number} zoomLevel - Zoom-Level
 */
function zoomToLocation(center, zoomLevel = 11) {
    if (!map) return;
    
    const view = map.getView();
    view.animate({
        center: center,
        zoom: zoomLevel,
        duration: 1000
    });
    
    console.log(`✓ Zoomed to ${center} (Level ${zoomLevel})`);
}

// ============================================================================
// UI & EVENT HANDLING
// ============================================================================

/**
 * Event Listener für Benutzerinteraktionen
 */
function setupEventListeners() {
    if (!map) return;
    
    // Click-Events auf Features
    map.on('click', (event) => {
        map.forEachFeatureAtPixel(event.pixel, (feature) => {
            console.log('Feature clicked:', feature.getProperties());
            showFeatureDetails(feature);
        });
    });
    
    // Zoom-Level-Änderungen
    map.getView().on('change:resolution', () => {
        const zoomLevel = map.getView().getZoom();
        console.log('Zoom level changed:', zoomLevel);
        updateUIForZoom(zoomLevel);
    });
}

/**
 * UI-Elemente initialisieren (Buttons, Filter, etc.)
 */
function initializeUI() {
    // Search Button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = document.getElementById('search-input')?.value;
            if (query) searchAddress(query);
        });
    }
    
    // Price Filter
    const priceSlider = document.getElementById('price-filter');
    if (priceSlider) {
        priceSlider.addEventListener('change', (e) => {
            const maxPrice = parseInt(e.target.value);
            filterRentalsByPrice(0, maxPrice);
        });
    }
    
    // Room Filter
    const roomFilters = document.querySelectorAll('[data-room-filter]');
    roomFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            const roomCount = parseInt(btn.dataset.roomFilter);
            filterRentalsByRooms(roomCount);
        });
    });
    
    // Refresh Button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', updateRentalData);
    }
    
    // Layer Visibility Toggles
    const layerToggles = document.querySelectorAll('[data-layer-toggle]');
    layerToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const layerId = toggle.dataset.layerToggle;
            const layer = map.getLayers()
                .getArray()
                .find(l => l.get('id') === layerId);
            
            if (layer) {
                layer.setVisible(e.target.checked);
            }
        });
    });
}

/**
 * Feature-Details Popup anzeigen
 * @param {Feature} feature
 */
function showFeatureDetails(feature) {
    const props = feature.getProperties();
    
    let html = '<div class="feature-popup">';
    html += '<h3>' + (props.name || 'Feature') + '</h3>';
    html += '<table>';
    
    Object.entries(props).forEach(([key, value]) => {
        if (key !== 'geometry') {
            html += `<tr><td><strong>${key}:</strong></td><td>${value}</td></tr>`;
        }
    });
    
    html += '</table></div>';
    
    // Optional: Modal/Modal anzeigen oder Toast
    console.log('Feature details:', props);
}

/**
 * UI basierend auf Zoom-Level aktualisieren
 * @param {number} zoomLevel
 */
function updateUIForZoom(zoomLevel) {
    const choropletLayer = map.getLayers()
        .getArray()
        .find(l => l.get('id') === 'rental-zones-choropleth');
    
    // Bei niedrigem Zoom nur Choropleth, nicht Punkte
    if (zoomLevel < 10) {
        // Punkte-Layer ausblenden
        const pointsLayer = map.getLayers()
            .getArray()
            .find(l => l.get('id') === 'rental-listings');
        
        if (pointsLayer) pointsLayer.setVisible(false);
        if (choropletLayer) choropletLayer.setVisible(true);
        
    } else {
        // Bei hohem Zoom Punkte zeigen, Choropleth ausblenden
        if (choropletLayer) choropletLayer.setVisible(false);
    }
}

// ============================================================================
// BENACHRICHTIGUNGEN
// ============================================================================

/**
 * Benutzer-Benachrichtigung anzeigen
 * @param {string} message
 * @param {string} type - 'info', 'warning', 'error'
 */
function showNotification(message, type = 'info') {
    // In real app: Toast, Modal, oder Notification API
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Beispiel mit DOM
    const notifDiv = document.getElementById('notification');
    if (notifDiv) {
        notifDiv.className = `notification notification-${type}`;
        notifDiv.textContent = message;
        notifDiv.style.display = 'block';
        
        setTimeout(() => {
            notifDiv.style.display = 'none';
        }, 5000);
    }
}

// ============================================================================
// EXPORT & INITIALISIERUNG
// ============================================================================

// Auto-Initialize wenn DOM ready
document.addEventListener('DOMContentLoaded', initializeRentalMap);

// Exports für externe Verwendung
export {
    map,
    initializeRentalMap,
    fetchRentalData,
    updateRentalData,
    filterRentalsByPrice,
    filterRentalsByRooms,
    searchAddress,
    zoomToExtent,
    zoomToLocation
};
