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
const QIBLA_ERROR_MARGIN = 3;
const SEARCH_RADIUS_KM = 2;

/** Overpass API endpoints (free, CORS-enabled, no key needed) — tried in order as fallbacks */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/**
 * Fetch nearby mosques from OpenStreetMap Overpass API.
 * Queries amenity=mosque within the given radius (meters) of lat/lon.
 * Returns an array of { name, lat, lon } objects.
 */
async function fetchMosquesFromAPI(lat, lon, radiusMeters) {
  const query = `[out:json][timeout:15];(
    nwr["amenity"="mosque"](around:${radiusMeters},${lat},${lon});
  );out center;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`Overpass API ${resp.status}`);
      const json = await resp.json();
      const results = (json.elements || []).map(el => {
        const c = el.center || el;
        return {
          name: (el.tags && el.tags.name) || "Mosque",
          lat: c.lat,
          lon: c.lon,
        };
      }).filter(m => m.lat != null && m.lon != null);
      return results;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Overpass endpoint failed (${endpoint}):`, err.message);
      continue;
    }
  }
  return null;
}

const AppState = {
  geoState: "loading",
  compassState: "loading",
  mosqueState: "idle",  // idle | loading | loaded | error
  currentScreen: "home",
  position: null,
  heading: null,
  qiblaBearing: null,
  distanceToKabah: null,
  nearbyMosques: [],
  lang: "en",
  useMetric: true,
  _listeners: [],
  on(callback) { this._listeners.push(callback); },
  emit() { this._listeners.forEach(cb => cb(this)); },
};

/* ==========================================================================
   1. INTERNATIONALIZATION (EN / ID)
   ========================================================================== */

