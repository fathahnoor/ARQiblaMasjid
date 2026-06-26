/**
 * ============================================================================
 * ARQiblaMasjid - Core Application Logic
 * ============================================================================
 * UI Source : stitch_arqiblamasjid_ar_ui/ (Google Stitch-generated markup)
 * How to run: Serve index.html via HTTPS on a mobile device.
 *             Grant location & motion sensor permissions when prompted.
 * ============================================================================
 */

/* ==========================================================================
   0. CONSTANTS & STATE
   ========================================================================== */

const KABAH = Object.freeze({
  lat: 21.4224779,
  lon: 39.8251832,
  name: "Ka'bah, Masjid al-Haram",
});

const EARTH_RADIUS_KM = 6371;

/** Error margin assumed for Qibla bearing (degrees). */
const QIBLA_ERROR_MARGIN = 3;

/** Search radius for nearby mosques (kilometres). */
const SEARCH_RADIUS_KM = 2;

/** Dummy mosque dataset (will be expanded or replaced with live data later). */
const MOSQUE_DATA = [
  { name: "Masjid Al-Ikhlas",     lat: 51.5194, lon: -0.0608 },
  { name: "East London Mosque",   lat: 51.5195, lon: -0.0630 },
  { name: "Brick Lane Jamme Masjid", lat: 51.5201, lon: -0.0706 },
  { name: "Masjid Tauhidul Islam", lat: 51.5278, lon: -0.0554 },
  { name: "Shah Jahan Mosque",    lat: 51.5132, lon: -0.0840 },
  { name: "Masjid Umar",          lat: 51.5170, lon: -0.0580 },
  { name: "London Central Mosque", lat: 51.5524, lon: -0.1728 },
  { name: "Finsbury Park Mosque", lat: 51.5644, lon: -0.1065 },
  { name: "Suleymaniye Mosque",   lat: 51.5208, lon: -0.0729 },
  { name: "Masjid Al-Tawhid",     lat: 51.5592, lon: -0.0955 },
];

/** Application state singleton. */
const AppState = {
  /** 'loading' | 'located' | 'error' */
  geoState: "loading",
  /** 'loading' | 'active' | 'error' | 'unsupported' */
  compassState: "loading",
  /** Current screen: 'home' | 'ar' | 'settings' */
  currentScreen: "home",

  /** Position from Geolocation API. */
  position: null, // { lat, lon, accuracy }

  /** Device heading in degrees 0-360 (true or magnetic north). */
  heading: null,

  /** Computed Qibla bearing from user to Ka'bah. */
  qiblaBearing: null,

  /** Distance from user to Ka'bah in km. */
  distanceToKabah: null,

  /** Nearby mosques within SEARCH_RADIUS_KM. */
  nearbyMosques: [],

  /** Callbacks for UI updates. */
  _listeners: [],

  /** Subscribe to state changes. */
  on(callback) { this._listeners.push(callback); },

  /** Emit state change to all listeners. */
  emit() { this._listeners.forEach(cb => cb(this)); },
};

/* ==========================================================================
   1. MATHEMATICAL UTILITIES
   ========================================================================== */

/** Convert degrees to radians. */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees. */
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Compute the Qibla bearing from a user's GPS location to the Ka'bah.
 * Uses the standard great-circle forward-azimuth formula.
 * @param {number} lat  User latitude  (degrees)
 * @param {number} lon  User longitude (degrees)
 * @returns {number} Bearing in degrees 0-360
 */
function computeQiblaBearing(lat, lon) {
  const φ1  = toRad(lat);
  const λ1  = toRad(lon);
  const φk  = toRad(KABAH.lat);
  const λk  = toRad(KABAH.lon);
  const Δλ  = λk - λ1;

  const y = Math.sin(Δλ) * Math.cos(φk);
  const x =
    Math.cos(φ1) * Math.sin(φk) -
    Math.sin(φ1) * Math.cos(φk) * Math.cos(Δλ);

  const θ = toDeg(Math.atan2(y, x));
  return ((θ % 360) + 360) % 360;
}

/**
 * Compute the great-circle distance between two GPS points (Haversine).
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometres
 */
