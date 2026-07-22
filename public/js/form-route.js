// js/form-route.js
import { getSelectedClients } from './customers.js';
import { clearRoute } from './routing.js';
import { showToast } from './util.js';

export async function openFormRoute(state) {

  console.log("state.polygonSelectionMode", state.currentPolygon)
  if (state.currentPolygon != null) {
      document.dispatchEvent(new CustomEvent('polygon:selectClients'));
  }

  const customers = getSelectedClients(state);

  if (customers.length === 0) {
    showToast(
      'Selecione pelo menos um cliente para criar uma rota.',
      'error',
      5000
    );
    return;
  }

  document.getElementById("FormRoute").classList.remove("hidden");

  const params = new URLSearchParams(window.location.search);
  const employeeID = params.get("employeeID");

  const { data } = await axios.get(
    `/api/empregado?employeeID=${employeeID}`
  );

  const organizerInput = document.getElementById('routeOrganizer');
  const routeOwnerInput = document.getElementById("routeOwner");

  routeOwnerInput.dataset.id = data?.EmployeeID;

  document.getElementById("routeOwnerName").textContent =
    data?.name;

  organizerInput.value = data?.name || '';

  const isSupervisor =
    state.currentUserRoles?.some(
      role =>
        role.BusinessRoleID === "SUP_COMERCIAL"
    )
  const isTradeMarketing = state.currentUserRoles?.some(
    role =>
      role.BusinessRoleID === "TRADE_MARKETING"
  )

  if (isSupervisor) {

    const typeVisit = document.getElementById('routeTypeVisit')

    console.log("opções antes", [...typeVisit.options].map(o => o.value))

    const notAllowedValues = ["Z08"];

    [...typeVisit.options].forEach(option => {
      if (notAllowedValues.includes(option.value)) {
        option.remove();
      }
    });

    const routeOwnerInput = document.getElementById("routeOwner");
    routeOwnerInput.setAttribute("disabled", true);
    routeOwnerInput.style.pointerEvents = "none";

    typeVisit.value = "Z01";
    typeVisit.classList.remove("field-error")
  } else {
    routeOwnerInput.style.pointerEvents = "auto";
    routeOwnerInput.style.opacity = "1";
    routeOwnerInput.style.cursor = "pointer";
  }

  if (isTradeMarketing) {
    const typeVisit = document.getElementById('routeTypeVisit')
    const allowedValues = ["Z08", "Z09", "Z10"];

    [...typeVisit.options].forEach(option => {
      if (!allowedValues.includes(option.value)) {
        option.remove();
      }
    });

    typeVisit.value = "Z08";
    typeVisit.classList.remove("field-error")
  }

  const tableTitle = document.getElementById('section-title');

  if (tableTitle) {
    tableTitle.innerHTML =
      `(${customers.length}) Clientes selecionados`;
  }

  const tbody = document.querySelector("#tableCustomers tbody");

  tbody.innerHTML = "";

  customers.forEach(customer => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${customer.CustomerInternalID}</td>
      <td>${customer.CustomerName}</td>
      <td class="createRouteCustomerAddress">
        ${customer.FormattedPostalAddressDescription}
      </td>
      <td class="remove-cell">
        <button
          class="remove-selected-client"
          data-id="${customer.CustomerInternalID}">
          ✕
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}
export function renderEmployeesTable(list) {
  const tbody = document.querySelector("#employeesTable tbody");
  tbody.innerHTML = "";

  list.forEach(emp => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="employee-name">${emp.BusinessPartnerFormattedName}</td>
      <td><button class="select-employee"
                 data-id="${emp.EmployeeID}"
                 data-name="${emp.BusinessPartnerFormattedName}">
                 Selecionar</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

export function closeFormRoute() {
  document.getElementById("FormRoute").classList.add("hidden");
}

export async function saveRoute(state) {


  const nameRoute = document.getElementById('routeName').value.trim();
  const initialDate = document.getElementById('routeDate').value;
  const typeVisit = document.getElementById('routeTypeVisit')
  const typeVisitDesc = typeVisit.options[typeVisit.selectedIndex].text;

  const notes = document.getElementById('routeNotes').value.trim();

  var notesObject = {};
  if (notes) notesObject = { RouteNotes: [{ TypeCode: "10002", Text: notes }] };

  const daysWeekCheckboxes = document.querySelectorAll('.days-week input[type="checkbox"]');
  const daysSelected = Array.from(daysWeekCheckboxes)
    .map((checkbox, index) => checkbox.checked ? getNameDay(index) : null)
    .filter(Boolean);

  function getNameDay(index) {
    const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    return days[index];
  }

  const selectedCustomers = getSelectedClients(state);
  const timestampMs = new Date(initialDate).getTime();
  const startDateFormatted = `/Date(${timestampMs})/`;

  const daysWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const excludeDays = {};
  daysWeek.forEach((day, index) => {
    excludeDays[`Exclude${day}Indicator`] = daysSelected.includes(getNameDay(index));
  });

  const routeAccounts = selectedCustomers.map(customer => ({
    AccountID: customer.CustomerInternalID,
    Duration: "PT1H",
    StartTime: "PT08H00M00S",
    EndTime: "PT09H00M00S",
    PreparationTime: "PT1H",
    VisitTypeCode: typeVisit.value,
    zUnidadeDuracao_KUT: "Hora",
    zTempoDuracao_KUT: "1"
  }));


  const params = new URLSearchParams(window.location.search);
  const employeeID = params.get("employeeID");
  const ownerID = document.getElementById("routeOwner").dataset.id;

  const payload = {
    Name: nameRoute || "Nova Rota",
    RouteTypeCode: "2",
    StartDate: startDateFormatted,
    EndDate: startDateFormatted,
    ...excludeDays,
    DefaultStartTime: "PT08H00M00S",
    DefaultPreparationTime: "PT1H",
    DefaultDuration: "PT1H",
    Status: "2",
    ProcessingStatus: "1",
    /* VisitTypeCode: typeVisit.value, */
    OwnerPartyID: ownerID,
    OrganizerPartyID: employeeID,
    AutomaticResequencing: true,
    //RouteCategoryCode: "P1D",
    RouteAccount: routeAccounts,
    Z_TipoVisita_KUT: `${typeVisit.value} - ${typeVisitDesc}`,
    ...notesObject
  };


  
  const loader = document.getElementById("LoadingModal");
  loader.classList.remove("hidden");

  try {

    await axios.post('/api/rotas', payload)
      .then(async (route) => {

        const timeMessageMS = 4000;
        showToast('Rota criada com sucesso.', 'success', timeMessageMS);

        const url = `https://${state.salesCloudURL}/sap/byd/nav?bo=ROUTE_TT&nav_mode=TI&param.Key=${route.data.ObjectID}`
        //const url = `/api/rotas/redirecionar/${route.data.ObjectID}`;
        //const response = await axios.get(url);
        const linkRouteCreated = decodeURIComponent(url);
        window.top.location.href = linkRouteCreated;

      })

    closeFormRoute();
    clearFormRoute();
    clearRoute(state);
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar rota, por favor entre em contato com o suporte.', 'error', 5000);
  } finally {
    loader.classList.add("hidden");
  }
}

export function clearFormRoute() {
  document.getElementById('routeName').value = '';
  document.getElementById('routeDate').value = '';
  document.getElementById('routeTypeVisit').value = '';
  document.getElementById('routeNotes').value = '';
  document.querySelectorAll('.days-week input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.querySelector('#tableCustomers tbody').innerHTML = '';
}