const I18N = {
  en: {
    appSubtitle: "AR Qibla & Mosque Finder",
    waitingLocation: "Waiting for location…",
    requestingGps: "Requesting GPS permission",
    locationLabel: "Location",
    accuracyLabel: "Accuracy",
    locationUnavailable: "Location unavailable",
    permissionDenied: "Permission denied",
    checkSettings: "Check device settings",
    waiting: "WAITING",
    live: "LIVE",
    error: "ERROR",
    qibla: "Qibla",
    qiblaTitle: "Qibla",
    distanceToKabah: "Distance to Ka'bah",
    nearbyMasjids: "Nearby Masjids",
    radius: "Radius",
    noMosques: "No mosques found within",
    km: "km",
    enterArView: "Enter AR View",
    settingsAndInfo: "Settings & Info",
    aboutTitle: "About ARQiblaMasjid",
    aboutDesc: "A modern tool for the global Muslim community, combining AR technology with traditional needs. Designed for precision, privacy, and peace of mind.",
    calibrationTitle: "Calibration & Accuracy",
    calibrationDesc1: "For the most precise results, calibrate your phone's compass by moving it in a smooth",
    calibrationDesc2: "figure-8 motion",
    calibrationDesc3: "in the air.",
    calibrationNote: "A slight difference of a few degrees in Qibla direction is still within acceptable tolerance according to many scholars and astronomers. Do not worry about very small deviations.",
    electromagneticWarning: "Note: Electromagnetic interference from nearby metal or electronics can affect results.",
    pushNotifications: "Push Notifications",
    metricUnits: "Use Metric Units",
    darkMode: "Dark Mode",
    privacyTitle: "Privacy",
    privacyDesc: "Your location is processed",
    privacyDescBold: "locally on-device",
    privacyDesc2: "to calculate bearings and find nearby mosques. We do not store or transmit your precise coordinates.",
    viewPrivacyPolicy: "VIEW FULL PRIVACY POLICY",
    version: "v1.0.0",
    alignedWithQibla: "aligned",
    enableCompass: "Enable compass sensor for accurate Qibla direction.",
    enable: "Enable",
    arModeExperimental: "AR Mode: Experimental",
    alignPhone: "Align your phone to find Qibla",
    levelPhone: "Level Your Phone",
    getPath: "Get Path",
    navigate: "Navigate",
    switchTo: "Switch to",
    map2d: "2D Map",
    language: "Language",
    allMasjids: "All Masjids",
    allMasjidsDesc: "Mosques nearby your location",
    open: "Open",
    gettingLocation: "Getting your location…",
    langToggle: "ID",
    masjidsTab: "Masjids",
    savedTab: "Saved",
    settingsTab: "Settings",
    nearMeTab: "Qibla",
    searchingMosques: "Searching nearby mosques…",
    mosqueCount: "mosques found",
    mosqueRegion: "Region",
  },
  id: {
    appSubtitle: "Penunjuk Arah Kiblat & Masjid AR",
    waitingLocation: "Menunggu lokasi…",
    requestingGps: "Meminta izin GPS",
    locationLabel: "Lokasi",
    accuracyLabel: "Akurasi",
    locationUnavailable: "Lokasi tidak tersedia",
    permissionDenied: "Izin ditolak",
    checkSettings: "Periksa pengaturan perangkat",
    waiting: "MENUNGGU",
    live: "LANGSUNG",
    error: "GAGAL",
    qibla: "Kiblat",
    qiblaTitle: "Kiblat",
    distanceToKabah: "Jarak ke Ka'bah",
    nearbyMasjids: "Masjid Terdekat",
    radius: "Radius",
    noMosques: "Tidak ada masjid dalam radius",
    km: "km",
    enterArView: "Masuk Mode AR",
    settingsAndInfo: "Pengaturan & Info",
    aboutTitle: "Tentang ARQiblaMasjid",
    aboutDesc: "Alat modern untuk umat Muslim global, menggabungkan teknologi AR dengan kebutuhan tradisional. Dirancang untuk presisi, privasi, dan ketenangan pikiran.",
    calibrationTitle: "Kalibrasi & Akurasi",
    calibrationDesc1: "Untuk hasil paling akurat, kalibrasi kompas ponsel Anda dengan menggerakkannya dalam gerakan",
    calibrationDesc2: "angka delapan",
    calibrationDesc3: "di udara.",
    calibrationNote: "Perbedaan beberapa derajat arah kiblat masih dalam batas toleransi menurut banyak ulama dan astronom. Jangan khawatir dengan deviasi yang sangat kecil.",
    electromagneticWarning: "Catatan: Interferensi elektromagnetik dari logam atau elektronik di sekitar dapat mempengaruhi hasil.",
    pushNotifications: "Notifikasi Push",
    metricUnits: "Gunakan Satuan Metrik",
    darkMode: "Mode Gelap",
    privacyTitle: "Privasi",
    privacyDesc: "Lokasi Anda diproses",
    privacyDescBold: "secara lokal di perangkat",
    privacyDesc2: "untuk menghitung bearing dan menemukan masjid terdekat. Kami tidak menyimpan atau mengirim koordinat Anda.",
    viewPrivacyPolicy: "LIHAT KEBIJAKAN PRIVASI LENGKAP",
    version: "v1.0.0",
    alignedWithQibla: "selaras",
    enableCompass: "Aktifkan sensor kompas untuk arah kiblat yang akurat.",
    enable: "Aktifkan",
    arModeExperimental: "Mode AR: Eksperimental",
    alignPhone: "Arahkan ponsel untuk menemukan Kiblat",
    levelPhone: "Ratakan Ponsel Anda",
    getPath: "Dapatkan Jalur",
    navigate: "Navigasi",
    switchTo: "Beralih ke",
    map2d: "Peta 2D",
    language: "Bahasa",
    allMasjids: "Semua Masjid",
    allMasjidsDesc: "Masjid di sekitar lokasi Anda",
    open: "Buka",
    gettingLocation: "Mendapatkan lokasi Anda…",
    langToggle: "EN",
    masjidsTab: "Masjid",
    savedTab: "Tersimpan",
    settingsTab: "Pengaturan",
    nearMeTab: "Kiblat",
    searchingMosques: "Mencari masjid terdekat…",
    mosqueCount: "masjid ditemukan",
    mosqueRegion: "Wilayah",
  },
};