function computeDistance(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Compute the bearing from point 1 to point 2.
 * @returns {number} Bearing in degrees 0-360
 */
function computeBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = toDeg(Math.atan2(y, x));
  return ((θ % 360) + 360) % 360;
}

/**
 * Format distance for display.
 * @param {number} km  Distance in km
 * @returns {string}
 */
function formatDistance(km) {
  if (km < 1) {
    return Math.round(km * 1000) + " m";
  }
  return km.toFixed(1) + " km";
}

/**
 * Compute the relative direction string from a bearing relative to qibla.
 * @param {number} bearing  Absolute bearing in degrees
 * @param {number} qibla    Qibla bearing in degrees
 * @returns {string}
 */
function relativeDirection(bearing, qibla) {
  let diff = bearing - qibla;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const abs = Math.abs(Math.round(diff));
  if (abs <= 5) return "aligned with Qibla";
  if (diff > 0) return abs + "° right";
  return abs + "° left";
}

/** Compass degree label (N, NE, E, SE, S, SW, W, NW). */
function compassLabel(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/* ==========================================================================
   2. GEOLOCATION
   ========================================================================== */

function initGeolocation() {
  if (!navigator.geolocation) {
    AppState.geoState = "error";
    AppState.emit();
    return;
  }

  AppState.geoState = "loading";
  AppState.emit();

  const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, options);

  // Also watch for updates
  AppState._geoWatchId = navigator.geolocation.watchPosition(
    onGeoSuccess,
    onGeoError,
    options
  );
}

function onGeoSuccess(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  AppState.position = { lat: latitude, lon: longitude, accuracy };
  AppState.geoState = "located";

  // Compute Qibla data
  AppState.qiblaBearing = computeQiblaBearing(latitude, longitude);
  AppState.distanceToKabah = computeDistance(latitude, longitude, KABAH.lat, KABAH.lon);

  // Compute nearby mosques
  computeNearbyMosques(latitude, longitude);

  AppState.emit();
}

function onGeoError(err) {
  AppState.geoState = "error";
  AppState._geoError = err;
  AppState.emit();
}

function computeNearbyMosques(lat, lon) {
  AppState.nearbyMosques = MOSQUE_DATA
    .map(m => {
      const dist = computeDistance(lat, lon, m.lat, m.lon);
      const bearing = computeBearing(lat, lon, m.lat, m.lon);
      return { ...m, distance: dist, bearing };
    })
    .filter(m => m.distance <= SEARCH_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance);
}

/* ==========================================================================
   3. DEVICE ORIENTATION (COMPASS)
   ========================================================================== */

function initOrientation() {
  if (!window.DeviceOrientationEvent) {
    AppState.compassState = "unsupported";
    AppState.emit();
    return;
  }

  // iOS 13+ requires explicit permission request on user gesture
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    AppState.compassState = "requesting";
    AppState.emit();
    // Will be triggered by a button tap; see requestOrientationPermission()
  } else {
    startListeningOrientation();
  }
}

async function requestOrientationPermission() {
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === "granted") {
        startListeningOrientation();
      } else {
        AppState.compassState = "error";
        AppState.emit();
      }
    } else {
      startListeningOrientation();
    }
  } catch (e) {
    AppState.compassState = "error";
    AppState.emit();
  }
}

let _absoluteSupported = false;

function startListeningOrientation() {
  // Prefer deviceorientationabsolute (Android) for true north heading.
  // If it fires, we skip the generic deviceorientation handler.
  window.addEventListener("deviceorientationabsolute", function onAbs(e) {
    _absoluteSupported = true;
    handleOrientation(e);
    // Keep listening for updates
  }, true);

  // Fallback: generic deviceorientation (used when absolute is not available)
  window.addEventListener("deviceorientation", function onGeneric(e) {
    if (_absoluteSupported) return; // absolute is active, skip generic
    handleOrientation(e);
  }, true);

  AppState.compassState = "active";
  AppState.emit();
}

