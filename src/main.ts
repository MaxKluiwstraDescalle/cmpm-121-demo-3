import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Define a custom icon for the star emoji
const starIcon = leaflet.divIcon({
  html: "⭐", // Star emoji
  className: "custom-star-icon", // Custom class for styling
  iconSize: [25, 25], // Adjust the size as needed
  iconAnchor: [12, 12], // Adjust the anchor point as needed
  popupAnchor: [0, -12], // Adjust the popup anchor point as needed
});

const img = document.createElement("img");
img.src = import.meta.resolve("../marker.png");
document.body.appendChild(img);

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerPoints = 0;
const playerInventory: {
  original: { i: number; j: number };
  serial: number;
}[] = [];
const directions = document.querySelector<HTMLDivElement>("#statusPanel")!;
directions.innerHTML = "No points yet...";

const cacheCoins = new Map<
  string,
  { original: { i: number; j: number }; serial: number }[]
>();

const playerPath: leaflet.LatLng[] = [OAKES_CLASSROOM];
const polyline = leaflet.polyline(playerPath, { color: "blue" }).addTo(map);

function latLngToCell(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor(lat * 1e4),
    j: Math.floor(lng * 1e4),
  };
}

// Function to create a cache marker
function createCacheMarker(i: number, j: number) {
  return leaflet.marker([i * TILE_DEGREES, j * TILE_DEGREES], {
    icon: starIcon,
  }).addTo(map);
}

// Function to initialize coins in a cache
function initializeCoins(i: number, j: number) {
  const cacheKey = `${i},${j}`;
  const coins = cacheCoins.get(cacheKey) ?? [];
  if (coins.length === 0) {
    const initialCoins = Math.floor(luck([i, j, "coins"].toString()) * 10);
    for (let serial = 0; serial < initialCoins; serial++) {
      coins.push({ original: { i, j }, serial });
    }
    cacheCoins.set(cacheKey, coins);
  }
  return coins;
}

// Function to create a popup for a cache
function createCachePopup(
  i: number,
  j: number,
  coins: { original: { i: number; j: number }; serial: number }[],
) {
  const cacheKey = `${i},${j}`;
  const popupDiv = document.createElement("div");
  const list = document.createElement("ul");

  coins.forEach((coin, index) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `${coin.original.i}:${coin.original.j}#${coin.serial}`;
    listItem.addEventListener("click", () => {
      const homeLatLng = leaflet.latLng(
        coin.original.i * TILE_DEGREES,
        coin.original.j * TILE_DEGREES,
      );
      map.setView(homeLatLng, GAMEPLAY_ZOOM_LEVEL);
    });
    const collectButton = document.createElement("button");
    collectButton.innerHTML = "collect";
    collectButton.addEventListener("click", () => {
      coins.splice(index, 1);
      playerPoints++;
      playerInventory.push(coin); // Add to player's inventory
      cacheCoins.set(cacheKey, coins);
      updatePopup();
    });
    listItem.appendChild(collectButton);
    list.appendChild(listItem);
  });

  popupDiv.innerHTML = `Cache ${cacheKey}`;
  popupDiv.appendChild(list);

  const depositButton = document.createElement("button");
  depositButton.innerHTML = "deposit";
  depositButton.addEventListener("click", () => {
    if (playerPoints > 0 && playerInventory.length > 0) {
      const coin = playerInventory.pop()!; // Retrieve last collected coin
      coins.push(coin);
      playerPoints--;
      cacheCoins.set(cacheKey, coins);
      updatePopup();
    }
  });
  popupDiv.appendChild(depositButton);

  const updatePopup = () => {
    directions.innerHTML = `${playerPoints} points accumulated.`;
    list.innerHTML = "";
    coins.forEach((coin) => {
      const listItem = document.createElement("li");
      listItem.innerHTML =
        `${coin.original.i}:${coin.original.j}#${coin.serial}`;
      listItem.addEventListener("click", () => {
        const homeLatLng = leaflet.latLng(
          coin.original.i * TILE_DEGREES,
          coin.original.j * TILE_DEGREES,
        );
        map.setView(homeLatLng, GAMEPLAY_ZOOM_LEVEL);
      });
      const collectButton = document.createElement("button");
      collectButton.innerHTML = "collect";
      collectButton.addEventListener("click", () => {
        coins.splice(coins.indexOf(coin), 1);
        playerPoints++;
        playerInventory.push(coin);
        cacheCoins.set(cacheKey, coins);
        updatePopup();
      });
      listItem.appendChild(collectButton);
      list.appendChild(listItem);
    });
  };

  return popupDiv;
}

// Function to spawn a cache
function spawnCache(i: number, j: number) {
  const marker = createCacheMarker(i, j);
  const coins = initializeCoins(i, j);
  const popupDiv = createCachePopup(i, j, coins);
  marker.bindPopup(popupDiv);
}

const { i: playerI, j: playerJ } = latLngToCell(
  OAKES_CLASSROOM.lat,
  OAKES_CLASSROOM.lng,
);
for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
  for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
    const cellI = playerI + di;
    const cellJ = playerJ + dj;
    if (luck([cellI, cellJ].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cellI, cellJ);
    }
  }
}