function t(key) {
  return I18N[AppState.lang][key] || I18N.en[key] || key;
}

function setLanguage(lang) {
  AppState.lang = lang;
  document.documentElement.lang = lang === "id" ? "id" : "en";
  applyTranslations();
  AppState.emit();
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const text = t(key);
    if (text) {
      if (el.tagName === "INPUT" && el.type === "checkbox") return;
      el.textContent = text;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.placeholder = t(key);
  });
}

/* ==========================================================================
   2. MATHEMATICAL UTILITIES
   ========================================================================== */

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function computeQiblaBearing(lat, lon) {
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const φk = toRad(KABAH.lat);
  const λk = toRad(KABAH.lon);
  const Δλ = λk - λ1;

  const y = Math.sin(Δλ) * Math.cos(φk);
  const x =
    Math.cos(φ1) * Math.sin(φk) -
    Math.sin(φ1) * Math.cos(φk) * Math.cos(Δλ);

  const θ = toDeg(Math.atan2(y, x));
  return ((θ % 360) + 360) % 360;
}

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

function formatDistance(km) {
  if (!AppState.useMetric) {
    const miles = km * 0.621371;
    if (miles < 0.1) {
      return Math.round(km * 1000) + " m";
    }
    return miles.toFixed(1) + " mi";
  }
  if (km < 1) {
    return Math.round(km * 1000) + " m";
  }
  return km.toFixed(1) + " " + t("km");
}

function relativeDirection(bearing, qibla) {
  let diff = bearing - qibla;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const abs = Math.abs(Math.round(diff));
  if (abs <= 5) return t("alignedWithQibla");
  if (diff > 0) return abs + "° right";
  return abs + "° left";
}

function compassLabel(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/* ==========================================================================
   3. GEOLOCATION
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

  AppState.qiblaBearing = computeQiblaBearing(latitude, longitude);
  AppState.distanceToKabah = computeDistance(latitude, longitude, KABAH.lat, KABAH.lon);

  AppState.emit();

  // Fetch mosques from Overpass API (async)
  fetchNearbyMosques(latitude, longitude);
}

/**
 * Fetch mosques from Overpass API, falling back to cached/local data on failure.
 * Results are cached in localStorage keyed by rounded coordinates.
 */
async function fetchNearbyMosques(lat, lon) {
  AppState.mosqueState = "loading";
  AppState.emit();

  // Round to ~100m precision for cache key
  const cacheKey = `mosques_${lat.toFixed(2)}_${lon.toFixed(2)}`;

  // Try fetching from Overpass API
  const radiusMeters = SEARCH_RADIUS_KM * 1000;
  const apiResult = await fetchMosquesFromAPI(lat, lon, radiusMeters);

  if (apiResult !== null && apiResult.length > 0) {
    // Success — cache the result
    try { localStorage.setItem(cacheKey, JSON.stringify(apiResult)); } catch (e) {}
    setMosqueData(apiResult, lat, lon);
    AppState.mosqueState = "loaded";
    AppState.emit();
    return;
  }

  // API failed or returned empty — try cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setMosqueData(parsed, lat, lon);
      AppState.mosqueState = "loaded";
      AppState.emit();
      return;
    }
  } catch (e) {}

  // No cache — try with wider radius (5× = 10 km)
  const widerResult = await fetchMosquesFromAPI(lat, lon, radiusMeters * 5);
  if (widerResult !== null && widerResult.length > 0) {
    try { localStorage.setItem(cacheKey, JSON.stringify(widerResult)); } catch (e) {}
    setMosqueData(widerResult, lat, lon, radiusMeters * 5 / 1000);
    AppState.mosqueState = "loaded";
    AppState.emit();
    return;
  }

  // All attempts failed — no mosques found
  AppState.nearbyMosques = [];
  AppState.mosqueState = "loaded";
  AppState.emit();
}

