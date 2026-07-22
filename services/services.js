
import { getDestination } from "@sap-cloud-sdk/connectivity"
import { executeHttpRequest } from "@sap-cloud-sdk/http-client"


async function getEmployeeInfo(employeeID) {

  try {
    const destination = await getDestination({ destinationName: "SALES_CLOUD" });

    const response = await executeHttpRequest(
      destination,
      { method: "GET", url: `/sap/c4c/odata/v1/c4codataapi/BusinessUserCollection?$filter=EmployeeID eq '${employeeID}'&$format=json` }
    );

    const data = response.data.d.results.map(employee => ({
      id: employee.UserID,
      name: employee.BusinessPartnerFormattedName,
      BusinessPartnerID: employee.BusinessPartnerID,
      EmployeeID: employee.EmployeeID
    }));
    return data[0];

  } catch (error) {
    throw new Error('Erro ao obter informações do empregado:', error);
  }
}

async function getRolesByEmployee(employeeID) {
  try {
    const destination = await getDestination({
      destinationName: "SALES_CLOUD"
    });

    const response = await executeHttpRequest(destination, {
      method: "GET",
      url:
        `/sap/c4c/odata/v1/c4codataapi/BusinessUserCollection` +
        `?$filter=EmployeeID eq '${employeeID}'` +
        `&$expand=BusinessUserBusinessRoleAssignment` +
        `&$select=BusinessUserBusinessRoleAssignment/BusinessRoleID` +
        `&$format=json`
    });

    return response.data.d.results || [];

  } catch (error) {
    console.error(error);

    throw new Error(
      `Erro ao obter funções do empregado ${employeeID}`
    );
  }
}

async function getCustomers(queryOptions) {
  console.log('queryOptions', queryOptions);
  try {
    let customers = [];

    if (queryOptions.employeeID) {
      const orgUnitIds = await findOrganisationalUnitEmployees(queryOptions.employeeID);
      if (!orgUnitIds.length) {
        return { erro: true, mensagem: `Nenhuma Sales Office encontrada para o empregado ${queryOptions.employeeID}.` };
      }

      customers = await findCustomersBySalesOffice(orgUnitIds);
    }

    if (queryOptions.salesOfficesIDs) {
      const orgUnitIds = queryOptions.salesOfficesIDs.split(',');
      customers = await findCustomersBySalesOffice(orgUnitIds);
    }

    return customers;

  } catch (err) {
    console.error('getCustomers error:', err);
    return { erro: true, mensagem: 'Falha ao buscar clientes por Sales Office.', detalhes: err?.message };
  }
}


async function getSalesOffices(queryOptions) {

  if (queryOptions.employeeID) {
    const response = await findOrganisationalUnitEmployees(queryOptions.employeeID, true);
    if (response.length > 0) {
      return { haveOfficesByEmployee: true, offices: response };
    }
  }

  const pathAllOffices = "/sap/c4c/odata/v1/c4codataapi/OrganisationalUnitFunctionsCollection"
    + "?$filter=SalesOfficeIndicator eq true and OrganisationalUnit/LifeCycleStatusCode eq '2'"
    + "&$expand=OrganisationalUnit,OrganisationalUnit/OrganisationalUnitNameAndAddress&$select=OrganisationalUnitID,OrganisationalUnit/OrganisationalUnitNameAndAddress/Name"
    + "&$format=json";

  

  const destination = await getDestination({ destinationName: "SALES_CLOUD" });
  const allOffices = await executeHttpRequest(
    destination,
    { method: "GET", url: pathAllOffices }
  );

  const results = allOffices?.data?.d?.results || [];

  const salesOffices = results.map(office => ({ OrgUnitID: office.OrganisationalUnitID, Name: office.OrganisationalUnit.OrganisationalUnitNameAndAddress[0].Name }));

  return { haveOfficesByEmployee: false, offices: salesOffices };
}

async function findOrganisationalUnitEmployees(businessPartnerId, onlyAndNamesIDs = false) {

  const base = `/sap/c4c/odata/cust/v1/organisational_unit_employee/OrganisationalUnitEmployeeAssignmentCollection`;
  const url = `${base}?$format=json&$filter=EmployeeID eq '${businessPartnerId}'`;

  try {
    const destination = await getDestination({ destinationName: "SALES_CLOUD" });
    const response = await executeHttpRequest(destination, { method: "GET", url });

    const results = response?.data?.d?.results || [];

    if (onlyAndNamesIDs) {
      const uniqueMap = new Map();
      results.forEach(office => {
        if (office.OrgUnitID) {
          if (!uniqueMap.has(office.OrgUnitID)) {
            uniqueMap.set(office.OrgUnitID, {
              OrgUnitID: office.OrgUnitID,
              Name: office.Name,
              SalesGroupIndicator: office.SalesGroupIndicator,
              SalesOfficeIndicator: office.SalesOfficeIndicator
            });
          }
        }
      });

      return Array.from(uniqueMap.values());
    }
    const ids = Array.from(
      new Map(
        results
          .filter(r => r?.OrgUnitID)
          .map(r => [r.OrgUnitID, r])
      ).values()
    );

    
    return ids;

  } catch (err) {
    console.error('findOrganisationalUnitEmployees error:', err);
    throw new Error(err);
  }
}