function handleOrientation(event) {
  let heading = null;

  // iOS: webkitCompassHeading is magnetic north (0-360)
  if (event.webkitCompassHeading != null) {
    heading = event.webkitCompassHeading;
  }
  // Android with absolute orientation: alpha is already compass heading (0-360)
  else if (event.type === "deviceorientationabsolute" && event.alpha != null) {
    heading = event.alpha;
  }
  // Android generic: alpha needs inversion (0-360, counter-clockwise from north)
  else if (event.alpha != null) {
    heading = (360 - event.alpha) % 360;
  }

  if (heading !== null) {
    AppState.heading = ((heading % 360) + 360) % 360;
    AppState.emit();
  }
}

/* ==========================================================================
   4. SCREEN / SPA NAVIGATION
   ========================================================================== */

function navigateTo(screen) {
  AppState.currentScreen = screen;

  // Hide all screens
  document.querySelectorAll("[data-screen]").forEach(el => {
    el.classList.add("hidden");
    el.classList.remove("screen-active");
  });

  // Show target screen
  const target = document.querySelector(`[data-screen="${screen}"]`);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("screen-active");
  }

  // Toggle bottom nav visibility
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) {
    bottomNav.classList.toggle("hidden", screen === "ar");
  }

  // Enter / exit AR scene
  if (screen === "ar") {
    document.body.classList.add("ar-active");
  } else {
    document.body.classList.remove("ar-active");
  }

  AppState.emit();
}

/* ==========================================================================
   5. UI RENDERING
   ========================================================================== */

function initUIBindings() {
  // --- Navigation tabs ---
  const tabs = {
    home: document.querySelectorAll("[data-nav-home]"),
    settings: document.querySelectorAll("[data-nav-settings]"),
    masjids: document.querySelectorAll("[data-nav-masjids]"),
  };

  if (tabs.home) tabs.home.forEach(btn => btn.addEventListener("click", () => navigateTo("home")));
  if (tabs.settings) tabs.settings.forEach(btn => btn.addEventListener("click", () => navigateTo("settings")));
  if (tabs.masjids) tabs.masjids.forEach(btn => btn.addEventListener("click", () => navigateTo("home"))); // Scroll to mosque list

  // --- Enter AR ---
  document.querySelectorAll("[data-enter-ar]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("ar"));
  });

  // --- Back from AR ---
  document.querySelectorAll("[data-back-ar]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("home"));
  });

  // --- Settings button in header ---
  document.querySelectorAll("[data-open-settings]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("settings"));
  });

  // --- Compass sensor permission button (iOS) ---
  const sensorBtn = document.getElementById("btn-request-sensor");
  if (sensorBtn) {
    sensorBtn.addEventListener("click", requestOrientationPermission);
  }

  // --- Dark mode toggle ---
  const darkToggle = document.getElementById("dark-mode-toggle");
  if (darkToggle) {
    darkToggle.addEventListener("change", () => {
      document.documentElement.classList.toggle("dark", darkToggle.checked);
      if (navigator.vibrate) navigator.vibrate(10);
    });
  }

  // --- Other toggles with haptic feedback ---
  document.querySelectorAll(".switch-toggle input").forEach(input => {
    input.addEventListener("change", () => {
      if (navigator.vibrate) navigator.vibrate(10);
    });
  });

  // --- Haptic feedback on all buttons ---
  document.querySelectorAll("button, [role='button']").forEach(el => {
    el.addEventListener("click", () => {
      if (navigator.vibrate) navigator.vibrate(5);
    });
  });

  // Start on home screen
  navigateTo("home");
}

/**
 * Master render function – called on every state change.
 */
function render(state) {
  renderGeoStatus(state);
  renderCompass(state);
  renderQiblaInfo(state);
  renderMosqueList(state);
  renderARView(state);
}