/** Set mosque data and compute distances/bearings from user position. */
function setMosqueData(mosques, lat, lon, maxDistance) {
  const limit = maxDistance || SEARCH_RADIUS_KM;
  AppState.nearbyMosques = mosques
    .map(m => {
      const dist = computeDistance(lat, lon, m.lat, m.lon);
      const bearing = computeBearing(lat, lon, m.lat, m.lon);
      return { ...m, distance: dist, bearing };
    })
    .filter(m => m.distance <= limit)
    .sort((a, b) => a.distance - b.distance);
}

function onGeoError(err) {
  AppState.geoState = "error";
  AppState._geoError = err;
  AppState.emit();
}



/* ==========================================================================
   4. DEVICE ORIENTATION (COMPASS)
   ========================================================================== */

function initOrientation() {
  if (!window.DeviceOrientationEvent) {
    AppState.compassState = "unsupported";
    AppState.emit();
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    AppState.compassState = "requesting";
    AppState.emit();
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
let _pendingHeading = null;
let _rafId = null;
let _smoothedHeading = null;
const HEADING_SMOOTH_FACTOR = 0.98;

/**
 * Low-pass filter for compass heading — reduces jitter so the AR marker
 * doesn't vibrate when the phone is held still.
 */
function smoothHeading(raw) {
  if (_smoothedHeading === null) {
    _smoothedHeading = raw;
    return raw;
  }
  let diff = raw - _smoothedHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  _smoothedHeading = ((_smoothedHeading + diff * HEADING_SMOOTH_FACTOR) % 360 + 360) % 360;
  return _smoothedHeading;
}

/**
 * Throttled orientation handler using requestAnimationFrame.
 * Batches multiple sensor readings into a single render frame update.
 */
let _rawPendingHeading = null;

function scheduleHeadingUpdate(heading) {
  _rawPendingHeading = ((heading % 360) + 360) % 360;
  if (!_rafId) {
    _rafId = requestAnimationFrame(function () {
      _rafId = null;
      if (_rawPendingHeading != null) {
        AppState.heading = smoothHeading(_rawPendingHeading);
        _rawPendingHeading = null;
        AppState.emit();
      }
    });
  }
}

function startListeningOrientation() {
  window.addEventListener("deviceorientationabsolute", function (e) {
    _absoluteSupported = true;
    handleOrientation(e);
  }, true);

  window.addEventListener("deviceorientation", function (e) {
    if (_absoluteSupported) return;
    handleOrientation(e);
  }, true);

  AppState.compassState = "active";
  AppState.emit();
}

/**
 * Handle orientation events and normalise heading to 0-360 clockwise from north.
 * Uses requestAnimationFrame to throttle rendering.
 *
 * CRITICAL FIX: On many Android browsers, `deviceorientationabsolute` provides
 * `alpha` that increases COUNTER-CLOCKWISE (standard spec). We must invert it
 * to get a clockwise compass heading. The previous code used `event.alpha`
 * directly for the absolute event, which caused the arrow to spin the wrong way.
 */
function handleOrientation(event) {
  let heading = null;

  // iOS: webkitCompassHeading is magnetic north (0-360, clockwise)
  if (event.webkitCompassHeading != null) {
    heading = event.webkitCompassHeading;
  }
  // Android absolute / generic: alpha needs inversion to become clockwise
  else if (event.alpha != null) {
    heading = (360 - event.alpha) % 360;
  }

  if (heading !== null) {
    scheduleHeadingUpdate(heading);
  }
}

/* ==========================================================================
   5. CAMERA (AR VIEW)
   ========================================================================== */

let _arCameraStream = null;

function startARCamera() {
  if (_arCameraStream) return; // already started

  const video = document.getElementById("ar-camera-video");
  const fallback = document.getElementById("ar-camera-fallback");
  if (!video) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Camera not supported — show fallback image
    if (fallback) fallback.classList.remove("hidden");
    return;
  }

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
  })
  .then(stream => {
    _arCameraStream = stream;
    video.srcObject = stream;
    video.play().catch(() => {});
    video.classList.remove("hidden");
    if (fallback) fallback.classList.add("hidden");
  })
  .catch(() => {
    // Camera denied or unavailable — show fallback image
    if (fallback) fallback.classList.remove("hidden");
  });
}

