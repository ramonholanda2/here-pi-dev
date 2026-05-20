// public/js/main.js
import { state } from './config.js';
import { getSalesOffices, initApp, loadCustomers } from './init.js';
import { optimizeRoute, clearRoute } from './routing.js';
import { openFormRoute, saveRoute, closeFormRoute, clearFormRoute, renderEmployeesTable } from './form-route.js';
import {
  enablePolygonSelection,
  clearPolygonSelection,
  selectClientsInPolygon,
  hidePolygonActions,
  hidePolygonInstructions,
  showPolygonActions
} from './polygon.js';
import { setupFiltersToggle } from './filters-toggle.js';
import { applyFiltersAndRender, clearFilters, renderCustomers, toggleShowSelected, renderRepresentativesTable } from './filters.js';
import { validateRouteForm } from './route-form-validate.js';
import { showToast } from './util.js';
import { deselectAllCustomers, getSelectedClients } from './customers.js';
import { closeOfficesModal, getSelectedOffices, openOfficesModal } from './modal-offices.js';

document.addEventListener('DOMContentLoaded', async () => {

  setupFiltersToggle();

  document.getElementById('sidebarToggle').addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    const map = document.getElementById('mapContainer');

    if (window.innerWidth <= 768) {
      sidebar.classList.remove('mobile-open');
      return;
    }

    sidebar.classList.toggle('collapsed');
    map.classList.toggle('expanded');

    const existing = document.getElementById('sidebarCollapsedControls');
    if (sidebar.classList.contains('collapsed')) {
      const panel = document.createElement('div');
      panel.id = 'sidebarCollapsedControls';
      panel.innerHTML = `
      <button id="btnExpandSidebar" title="Mostrar painel">▶</button>
      <button id="btnShowAll" title="Clientes do escritório">🏢</button>
      <button id="btnShowSelected" title="Clientes selecionados">✓</button>
    `;
      map.appendChild(panel);

      document.getElementById('btnExpandSidebar').addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        map.classList.remove('expanded');
        panel.remove();
        setTimeout(() => state.map?.getViewPort()?.resize(), 350);
      });

      if (window.innerWidth <= 768) {
        document.getElementById('btnExpandSidebar').addEventListener('click', () => {
          sidebar.classList.add('mobile-open');
        });
      }

      document.getElementById('btnShowAll').addEventListener('click', () => {
        if (state.showOnlySelected) {
          showToast('Mostrando clientes do escritório.', 'success');
          toggleShowSelected(state);
          document.getElementById('btnToggleSelected').textContent = 'Clientes Selecionados';
        }
      });

      document.getElementById('btnShowSelected').addEventListener('click', () => {
        if (!state.showOnlySelected) {
          showToast('Mostrando clientes selecionados.', 'success');
          toggleShowSelected(state);
          document.getElementById('btnToggleSelected').textContent = 'Clientes do escritório';
        }
      });

    } else if (existing) {
      existing.remove();
    }

    setTimeout(() => state.map?.getViewPort()?.resize(), 350);
  });

  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    const map = document.getElementById('mapContainer');
    sidebar.classList.add('collapsed');
    map.classList.add('expanded');

    const panel = document.createElement('div');
    panel.id = 'sidebarCollapsedControls';
    panel.innerHTML = `
    <button id="btnShowAll" title="Clientes do escritório">🏢</button>
    <button id="btnShowSelected" title="Clientes selecionados">✓</button>
    <button id="btnExpandSidebar" title="Mostrar painel">▶</button>
  `;
    map.appendChild(panel);

    document.getElementById('btnExpandSidebar').addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
    });

    document.getElementById('btnShowAll').addEventListener('click', () => {
      if (state.showOnlySelected) {
        showToast('Mostrando clientes do escritório.', 'success');
        toggleShowSelected(state);
        document.getElementById('btnToggleSelected').textContent = 'Clientes Selecionados';
      }
    });

    document.getElementById('btnShowSelected').addEventListener('click', () => {
      if (!state.showOnlySelected) {
        showToast('Mostrando clientes selecionados.', 'success');
        toggleShowSelected(state);
        document.getElementById('btnToggleSelected').textContent = 'Clientes do escritório';
      }
    });
  }

  await initApp()

  async function loadRepresentatives(salesOffices) {
    console.log("loadRepresentatives salesOffices: ", salesOffices);
    if(!salesOffices) {
      window._allRepresentatives = []
    }

    var orgs = salesOffices.offices ? salesOffices?.offices.map(office => office.OrgUnitID) : salesOffices?.map(office => office.OrgUnitID);
    try {
      const { data } = await axios.get("/api/representantes", {
        params: {
          salesOfficesIDs: orgs.join(',')
        }
      });

      let representativeList = data || [];

      window._allRepresentatives = representativeList;
    } catch (error) {
      console.log("Erro ao carregar representantes", error);
      window._allRepresentatives = [];
    }
  }

  await getSalesOffices().then(async (salesOffices) => {
    const btnOffices = document.getElementById("btnOffices");

    if (!salesOffices.haveOfficesByEmployee) {
      showToast('Nenhum escritório vinculado ao usuário, por favor selecione e tente novamente.', 'error', 5000);
    }

    btnOffices.textContent = salesOffices.haveOfficesByEmployee
      ? "Ver Escritórios"
      : "Selecionar Escritórios";

    btnOffices.onclick = () => openOfficesModal(salesOffices.haveOfficesByEmployee, salesOffices.offices);
    if(salesOffices.haveOfficesByEmployee) {
      await loadRepresentatives(salesOffices.offices);
    }

  }).catch((error) => {
    console.log('error', error)
  });

  await loadCustomers().then(() => {
    renderCustomers()
  });

  document.getElementById('btnClearRoute')?.addEventListener('click', () => clearRoute(state));
  document.getElementById('btnOpenFormRoute')?.addEventListener('click', () => {
    openFormRoute(state);
    hidePolygonActions();
    hidePolygonInstructions();
  });
  const closeModalOffices = document.getElementsByClassName('closeModal');
  Array.from(closeModalOffices).forEach(item => {
    item.addEventListener('click', () => {
      closeOfficesModal();
    });
  });

  document.getElementById('btnSelectArea')?.addEventListener('click', () => enablePolygonSelection(state, 'triangle'));
  document.getElementById('btnSelectSquare')?.addEventListener('click', () => enablePolygonSelection(state, 'square'));
  document.getElementById('btnSelectPentagon')?.addEventListener('click', () => enablePolygonSelection(state, 'pentagon'));
  document.getElementById('btnSelectCircle')?.addEventListener('click', () => enablePolygonSelection(state, 'circle'));

  let toggleSelectArea = false;

  const btnSelectShape = document.getElementById('btnSelectShape');
  const shapeMenu = document.getElementById('shapeMenu');
  const actionBar = document.querySelector('.action-bar');

  btnSelectShape?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSelectArea = !toggleSelectArea;
    toggleShapeMenu(btnSelectShape, shapeMenu, toggleSelectArea);
  });


  document.getElementById("btnDeselectAll").onclick = () => {
    deselectAllCustomers(state);
  };


  document.addEventListener('click', () => toggleShapeMenu(btnSelectShape, shapeMenu, false));

  function toggleShapeMenu(anchorBtn, menuEl, show) {
    if (!anchorBtn || !menuEl) return;
    if (!show) {
      menuEl.classList.add('hidden');
      return;
    }
    const btnRect = anchorBtn.getBoundingClientRect();
    const barRect = actionBar.getBoundingClientRect();

    menuEl.style.top = `${(btnRect.bottom - barRect.top) + 8}px`;
    menuEl.style.left = `${(btnRect.left - barRect.left)}px`;
    menuEl.classList.remove('hidden');

    menuEl.querySelector('.shape-option')?.focus();
  }

  const btnSaveForm = document.getElementById('btnSaveForm');
  btnSaveForm?.addEventListener('click', (e) => {
    const { valid, errors } = validateRouteForm();
    if (!valid) {
      btnSaveForm.disabled = true;
      setTimeout(() => {
        btnSaveForm.disabled = false;
      }, 1500);
      e.preventDefault();
      errors.forEach(err => showToast(err, 'error'));
      return;
    }

    btnSaveForm.disabled = true;

    saveRoute(state);

    setTimeout(() => {
      btnSaveForm.disabled = false;
    }, 1500);


  });

  const cancel = () => { closeFormRoute(); clearFormRoute(); };
  document.getElementById('btnCancelForm')?.addEventListener('click', e => {
    if (state.isShowPolygonActions == true) showPolygonActions()
    const title = document.getElementById('section-title');

    title.innerText = 'Clientes selecionados';

    cancel();
  });
  document.getElementById('btnCloseForm')?.addEventListener('click', e => {
    const title = document.getElementById('section-title');

    title.innerText = 'Clientes selecionados';

    if (state.isShowPolygonActions == true) showPolygonActions()
    cancel();
  });

  document.addEventListener('polygon:clear', () => clearPolygonSelection(state));
  document.addEventListener('polygon:selectClients', () => selectClientsInPolygon(state));

  const form = document.getElementById('filtersPanel');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    applyFiltersAndRender(state);
  });

  document.getElementById("btnToggleSelected").onclick = () => {
    toggleShowSelected(state);

    document.getElementById("btnToggleSelected").textContent = state.showOnlySelected ? "Clientes do escritório" : "Clientes Selecionados";
  };


  document.getElementById("btnSearchOffices").onclick = async () => {
    const loader = document.getElementById("LoadingModal");
    loader.classList.remove("hidden");

    try {
      const selectedOffices = getSelectedOffices();
      console.log("Selected offices: ", selectedOffices);
      const officeIds = selectedOffices.map(office => office.OrgUnitID);

      await loadCustomers({ salesOfficesIDs: officeIds.join(',') }).then(renderCustomers);

      state.showOnlySelected = false;

      document.getElementById("btnToggleSelected").textContent = "Clientes Selecionados";

      closeOfficesModal();

      await loadRepresentatives(selectedOffices);

    } finally {
      loader.classList.add("hidden");
    }
  };

  const filterBTN = document.getElementById("applyFiltersBtn");
  filterBTN?.addEventListener("click", () => {
    applyFiltersAndRender(state.showOnlySelected);
  });

  const clearFilterBTN = document.getElementById("clearFiltersBtn");
  clearFilterBTN?.addEventListener("click", () => {
    clearFilters();
  });

  const tbodyCustomers = document.querySelector("#tableCustomers tbody");

  tbodyCustomers.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".remove-selected-client");
    if (!btn) return;

    const id = btn.dataset.id;

    const tr = btn.closest("tr");
    if (tr) tr.remove();

    state.selectedCustomers.delete(id);

    const checkbox = document.querySelector(`.client-checkbox[data-id="${id}"]`);
    if (checkbox) {
      checkbox.checked = false;
      checkbox.closest(".client-item")?.classList.remove("selected");
    }

    const customersSelected = getSelectedClients(state);
    const tableTitle = document.getElementById('section-title');
    if (tableTitle) {
      tableTitle.innerHTML = `(${customersSelected.length}) Clientes selecionados`;
    }

    if (customersSelected.length === 0) {
      showToast('Selecione pelo menos um cliente para criar uma rota.', 'error', 5000);
      closeFormRoute();
    }
  });


  document.getElementById("routeOwner")?.addEventListener("click", async () => {
    const modal = document.getElementById("employeesModal");
    const tbody = document.querySelector("#employeesTable tbody");

    modal.classList.remove("hidden");
    tbody.innerHTML = `<tr><td colspan="2">Carregando...</td></tr>`;

    try {
      const { data } = await axios.get("/api/empregados");


      var employeeList = data;

      const isTradeMKT =
        state.currentUserRoles?.some(
          role =>
            role.BusinessRoleID === "TRADE_MARKETING"
        )

      if (isTradeMKT) {
        const tradePromotors = data.filter(employee =>
          employee.EmployeeUserBusinessRoleAssignment?.some(
            role => role.BusinessRoleID === "PROMOTOR_TRADE"
          )
        );

        employeeList = tradePromotors
      }

      window._allEmployees = employeeList;


      renderEmployeesTable(employeeList);

    } catch (e) {
      console.log(e);
      tbody.innerHTML = `<tr><td colspan="2">Erro ao carregar empregados</td></tr>`;
    }
  });

  document.addEventListener("click", ev => {
    const btn = ev.target.closest(".select-employee");
    if (!btn) return;

    document.getElementById("routeOwner").dataset.id = btn.dataset.id;
    document.getElementById("routeOwnerName").textContent = btn.dataset.name;

    document.getElementById("employeesModal").classList.add("hidden");
  });

  document.addEventListener("click", ev => {
    const btn = ev.target.closest(".select-representative");
    if (!btn) return;

    const inputEquipe = document.getElementById("f_equipe");

    if (inputEquipe) {
      inputEquipe.value = btn.dataset.name || "";
      inputEquipe.dataset.id = btn.dataset.id || "";
    }

    document.getElementById("representativesModal").classList.add("hidden");

    applyFiltersAndRender(state.showOnlySelected);
  });

  document.querySelectorAll(".closeEmployeesModal").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("employeesModal").classList.add("hidden");
    });
  });


  document.getElementById("f_equipe")?.addEventListener("click", () => {
    const modal = document.getElementById("representativesModal");
    const tbody = document.querySelector("#representativesTable tbody");
    const searchInput = document.getElementById("representativeSearch");

    modal.classList.remove("hidden");

    if (searchInput) searchInput.value = "";

    if (!window._allRepresentatives || !window._allRepresentatives.length) {
      tbody.innerHTML = `<tr><td colspan="2">Nenhum registro encontrado</td></tr>`;
      return;
    }

    renderRepresentativesTable(window._allRepresentatives);
  });

  document.querySelectorAll(".closeRepresentativesModal").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("representativesModal").classList.add("hidden");
    });
  });


  document.getElementById("employeeSearch")?.addEventListener("input", ev => {
    const term = ev.target.value.toLowerCase().trim();

    const filtered = window._allEmployees.filter(emp =>
      emp.BusinessPartnerFormattedName.toLowerCase().includes(term)
    );

    renderEmployeesTable(filtered);
  });




  document.getElementById("representativeSearch")?.addEventListener("input", ev => {
    const term = ev.target.value.toLowerCase().trim();

    const filtered = (window._allRepresentatives || []).filter(rep => {
      const name =
        rep.OrgUnitID || "";

      const id =
        rep.OrgUnitName || "";

      return (
        name.toLowerCase().includes(term) ||
        String(id).toLowerCase().includes(term)
      );
    });

    renderRepresentativesTable(filtered);
  });

  let listFieldsName = ['f_nome', 'f_status', 'f_cidade', 'f_cnpj', 'f_idsap', 'f_equipe', 'f_pin', 'f_estado'];

  listFieldsName.forEach(id => {
    const el = document.getElementById(id);
    if (el?.tagName === 'INPUT') {
      el.addEventListener('keyup', (ev) => {
        if (ev.key === 'Enter') applyFiltersAndRender(state.showOnlySelected);
      });
    }
  });
});