async function findCustomersBySalesOffice(orgUnitIds = []) {
  
  if (!orgUnitIds.length) return [];

  const base = process.env.CUSTOMER_ODATA_PATH;
  if (!base) return [];

  const salesOffices = [];
  const salesGroups = [];

  if (typeof orgUnitIds[0] === 'object') {
    for (const item of orgUnitIds) {
      if (item.SalesOfficeIndicator) salesOffices.push(item.OrgUnitID);
      if (item.SalesGroupIndicator) salesGroups.push(item.OrgUnitID);
    }
  }

  if (typeof orgUnitIds[0] === 'string') {
    salesOffices.push(...orgUnitIds);
  }

  const [officeResults, groupResults] = await Promise.all([
    salesOffices.length ? queryByField(base, 'CSALES_OFFICE_UUID', salesOffices) : [],
    salesGroups.length  ? queryByField(base, 'CSALES_GROUP_UUID',  salesGroups)  : [],
  ]);

  // ─── Merge ─────────────────────────────
  const byCustomer = new Map();

  for (const item of [...officeResults, ...groupResults]) {
    const key = item.CustomerInternalID;
    if (!key) continue;

    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        ...item,
        salesOffices: item.SalesOfficeID ? [item.SalesOfficeID] : []
      });
    } else {
      const acc = byCustomer.get(key);
      if (item.SalesOfficeID && !acc.salesOffices.includes(item.SalesOfficeID)) {
        acc.salesOffices.push(item.SalesOfficeID);
      }
    }
  }

  return Array.from(byCustomer.values());
}

async function queryByField(base, field, ids) {
  try {
    const filter = ids
      .map(id => `${field} eq '${String(id).replace(/'/g, "''")}'`)
      .join(' or ');

    const url = `${base}?$format=json&$filter=${encodeURI(filter)}&$top=99999`;
    

    const destination = await getDestination({ destinationName: "SALES_CLOUD" });
    const response = await executeHttpRequest(destination, { method: "GET", url });

    const payload = response?.data?.d?.results || [];

    const withLocation = payload.filter(
      item =>
        Number.parseFloat(item.CLATITUDE_MEASURE) !== 0.0 &&
        Number.parseFloat(item.CLONGITUDE_MEASURE) !== 0.0
    );

    return mapResponsePayload(withLocation);

  } catch (err) {
    console.error(`[queryByField] ${field} error:`, err?.response?.data || err);
    return [];
  }
}

/* 
async function findCustomersBySalesOffice(orgUnitIds = []) {

  console.log("orgunit ids: ", orgUnitIds)

  if (!orgUnitIds.length) return [];

  const base = process.env.CUSTOMER_ODATA_PATH;
  if (!base) return [];

  const salesOffices = [];
  const salesGroups = [];
  if (typeof orgUnitIds[0] === 'object') {
    for (const item of orgUnitIds) {
      if (item.SalesOfficeIndicator) {
        salesOffices.push(item);
      }

      if (item.SalesGroupIndicator) {
        salesGroups.push(item);
      }
    }
  }

  if (typeof orgUnitIds[0] === 'string') {

  }
  const filterOrgQuery = orgUnitIds
    .map(id => `CSALES_OFFICE_UUID eq '${String(id).replace(/'/g, "''")}'`)
    .join(' or ');

  const url = `${base}?$format=json&$filter=${encodeURI(filterOrgQuery)}&$top=99999`;

  console.log(url);

  try {
    const destination = await getDestination({ destinationName: "SALES_CLOUD" });
    const response = await executeHttpRequest(
      destination,
      { method: "GET", url: url }
    );

    const payload = response?.data?.d?.results || [];
    const customersWithLocation = payload.filter(item => Number.parseFloat(item.CLATITUDE_MEASURE) != 0.0 && Number.parseFloat(item.CLONGITUDE_MEASURE) != 0.0);
    const results = mapResponsePayload(customersWithLocation);


    const byCustomer = new Map();

    for (const item of results) {
      const key = item.CustomerInternalID;
      if (!key) continue;

      if (!byCustomer.has(key)) {
        byCustomer.set(key, {
          ...item,
          salesOffices: item.SalesOfficeID ? [item.SalesOfficeID] : []
        });
      } else {
        const acc = byCustomer.get(key);

        if (item.SalesOfficeID && !acc.salesOffices.includes(item.SalesOfficeID)) {
          acc.salesOffices.push(item.SalesOfficeID);
        }
      }
    }


    // Resultado final deduplicado
    return Array.from(byCustomer.values());

  } catch (err) {
    console.error('findCustomersBySalesOffice error:', err?.response?.data || err);
    return [];
  }
} */