// Ensure move buttons are correctly initialized
const moveButtons = {
  north: document.getElementById("north"),
  south: document.getElementById("south"),
  west: document.getElementById("west"),
  east: document.getElementById("east"),
  reset: document.getElementById("reset"),
  sensor: document.getElementById("sensor"),
};

// Check if all move buttons are correctly initialized
if (
  moveButtons.north && moveButtons.south && moveButtons.west &&
  moveButtons.east && moveButtons.reset && moveButtons.sensor
) {
  moveButtons.north.addEventListener("click", () => movePlayer(1, 0)); // Move north
  moveButtons.south.addEventListener("click", () => movePlayer(-1, 0)); // Move south
  moveButtons.west.addEventListener("click", () => movePlayer(0, -1)); // Move west
  moveButtons.east.addEventListener("click", () => movePlayer(0, 1)); // Move east
  moveButtons.reset.addEventListener("click", () => resetPlayer()); // Reset position
  moveButtons.sensor.addEventListener("click", () => toggleGeolocation()); // Toggle geolocation
} else {
  console.error("One or more move buttons are not found in the DOM.");
}

// Function to move the player
function movePlayer(deltaI: number, deltaJ: number) {
  const newLatLng = leaflet.latLng(
    playerMarker.getLatLng().lat + deltaI * TILE_DEGREES,
    playerMarker.getLatLng().lng + deltaJ * TILE_DEGREES,
  );

  map.setView(newLatLng);
  playerMarker.setLatLng(newLatLng);
  playerPath.push(newLatLng);
  polyline.setLatLngs(playerPath);

  const { i: newI, j: newJ } = latLngToCell(newLatLng.lat, newLatLng.lng);
  for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
    for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
      const cellI = newI + di;
      const cellJ = newJ + dj;
      if (luck([cellI, cellJ].toString()) < CACHE_SPAWN_PROBABILITY) {
        spawnCache(cellI, cellJ);
      }
    }
  }
}

// Function to reset the player to the initial location
function resetPlayer() {
  const confirmation = prompt(
    "Are you sure you want to erase your game state? Type 'yes' to confirm.",
  );
  if (confirmation === "yes") {
    const initialLatLng = OAKES_CLASSROOM;
    map.setView(initialLatLng);
    playerMarker.setLatLng(initialLatLng);
    playerPath.length = 0;
    playerPath.push(initialLatLng);
    polyline.setLatLngs(playerPath);
    playerPoints = 0;
    playerInventory.length = 0;
    cacheCoins.clear();
    directions.innerHTML = "No points yet...";
    localStorage.clear();
  }
}

// Function to toggle geolocation
let geolocationWatchId: number | null = null;
function toggleGeolocation() {
  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
  } else {
    geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLatLng = leaflet.latLng(latitude, longitude);
        map.setView(newLatLng);
        playerMarker.setLatLng(newLatLng);
        playerPath.push(newLatLng);
        polyline.setLatLngs(playerPath);
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    );
  }
}

// Memento pattern to save and restore cache state
class CacheMemento {
  constructor(
    public state: Map<
      string,
      { original: { i: number; j: number }; serial: number }[]
    >,
  ) {}
}

class CacheCaretaker {
  private mementos: CacheMemento[] = [];

  save(
    state: Map<
      string,
      { original: { i: number; j: number }; serial: number }[]
    >,
  ) {
    this.mementos.push(new CacheMemento(new Map(state)));
  }

  restore():
    | Map<string, { original: { i: number; j: number }; serial: number }[]>
    | undefined {
    const memento = this.mementos.pop();
    return memento ? new Map(memento.state) : undefined;
  }
}

const cacheCaretaker = new CacheCaretaker();
cacheCaretaker.save(cacheCoins);

// Save state to local storage
globalThis.addEventListener("beforeunload", () => {
  localStorage.setItem("playerPoints", JSON.stringify(playerPoints));
  localStorage.setItem("playerInventory", JSON.stringify(playerInventory));
  localStorage.setItem(
    "cacheCoins",
    JSON.stringify(Array.from(cacheCoins.entries())),
  );
  localStorage.setItem("playerPath", JSON.stringify(playerPath));
});

// Load state from local storage
globalThis.addEventListener("load", () => {
  const savedPlayerPoints = localStorage.getItem("playerPoints");
  const savedPlayerInventory = localStorage.getItem("playerInventory");
  const savedCacheCoins = localStorage.getItem("cacheCoins");
  const savedPlayerPath = localStorage.getItem("playerPath");

  if (savedPlayerPoints) {
    playerPoints = JSON.parse(savedPlayerPoints);
  }
  if (savedPlayerInventory) {
    playerInventory.push(...JSON.parse(savedPlayerInventory));
  }
  if (savedCacheCoins) {
    const entries = JSON.parse(savedCacheCoins);
    entries.forEach(
      (
        [key, value]: [
          string,
          { original: { i: number; j: number }; serial: number }[],
        ],
      ) => {
        cacheCoins.set(key, value);
      },
    );
  }
  if (savedPlayerPath) {
    playerPath.push(...JSON.parse(savedPlayerPath));
    polyline.setLatLngs(playerPath);
  }
});
