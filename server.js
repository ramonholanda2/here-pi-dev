const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
const cors = require('cors');
const { getCustomers, getEmployeeInfo, createRoute, getRedirectUrl, getSalesOffices, getRedirectSalesCloudURL, getAllEmployees, getRolesByEmployee, getSalesGroupByOffices } = require('./services/services');

const hasVcap = !!process.env.VCAP_SERVICES;
console.log("Is Env CF: ", hasVcap)

if (!hasVcap) {
  console.log("Carregando variáveis de ambiente .env/xsenv");
  require('@sap/xsenv').loadEnv();
  require('dotenv').config();
}

app.use(cors());
app.use(express.json());

app.use("/public", cors(), express.static(path.join(__dirname, 'public')));

app.get('/', cors(), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/here/config', (req, res) => {
  res.json({
    apiKey: process.env.HERE_API_KEY
  });
});

app.post('/api/rotas', async (req, res, next) => {
  try {
    const routeCreated = await createRoute(req.body);
    return res.status(201).json(routeCreated);

  } catch (err) {
    next(err);
  }
});
app.get('/api/salescloud/url', async (req, res, next) => {
  try {
    const redirectUrl = await getRedirectSalesCloudURL();
    return res.send(encodeURIComponent(redirectUrl));
  } catch (error) {
    next(error);
  }
});
app.get('/api/rotas/redirecionar/:routeUUID', async (req, res, next) => {
  try {
    const routeUUID = req.params.routeUUID;
    const redirectUrl = await getRedirectUrl(routeUUID);
    return res.send(encodeURIComponent(redirectUrl));
  } catch (error) {
    next(error);
  }
});

app.get('/api/empregados', async (req, res, next) => {
  try {
    const employees = await getAllEmployees();
    return res.json(employees);
  } catch (error) {
    next(error);
  }
})

app.get('/api/representantes', async (req, res, next) => {
  console.log("Recebendo requisição para representantes com query", req.query);
  try {
    const salesGroups = await getSalesGroupByOffices(req.query.salesOfficesIDs);
    return res.json(salesGroups);
  } catch (error) {
    next(error);
  }
})

app.get("/api/funcoes/:employeeID", async (req, res, next) => {
  try {
    const employeeID = req.params.employeeID;
    const roles = await getRolesByEmployee(employeeID);
    return res.json(roles);
  } catch (error) {
    next(error);
  }
})

app.get('/api/clientes', async (req, res, next) => {
  try {

    console.log("query", req.query);
    if (!req.query.employeeID && !req.query.salesOfficesIDs) return res.json([]);

    var customers = await getCustomers(req.query);
    console.log("query", req.query);
    return res.json(customers);

  } catch (error) {
    next(error);
  }
});

app.get('/api/escritorios', async (req, res, next) => {
  try {

    var salesOffices = await getSalesOffices(req.query);

    return res.json(salesOffices);

  } catch (error) {
    next(error);
  }
});



app.get('/api/empregado', async (req, res, next) => {
  try {

    const employeeData = await getEmployeeInfo(req.query.employeeID);

    return res.status(200).json(employeeData);

  } catch (error) {
    next(error);
  }
});



// =============================
// MIDDLEWARE GLOBAL DE ERROS
// =============================
app.use((err, req, res, next) => {
  console.error("ERRO CAPTURADO:", err?.response?.data || err);

  if (err.response) {
    return res.status(err.response.status || 500).json({
      error: true,
      origin: "SAP",
      details: err.response.data
    });
  }

  return res.status(500).json({
    error: true,
    message: "Erro interno no servidor",
    details: err.message
  });
});


app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});