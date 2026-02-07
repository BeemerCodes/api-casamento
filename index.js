require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { confirmPresence } = require("./controllers/reservationRegister");
const { runEmailJob } = require("./controllers/adminController");

const app = express();

app.use(cors());
app.use(express.json());

// Rota de Teste
app.get("/", (req, res) => res.send("API Casamento Nova - Online 🚀"));

// Rota de Confirmação (Site usa essa)
app.post("/confirmPresence", confirmPresence);

// Rota do Cron Job (Automática)
app.post("/runEmailJob", runEmailJob);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