function renderGeoStatus(state) {
  const card = document.getElementById("geo-status-card");
  const locText = document.getElementById("geo-location-text");
  const locSub = document.getElementById("geo-location-sub");
  const badge = document.getElementById("geo-status-badge");
  const icon = document.getElementById("geo-status-icon");
  const sensorBanner = document.getElementById("sensor-permission-banner");

  // Show iOS sensor permission banner when compass is waiting
  if (sensorBanner) {
    sensorBanner.classList.toggle("hidden", state.compassState !== "requesting");
  }

  if (!card) return;

  if (state.geoState === "loading") {
    card.className = card.className.replace(/bg-\S+/g, "").trim();
    card.classList.add("bg-surface-container-lowest", "rounded-xl", "p-stack-md", "border", "border-outline-variant/20", "flex", "items-center", "justify-between", "shadow-sm");
    if (icon) { icon.textContent = "hourglass_empty"; icon.style.color = ""; }
    if (locText) locText.textContent = "Waiting for location…";
    if (locSub) locSub.textContent = "Requesting GPS permission";
    if (badge) { badge.textContent = "WAITING"; badge.className = "font-mono-tech text-mono-tech bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full"; }
  } else if (state.geoState === "located") {
    card.className = card.className.replace(/bg-\S+/g, "").trim();
    card.classList.add("bg-surface-container-lowest", "rounded-xl", "p-stack-md", "border", "border-outline-variant/20", "flex", "items-center", "justify-between", "shadow-sm");
    const p = state.position;
    if (icon) { icon.textContent = "check_circle"; icon.style.color = ""; }
    if (locText) locText.textContent = `Location: ${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°`;
    if (locSub) locSub.textContent = `Accuracy: ~${Math.round(p.accuracy)}m`;
    if (badge) { badge.textContent = "LIVE"; badge.className = "font-mono-tech text-mono-tech bg-secondary-container/30 text-on-secondary-container px-2 py-1 rounded-full"; }
  } else if (state.geoState === "error") {
    card.className = card.className.replace(/bg-\S+/g, "").trim();
    card.classList.add("bg-error-container", "rounded-xl", "p-stack-md", "border", "border-error/20", "flex", "items-center", "justify-between", "shadow-sm");
    if (icon) { icon.textContent = "error"; icon.style.color = ""; }
    if (locText) locText.textContent = "Location unavailable";
    const errMsg = state._geoError
      ? (state._geoError.code === 1 ? "Permission denied" : "Error: " + state._geoError.message)
      : "Check device settings";
    if (locSub) locSub.textContent = errMsg;
    if (badge) { badge.textContent = "ERROR"; badge.className = "font-mono-tech text-mono-tech bg-error/20 text-on-error-container px-2 py-1 rounded-full"; }
  }
}

function renderCompass(state) {
  const compassRing = document.getElementById("compass-ring");
  const compassDeg = document.getElementById("compass-deg-display");
  const headingLabel = document.getElementById("heading-label");

  if (compassRing && state.qiblaBearing != null && state.heading != null) {
    // Rotate compass ring so the Qibla arrow points in the right direction
    const rotation = state.qiblaBearing - state.heading;
    compassRing.style.transform = `rotate(${rotation}deg)`;
  }

  if (compassDeg) {
    if (state.qiblaBearing != null) {
      compassDeg.textContent = Math.round(state.qiblaBearing) + "°";
    }
  }

  if (headingLabel) {
    if (state.heading != null) {
      headingLabel.textContent = compassLabel(state.heading) + " " + Math.round(state.heading) + "°";
    }
  }
}

function renderQiblaInfo(state) {
  const distEl = document.getElementById("kabah-distance");
  const marginEl = document.getElementById("qibla-margin");
  const bearingTag = document.getElementById("qibla-bearing-tag");

  if (distEl && state.distanceToKabah != null) {
    distEl.textContent = formatDistance(state.distanceToKabah);
  }

  if (marginEl) {
    marginEl.textContent = `± ${QIBLA_ERROR_MARGIN}° approx.`;
  }

  if (bearingTag && state.qiblaBearing != null) {
    bearingTag.textContent = `BEARING: ${Math.round(state.qiblaBearing)}°`;
  }
}