function stopARCamera() {
  if (_arCameraStream) {
    _arCameraStream.getTracks().forEach(t => t.stop());
    _arCameraStream = null;
  }
  const video = document.getElementById("ar-camera-video");
  if (video) {
    video.srcObject = null;
    video.classList.add("hidden");
  }
}

/* ==========================================================================
   6. SCREEN / SPA NAVIGATION
   ========================================================================== */

function navigateTo(screen) {
  AppState.currentScreen = screen;

  document.querySelectorAll("[data-screen]").forEach(el => {
    el.classList.add("hidden");
    el.classList.remove("screen-active");
  });

  const target = document.querySelector(`[data-screen="${screen}"]`);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("screen-active");
  }

  // Bottom nav: visible on home and masjids, hidden on ar and settings
  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) {
    bottomNav.classList.toggle("hidden", screen === "ar" || screen === "settings");
  }

  // Camera
  if (screen === "ar") {
    document.body.classList.add("ar-active");
    startARCamera();
  } else {
    document.body.classList.remove("ar-active");
    stopARCamera();
  }

  // Update active tab styling
  updateActiveTab(screen);

  // Scroll to top for masjids screen
  if (screen === "masjids") {
    window.scrollTo(0, 0);
  }

  AppState.emit();
}

function updateActiveTab(screen) {
  // Reset all nav buttons
  document.querySelectorAll("[data-nav-home], [data-nav-masjids], [data-nav-settings]").forEach(btn => {
    btn.classList.remove("bg-secondary-container", "text-on-secondary-container", "rounded-full");
    btn.classList.add("text-on-surface-variant");
  });

  // Highlight active tab
  let activeSelector = "[data-nav-home]";
  if (screen === "masjids") activeSelector = "[data-nav-masjids]";
  if (screen === "settings") activeSelector = "[data-nav-settings]";

  document.querySelectorAll(activeSelector).forEach(btn => {
    btn.classList.add("bg-secondary-container", "text-on-secondary-container", "rounded-full");
    btn.classList.remove("text-on-surface-variant");
  });
}

/* ==========================================================================
   7. UI RENDERING
   ========================================================================== */

function initUIBindings() {
  // Navigation tabs
  document.querySelectorAll("[data-nav-home]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("home"));
  });
  document.querySelectorAll("[data-nav-settings]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("settings"));
  });
  document.querySelectorAll("[data-nav-masjids]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("masjids"));
  });

  // Enter AR
  document.querySelectorAll("[data-enter-ar]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("ar"));
  });

  // Back from AR
  document.querySelectorAll("[data-back-ar]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("home"));
  });

  // Settings button in header
  document.querySelectorAll("[data-open-settings]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo("settings"));
  });

  // Compass sensor permission (iOS)
  const sensorBtn = document.getElementById("btn-request-sensor");
  if (sensorBtn) {
    sensorBtn.addEventListener("click", requestOrientationPermission);
  }

  // Dark mode toggle
  const darkToggle = document.getElementById("dark-mode-toggle");
  if (darkToggle) {
    darkToggle.addEventListener("change", () => {
      document.documentElement.classList.toggle("dark", darkToggle.checked);
    });
  }

  // Language toggle (bind all instances)
  document.querySelectorAll("#lang-toggle, #lang-toggle-masjids").forEach(btn => {
    btn.addEventListener("click", () => {
      const newLang = AppState.lang === "en" ? "id" : "en";
      setLanguage(newLang);
    });
  });

  // All toggle switches with haptic feedback
  document.querySelectorAll(".switch-toggle input").forEach(input => {
    input.addEventListener("change", () => {
      if (navigator.vibrate) navigator.vibrate(10);
    });
  });

  // Metric / Imperial units toggle (second switch-toggle on settings screen)
  const metricToggle = document.querySelectorAll(".switch-toggle input")[1];
  if (metricToggle) {
    metricToggle.addEventListener("change", () => {
      AppState.useMetric = metricToggle.checked;
      AppState.emit();
    });
  }

  // Haptic feedback on all buttons
  document.querySelectorAll("button, [role='button']").forEach(el => {
    el.addEventListener("click", () => {
      if (navigator.vibrate) navigator.vibrate(5);
    });
  });

  navigateTo("home");
}

