// public/js/init.js
import { state } from './config.js';

export async function getSalesOffices() {
  const params = new URLSearchParams(window.location.search);
  const employeeID = params.get('employeeID');

  const { data } = await axios.get(`/api/escritorios?employeeID=${employeeID}`);

  return data;
}

export async function loadCustomers(parameters) {
  try {

    const { data: urlSalesCloud } = await axios.get("/api/salescloud/url");
    state.salesCloudURL = urlSalesCloud;

    const params = new URLSearchParams(window.location.search);
    const employeeID = params.get('employeeID');

    const { data: roles } = await axios.get(`/api/funcoes/${employeeID}`);
    state.currentUserRoles = roles[0]?.BusinessUserBusinessRoleAssignment;

    let url = `/api/clientes`;

    if (employeeID) {
      url = `/api/clientes?employeeID=${encodeURIComponent(employeeID)}`
    }
    if (parameters?.salesOfficesIDs) {
      url = `/api/clientes?salesOfficesIDs=${encodeURIComponent(parameters?.salesOfficesIDs)}`;
    }
    
    console.log('[loadCustomers] GET', url);
    const { data } = await axios.get(url);

    const clientList = document.getElementById("clientList");
    if (clientList) {
      clientList.innerHTML = "";
      document.querySelector('.loading')?.classList.remove('loading');
    }

    const list =
      Array.isArray(data) ? data
        : Array.isArray(data?.results) ? data.results
          : Array.isArray(data?.items) ? data.items
            : [];

    if (!list.length) {
      console.warn('[loadCustomers] Nenhum cliente retornado. Resposta:', data);
    }

    console.log('[loadCustomers] clientes', list);

    state.allCustomers = list;
    //initApp();
  } catch (err) {
    console.error('Erro ao carregar clientes:', err?.response?.data || err);
    const clientList = document.getElementById("clientList");
    if (clientList) clientList.innerText = "Erro ao carregar clientes.";
  }
}

export async function initApp() {

  const { data } = await axios.get("/api/here/config");

  state.platform = new H.service.Platform({ apikey: data.apiKey });
  const defaultLayers = state.platform.createDefaultLayers();

  state.map = new H.Map(
    document.getElementById("mapContainer"),
    defaultLayers.vector.normal.map,
    {
      center: { lat: -24.5, lng: -52 },
      zoom: 6,
      pixelRatio: window.devicePixelRatio || 1
    }
  );

  state.map.getViewModel().addEventListener("sync", function () {
    const zoom = state.map.getZoom();
    const maxZoomOut = 5.5;
    if (zoom < maxZoomOut) {
      state.map.setZoom(maxZoomOut);
    }
  });

  window.addEventListener("resize", () => state.map.getViewPort().resize());
  new H.mapevents.Behavior(new H.mapevents.MapEvents(state.map));
  state.ui = H.ui.UI.createDefault(state.map, defaultLayers);

  state.ui.removeControl('mapsettings');
  const ms = new H.ui.MapSettingsControl({
    baseLayers: [
      { label: 'normal', layer: defaultLayers.vector.normal.map },
      { label: 'satellite', layer: defaultLayers.raster.satellite.map },
      { label: 'terrain', layer: defaultLayers.raster.terrain.map }
    ],
    layers: []
  });
  state.ui.addControl('customized', ms);

  state.router = state.platform.getRoutingService(null, 8);

  //renderCustomers();
}