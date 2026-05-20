// js/config.js

/* export const apiKey = process.env.HERE_API_KEY;
 */


export const statusColors = {
  "CRESCENDO": "green",
  "ESTAVEL": "yellow",
  "QUEDA": "red",
  "INATIVO": "gray",
  "SEMVARIACAO": "gray",
};

export const state = {
  salesCloudURL: null,
  allCustomers: [],
  selectedCustomers: new Map(),
  currentUserRoles: [],
  showOnlySelected: false,
  isShowPolygonActions: false,
  map: null,
  platform: null,
  ui: null,
  router: null,
  markers: [],
  clusterLayer: null,
  routeLine: null,
  currentRoute: null,
  // Seleção poligonal
  polygonSelectionMode: false,
  selectionShape: "",
  currentPolygon: null,
  polygonGroup: null,
  polygonPoints: [],
};