function renderMosqueList(state) {
  const container = document.getElementById("mosque-list");
  const radiusLabel = document.getElementById("mosque-radius-label");
  if (!container) return;

  if (radiusLabel) {
    radiusLabel.textContent = `Radius: ${SEARCH_RADIUS_KM} km`;
  }

  if (state.nearbyMosques.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 text-center">
        <p class="font-body-sm text-body-sm text-outline">No mosques found within ${SEARCH_RADIUS_KM} km.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.nearbyMosques.map((m, i) => {
    const dist = formatDistance(m.distance);
    const dir = state.qiblaBearing != null
      ? relativeDirection(m.bearing, state.qiblaBearing)
      : Math.round(m.bearing) + "° bearing";
    const iconDir = dir.includes("right") ? "north_east" : dir.includes("left") ? "north_west" : "explore";

    return `
      <div class="group bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 flex gap-stack-md items-center active:scale-[0.98] transition-transform duration-200 cursor-pointer" data-mosque-idx="${i}">
        <div class="w-12 h-12 rounded-lg bg-primary-container/20 flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">mosque</span>
        </div>
        <div class="flex-grow min-w-0">
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-title-md text-title-md text-on-surface group-hover:text-primary transition-colors truncate">${m.name}</h3>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <span class="font-mono-tech text-mono-tech text-outline flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">location_on</span> ${dist}
            </span>
            <span class="font-mono-tech text-mono-tech text-primary flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">${iconDir}</span> ${dir}
            </span>
          </div>
        </div>
        <span class="material-symbols-outlined text-outline-variant">chevron_right</span>
      </div>`;
  }).join("");
}

/* ==========================================================================
   6. AR VIEW
   ========================================================================== */

function renderARView(state) {
  // Update AR compass strip bearing display
  const arBearing = document.getElementById("ar-bearing-display");
  if (arBearing && state.qiblaBearing != null) {
    arBearing.textContent = Math.round(state.qiblaBearing) + "°";
  }

  // Update AR heading label
  const arHeading = document.getElementById("ar-heading-label");
  if (arHeading && state.heading != null) {
    arHeading.textContent = Math.round(state.heading) + "°";
  }

  // Update compass strip rotation
  const compassStrip = document.getElementById("compass-strip");
  if (compassStrip && state.heading != null) {
    compassStrip.style.transform = `translateX(${-state.heading * 0.5}px)`;
  }

  // Render floating mosque tags in AR view
  renderARMosqueTags(state);
}

/**
 * Render floating masjid tags positioned by bearing relative to heading.
 * Tags appear at horizontal positions based on their angular offset from
 * the user's current heading, giving an AR-like overlay effect.
 */
function renderARMosqueTags(state) {
  const container = document.getElementById("ar-mosque-tags");
  if (!container) return;

  if (!state.position || state.nearbyMosques.length === 0) {
    container.innerHTML = "";
    return;
  }

  const heading = state.heading || 0;

  container.innerHTML = state.nearbyMosques.slice(0, 4).map((m, i) => {
    // Angular offset from current heading, normalised to -180..180
    let offset = m.bearing - heading;
    if (offset > 180) offset -= 360;
    if (offset < -180) offset += 360;

    // Only show mosques within ±80° of current view
    if (Math.abs(offset) > 80) return "";

    // Map offset to horizontal position (percentage from center)
    const xPos = 50 + (offset / 80) * 40; // 10% – 90%
    // Scale and opacity based on distance
    const scale = Math.max(0.6, 1 - m.distance * 0.15);
    const opacity = Math.max(0.4, 1 - m.distance * 0.2);
    const yPos = 40 + (i % 2) * 12; // stagger vertically

    return `
      <div class="absolute floating-tag flex flex-col items-center gap-2" style="left:${xPos}%;top:${yPos}%;transform:translate(-50%,0) scale(${scale});opacity:${opacity};animation-delay:${-i * 1.2}s;">
        <div class="w-10 h-10 glass-panel border border-white/30 rounded-full flex items-center justify-center shadow-lg">
          <span class="material-symbols-outlined text-primary text-[18px]" style="font-variation-settings:'FILL' 1;">location_on</span>
        </div>
        <div class="glass-panel px-stack-md py-stack-sm rounded-xl border border-white/20 shadow-xl min-w-[120px] text-center">
          <p class="font-title-md text-body-sm text-on-surface font-semibold truncate">${m.name}</p>
          <p class="font-mono-tech text-label-caps text-primary opacity-80">${formatDistance(m.distance)} away</p>
        </div>
      </div>`;
  }).join("");
}

/* ==========================================================================
   7. INITIALIZATION
   ========================================================================== */

function init() {
  // Set up UI bindings (SPA navigation, buttons, toggles)
  initUIBindings();

  // Subscribe render to state changes
  AppState.on(render);

  // Start geolocation
  initGeolocation();

  // Start compass
  initOrientation();

  // Initial render
  render(AppState);
}

// Boot when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
