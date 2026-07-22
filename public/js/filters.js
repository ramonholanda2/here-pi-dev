// public/js/filters.js
import { createClusterLayer } from './clusters.js';
import { state } from './config.js';
import { getSelectedClients } from './customers.js';
import { renderCustomerList } from './list.js';
import { showToast } from './util.js';
//import { clearMarkers } from './markers.js';

const LS_KEY = 'clientes_filtros_v1';

const fieldMap = {
  nome: ['CustomerName'],
  statusCliente: ['Z_Classificao_KUT'],
  estado: ['CustomerPostalAddress.0.RegionCode', 'RegionCode'],
  cidade: ['CustomerPostalAddress.0.CityName', 'CityName'],
  cnpj: ['zCNPJ_KUT'],
  idSap: ['CustomerInternalID'],
  /* regiao: ['SalesOfficeName'], */
  equipeVendas: ['SalesGroupName'],
  equipeVendasID: ['SalesGroupID'],
};

function norm(v) {
  return (v ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getFirst(obj, keys = []) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
}

export function getFiltersFromUI() {
  return {
    nome: document.getElementById('f_nome')?.value?.trim() || '',
    statusCliente: document.getElementById('f_status')?.value || '',
    estado: document.getElementById('f_estado')?.value?.trim() || '',
    cidade: document.getElementById('f_cidade')?.value?.trim() || '',
    cnpj: document.getElementById('f_cnpj')?.value?.trim() || '',
    idSap: document.getElementById('f_idsap')?.value?.trim() || '',
    /* regiao: document.getElementById('f_regiao')?.value?.trim() || '', */
    equipeVendas: document.getElementById('f_equipe')?.value?.trim() || '',
    pin: document.getElementById('f_pin')?.value || '',
  };
}

export function renderRepresentativesTable(list) {
  const tbody = document.querySelector("#representativesTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  list.forEach(rep => {
    const repId =
      rep.OrgUnitID || "";

    const repName =
      rep.OrgUnitName || "";

    const repNamePF = rep?.AddressSnapshotDisplayName?.[0]?.FirstLineName || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td class="employee-name">${repNamePF}</td>
        <td>
          <button
            class="select-representative"
            data-id="${repName}"
            data-name="${repNamePF}">
            Selecionar
          </button>
        </td>
      `;
    tbody.appendChild(tr);
  });
}


export function filterCustomers(all, filters) {
  const f = {
    nome: norm(filters.nome),
    statusCliente: norm(filters.statusCliente),
    estado: norm(filters.estado),
    cidade: norm(filters.cidade),
    cnpj: filters.cnpj?.replace(/\D/g, ''),
    idSap: norm(filters.idSap),
    /*  regiao: norm(filters.regiao), */
    equipeVendas: norm(filters.equipeVendas),
    pin: norm(filters.pin),
  };


  return all.filter(customer => {
    if (f.nome) {
      const nome = norm(getFirst(customer, fieldMap.nome));
      if (!nome.includes(f.nome)) return false;
    }

    if (f.statusCliente) {
      const status = norm(getFirst(customer, fieldMap.statusCliente));
      if (!status || !status.includes(f.statusCliente)) return false;
    }


    if (f.estado) {
      const estadoRaw =
        customer.CustomerPostalAddress?.[0]?.RegionCode ||
        customer.RegionCode ||
        '';

      const estado = norm(estadoRaw) || norm(customer.FormattedPostalAddressDescription || '');

      if (!estado.includes(f.estado)) return false;
    }

    // ===== CIDADE =====
    if (f.cidade) {
      const cidadeRaw =
        customer.CustomerPostalAddress?.[0]?.CityName ||
        customer.CityName ||
        '';

      const cidade = norm(cidadeRaw) || norm(customer.FormattedPostalAddressDescription || '');

      if (!cidade.includes(f.cidade)) return false;
    }

    // cnpj (contains somente dígitos)
    if (f.cnpj) {
      const raw = getFirst(customer, fieldMap.cnpj).toString();
      const onlyDigits = raw.replace(/\D/g, '');
      if (!onlyDigits.includes(f.cnpj)) return false;
    }

    // id SAP (contains)
    if (f.idSap) {
      const id = norm(getFirst(customer, fieldMap.idSap));
      if (!id.includes(f.idSap)) return false;
    }

    // região (contains)
    /* if (f.regiao) {
      const regiao = norm(getFirst(customer, fieldMap.regiao));
      if (!regiao.includes(f.regiao)) return false;
    } */

    // equipe de vendas (contains)
    if (f.equipeVendas) {
      const equipe = norm(getFirst(customer, fieldMap.equipeVendas));
      const equipeID = norm(getFirst(customer, fieldMap.equipeVendasID));
      if (!equipe.includes(f.equipeVendas) && !equipeID.includes(f.equipeVendas)) return false;
    }

    return true;
  });
}

export function toggleShowSelected(state) {
  state.showOnlySelected = !state.showOnlySelected;
  applyFiltersAndRender(state.showOnlySelected);
}


export function getCustomersFiltered() {
  const customers = state.showOnlySelected ? Array.from(state.selectedCustomers.values()) : state.allCustomers;
  return filterCustomers(customers, getFiltersFromUI());
}


export function clearFilters() {
  [
    'f_nome',
    'f_status',
    'f_estado',
    'f_cidade',
    'f_cnpj',
    'f_idsap',
    'f_equipe',
    'f_equipe_pf',
    'f_pin'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  applyFiltersAndRender(state.showOnlySelected);
}

export function applyFiltersAndRender(showOnlySelected = false) {

  let customersToRender;
  let customersSelectedLength = 0;

  if (showOnlySelected) {
    const filters = {};
    const customersSelected = Array.from(state.selectedCustomers.values());
    customersSelectedLength = customersSelected.length;
    customersToRender = filterCustomers(customersSelected, filters);

  } else {
    const filters = getFiltersFromUI();
    //const customersSelected = Array.from(state.selectedCustomers.values());
    customersToRender = filterCustomers(state.allCustomers, filters);
  }

  renderCustomerList(state, customersToRender);

  if (state.clusterLayer) {
    state.map.removeLayer(state.clusterLayer);
  }

  state.clusterLayer = createClusterLayer(customersToRender, state);
  state.map.addLayer(state.clusterLayer);

  const info = document.querySelector('.header-info');
  if (info) info.textContent = `Mostrando ${customersToRender.length} de ${showOnlySelected ? customersSelectedLength : state.allCustomers.length}`;
}



export function renderCustomers() {
  let saved = {}
  /* try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch {}
  setFiltersToUI(saved); */


  const filtered = filterCustomers(state.allCustomers, saved);

  renderCustomerList(state, filtered);

  if (filtered.length === state.allCustomers.length && state.allCustomers.length > 0) {
    showToast(`${state.allCustomers.length} clientes foram carregados.`, 'success');
  }

  const info = document.querySelector('.header-info');
  if (info) info.textContent = `Mostrando ${filtered.length} de ${state.allCustomers.length}`;
}
