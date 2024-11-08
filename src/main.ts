import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

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

function latLngToCell(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor(lat * 1e4),
    j: Math.floor(lng * 1e4),
  };
}

function spawnCache(i: number, j: number) {
  const bounds = leaflet.latLngBounds([
    [i * TILE_DEGREES, j * TILE_DEGREES],
    [(i + 1) * TILE_DEGREES, (j + 1) * TILE_DEGREES],
  ]);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    const cacheKey = `${i},${j}`;
    const coins = cacheCoins.get(cacheKey) ?? [];
    if (coins.length === 0) {
      const initialCoins = Math.floor(luck([i, j, "coins"].toString()) * 10);
      for (let serial = 0; serial < initialCoins; serial++) {
        coins.push({ original: { i, j }, serial });
      }
      cacheCoins.set(cacheKey, coins);
    }
    const popupDiv = document.createElement("div");
    const list = document.createElement("ul");
    coins.forEach((coin, index) => {
      const listItem = document.createElement("li");
      listItem.innerHTML =
        `${coin.original.i}:${coin.original.j}#${coin.serial}`;
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
  });
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