function render(state) {
  renderGeoStatus(state);
  renderCompass(state);
  renderQiblaInfo(state);
  renderMosqueList(state);
  renderMasjidsScreen(state);
  renderARView(state);
}

function renderGeoStatus(state) {
  const card = document.getElementById("geo-status-card");
  const locText = document.getElementById("geo-location-text");
  const locSub = document.getElementById("geo-location-sub");
  const badge = document.getElementById("geo-status-badge");
  const icon = document.getElementById("geo-status-icon");
  const sensorBanner = document.getElementById("sensor-permission-banner");

  // Sensor permission banner: only show on iOS when permission is needed
  if (sensorBanner) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform && navigator.platform.includes("Mac") && navigator.maxTouchPoints > 1);
    const needsPermission = state.compassState === "requesting" && isIOS;
    sensorBanner.classList.toggle("hidden", !needsPermission);
  }

  if (!card) return;

  // Reset classes
  card.className = "rounded-xl p-stack-md border border-outline-variant/20 flex items-center justify-between shadow-sm";

  if (state.geoState === "loading") {
    card.classList.add("bg-surface-container-lowest");
    if (icon) { icon.textContent = "hourglass_empty"; icon.style.color = ""; }
    if (locText) locText.textContent = t("waitingLocation");
    if (locSub) locSub.textContent = t("requestingGps");
    if (badge) { badge.textContent = t("waiting"); badge.className = "font-mono-tech text-mono-tech bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full badge-pulse"; }
  } else if (state.geoState === "located") {
    card.classList.add("bg-surface-container-lowest");
    const p = state.position;
    if (icon) { icon.textContent = "check_circle"; icon.style.color = ""; }
    if (locText) locText.textContent = `${t("locationLabel")}: ${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°`;
    if (locSub) locSub.textContent = `${t("accuracyLabel")}: ~${Math.round(p.accuracy)}m`;
    if (badge) { badge.textContent = t("live"); badge.className = "font-mono-tech text-mono-tech bg-secondary-container/30 text-on-secondary-container px-2 py-1 rounded-full"; }
  } else if (state.geoState === "error") {
    card.classList.add("bg-error-container");
    if (icon) { icon.textContent = "error"; icon.style.color = ""; }
    if (locText) locText.textContent = t("locationUnavailable");
    const errMsg = state._geoError
      ? (state._geoError.code === 1 ? t("permissionDenied") : "Error: " + state._geoError.message)
      : t("checkSettings");
    if (locSub) locSub.textContent = errMsg;
    if (badge) { badge.textContent = t("error"); badge.className = "font-mono-tech text-mono-tech bg-error/20 text-on-error-container px-2 py-1 rounded-full"; }
  }
}