function mapResponsePayload(results) {
  const payload = [];

  for (const item of results) {
    const base = {
      CustomerInternalID: item.CBP_UUID,
      CustomerName: item.TBP_UUID,
      FormattedPostalAddressDescription: item.CFRMTD_PSTL_ADDR,
      zCNPJ_KUT: item.Cs1ANs020182A49D8C624,
      LatitudeMeasure: item.CLATITUDE_MEASURE,
      LongitudeMeasure: item.CLONGITUDE_MEASURE,
      SalesGroupName: item.TSALES_GROUP_UUID,
      SalesGroupID: item.CSALES_GROUP_UUID,
      SalesOfficeName: item.TSALES_OFFICE_UUID,
      SalesOfficeID: item.CSALES_OFFICE_UUID,
      Z_Classificao_KUT: item.CVARIATUSROOT47DABF57C1EE435F,

      CustomerPostalAddress: [
        {
          StreetName: item.CSTREET_NAME,
          StreetPostalCode: item.CSTREET_POSTAL,
          RegionCode: item.CREGION_CODE,
          CountryCode: item.CCOUNTRY_CODE,
          CityName: item.CCITY_NAME
        }
      ]

    };

    payload.push(base);
  }

  return payload;
}


async function createRoute(routeBody) {

  const url = `/sap/c4c/odata/v1/c4codataapi/RouteCollection`;

  const destination = await getDestination({ destinationName: "SALES_CLOUD" });
  const csrfResp = await executeHttpRequest(
    destination,
    { method: "GET", url: `${url}?$top=1`, headers: { "x-csrf-token": "fetch" } }
  );

  const csrfToken = csrfResp.headers['x-csrf-token'];
  const cookies = csrfResp.headers['set-cookie'];


  const responseCreateRoute = await executeHttpRequest(
    destination,
    {
      method: "POST",
      url: url,
      headers: {
        "x-csrf-token": csrfToken,
        "Content-Type": "application/json",
        "Cookie": cookies?.join('; ')
      },
      data: routeBody
    }
  );

  const routeCreated = responseCreateRoute?.data?.d?.results
  return routeCreated;
}

async function getRedirectUrl(routeUUID) {
  const target = `/sap/byd/nav?bo=ROUTE_TT&nav_mode=TI&param.Key=${routeUUID}`;
  const destination = await getDestination({ destinationName: "SALES_CLOUD" });
  return `${destination.url}${target}`
}

async function getRedirectSalesCloudURL() {
  const destination = await getDestination({ destinationName: "SALES_CLOUD" });
  return `${destination.url}`
}

async function getAllEmployees() {

  const url = `/sap/c4c/odata/v1/c4codataapi/EmployeeCollection?$expand=EmployeeUserBusinessRoleAssignment&$select=EmployeeID,BusinessPartnerFormattedName,EmployeeUserBusinessRoleAssignment/BusinessRoleID&$format=json&$top=9999`;
  const destination = await getDestination({ destinationName: "SALES_CLOUD" });
  const response = await executeHttpRequest(
    destination,
    { method: "GET", url: url }
  );
  const employees = response?.data?.d?.results || [];
  console.log(employees)
  return employees
}

async function getSalesGroupByOffices(salesOfficesIDs) {
  
  console.log("getSalesGroupByOffices salesOfficesIDs: ", JSON.stringify(salesOfficesIDs));

  const filterOrgQuery = salesOfficesIDs.split(",")
    .map(id => `ParentOrgUnitID eq '${String(id).replace(/'/g, "''")}'`)
    .join(' or ');

  const url = `/sap/c4c/odata/cust/v1/orgunit_parent_hierarchy/OrganisationalUnitCollection?$format=json&$filter=${encodeURI(filterOrgQuery)}&$expand=OrganisationalUnitCurrentEmployeeAssignment,AddressSnapshotDisplayName&$top=99999`;

  console.log(url)
  const destination = await getDestination({ destinationName: "SALES_CLOUD" });
  const response = await executeHttpRequest(
    destination,
    { method: "GET", url: url }
  );

  console.log(response?.data);

  const salesGroups = response?.data?.d?.results || [];
  return salesGroups
}


export {
  getEmployeeInfo,
  getCustomers,
  createRoute,
  getRedirectUrl,
  getSalesOffices,
  getRedirectSalesCloudURL,
  getAllEmployees,
  getRolesByEmployee,
  getSalesGroupByOffices
}