function renderCompass(state) {
  const compassRing = document.getElementById("compass-ring");
  const compassDeg = document.getElementById("compass-deg-display");
  const headingLabel = document.getElementById("heading-label");

  if (compassRing && state.qiblaBearing != null && state.heading != null) {
    // The arrow is at the TOP (0°) of the ring. We rotate the ring so the
    // arrow points at the Qibla direction relative to the phone's heading.
    // When heading increases (phone rotates clockwise), rotation decreases
    // so the arrow stays pointing at the fixed Qibla direction.
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

  if (distEl && state.distanceToKabah != null) {
    distEl.textContent = formatDistance(state.distanceToKabah);
  }

  if (marginEl) {
    marginEl.textContent = `± ${QIBLA_ERROR_MARGIN}°`;
  }
}

function renderMosqueList(state) {
  const container = document.getElementById("mosque-list");
  if (!container) return;

  // Waiting for location
  if (state.geoState !== "located") {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 text-center">
        <span class="material-symbols-outlined text-outline text-3xl mb-1">location_searching</span>
        <p class="font-body-sm text-body-sm text-outline">${t("gettingLocation")}</p>
      </div>`;
    return;
  }

  // Loading mosques from API
  if (state.mosqueState === "loading") {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 text-center">
        <span class="material-symbols-outlined text-primary animate-spin text-2xl mb-1">progress_activity</span>
        <p class="font-body-sm text-body-sm text-outline">${t("searchingMosques")}</p>
      </div>`;
    return;
  }

  if (state.nearbyMosques.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 text-center">
        <span class="material-symbols-outlined text-outline text-3xl mb-1">mosque</span>
        <p class="font-body-sm text-body-sm text-outline">${t("noMosques")} ${SEARCH_RADIUS_KM} ${t("km")}.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.nearbyMosques.map((m, i) => {
    const dist = formatDistance(m.distance);
    const dir = state.qiblaBearing != null
      ? relativeDirection(m.bearing, state.qiblaBearing)
      : Math.round(m.bearing) + "°";
    const iconDir = dir.includes("right") ? "north_east" : dir.includes("left") ? "north_west" : "explore";

    return `
      <div class="group bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 flex gap-stack-md items-center active:scale-[0.98] transition-transform duration-200 cursor-pointer">
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

/**
 * Render the dedicated Masjids screen with all nearby mosques.
 */
function renderMasjidsScreen(state) {
  const container = document.getElementById("masjids-screen-list");
  if (!container) return;

  if (state.geoState !== "located") {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-lg border border-outline-variant/20 text-center">
        <span class="material-symbols-outlined text-outline text-4xl mb-2">location_searching</span>
        <p class="font-body-sm text-body-sm text-outline">${t("gettingLocation")}</p>
      </div>`;
    return;
  }

  // Loading state
  if (state.mosqueState === "loading") {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-lg border border-outline-variant/20 text-center">
        <span class="material-symbols-outlined text-primary animate-spin text-4xl mb-2">progress_activity</span>
        <p class="font-body-sm text-body-sm text-outline">${t("searchingMosques") || "Searching nearby mosques…"}</p>
      </div>`;
    return;
  }

  if (state.nearbyMosques.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-xl p-stack-lg border border-outline-variant/20 text-center">
        <span class="material-symbols-outlined text-outline text-4xl mb-2">mosque</span>
        <p class="font-body-sm text-body-sm text-outline">${t("noMosques")} ${SEARCH_RADIUS_KM} ${t("km")}.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.nearbyMosques.map((m, i) => {
    const dist = formatDistance(m.distance);
    const dir = state.qiblaBearing != null
      ? relativeDirection(m.bearing, state.qiblaBearing)
      : Math.round(m.bearing) + "°";
    const iconDir = dir.includes("right") ? "north_east" : dir.includes("left") ? "north_west" : "explore";

    return `
      <div class="group bg-surface-container-lowest rounded-xl p-stack-md border border-outline-variant/20 flex gap-stack-md items-center active:scale-[0.98] transition-transform duration-200 cursor-pointer">
        <div class="w-16 h-16 rounded-xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">mosque</span>
        </div>
        <div class="flex-grow min-w-0">
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-title-md text-title-md text-on-surface group-hover:text-primary transition-colors">${m.name}</h3>
            <span class="font-label-caps text-[10px] text-on-secondary-container uppercase font-bold px-1.5 py-0.5 bg-secondary-container/40 rounded flex-shrink-0 ml-2">${t("open")}</span>
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
   8. AR VIEW
   ========================================================================== */

function renderARView(state) {
  const arBearing = document.getElementById("ar-bearing-display");
  if (arBearing && state.qiblaBearing != null) {
    arBearing.textContent = Math.round(state.qiblaBearing) + "°";
  }

  const arHeading = document.getElementById("ar-heading-label");
  if (arHeading && state.heading != null) {
    arHeading.textContent = Math.round(state.heading) + "° " + compassLabel(state.heading);
  }

  // Compass strip translation — map 0-360° heading to horizontal scroll
  // Each degree ≈ 3px of strip travel; center marker is at 50% of viewport
  const compassStrip = document.getElementById("compass-strip");
  if (compassStrip && state.heading != null) {
    const stripWidth = compassStrip.scrollWidth || 1200;
    const centerOffset = stripWidth / 2;
    const pxPerDeg = stripWidth / 360;
    const translateX = centerOffset - (state.heading * pxPerDeg);
    compassStrip.style.transform = `translateX(${translateX}px)`;
  }

  // AR Qibla marker position — move marker left/right based on bearing offset from heading
  const arMarker = document.getElementById("ar-qibla-marker");
  if (arMarker && state.qiblaBearing != null && state.heading != null) {
    let offset = state.qiblaBearing - state.heading;
    if (offset > 180) offset -= 360;
    if (offset < -180) offset += 360;

    // Map offset (-80 to 80) to horizontal position (5% to 95%)
    const xPos = 50 + (offset / 80) * 45;
    const visible = Math.abs(offset) <= 80;

    arMarker.style.left = xPos + "%";
    arMarker.style.opacity = visible ? "1" : "0.15";
    arMarker.style.transform = `translate(-50%, -50%) scale(${visible ? 1 : 0.6})`;
  }

  renderARMosqueTags(state);
}

function renderARMosqueTags(state) {
  const container = document.getElementById("ar-mosque-tags");
  if (!container) return;

  if (!state.position || state.nearbyMosques.length === 0 || state.heading == null) {
    container.innerHTML = "";
    return;
  }

  const heading = state.heading;

  container.innerHTML = state.nearbyMosques.slice(0, 4).map((m, i) => {
    let offset = m.bearing - heading;
    if (offset > 180) offset -= 360;
    if (offset < -180) offset += 360;

    if (Math.abs(offset) > 80) return "";

    const xPos = 50 + (offset / 80) * 45;
    const scale = Math.max(0.7, 1 - m.distance * 0.1);
    const opacity = Math.max(0.5, 1 - m.distance * 0.15);
    const yPos = 30 + (i % 3) * 15;

    return `
      <div class="absolute pointer-events-none" style="left:${xPos}%;top:${yPos}%;transform:translate(-50%,0) scale(${scale});opacity:${opacity};">
        <div class="floating-tag flex flex-col items-center gap-2 pointer-events-auto" style="animation-delay:${-i * 1.2}s;">
          <div class="w-10 h-10 glass-panel border border-white/30 rounded-full flex items-center justify-center shadow-lg">
            <span class="material-symbols-outlined text-primary text-[18px]" style="font-variation-settings:'FILL' 1;">location_on</span>
          </div>
          <div class="glass-panel px-stack-md py-stack-sm rounded-xl border border-white/20 shadow-xl min-w-[120px] text-center">
            <p class="font-title-md text-body-sm text-on-surface font-semibold truncate">${m.name}</p>
            <p class="font-mono-tech text-label-caps text-primary opacity-80">${formatDistance(m.distance)}</p>
          </div>
        </div>
      </div>`;
  }).join("");
}

/* ==========================================================================
   9. PWA / SERVICE WORKER
   ========================================================================== */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {
      // Service worker registration failed — app works offline anyway
    });
  }
}

/* ==========================================================================
   10. INITIALIZATION
   ========================================================================== */

function init() {
  initUIBindings();
  applyTranslations();
  registerServiceWorker();
  AppState.on(render);
  initGeolocation();
  initOrientation();
  render(AppState);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
