const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const turmaRoutes = require('./routes/turmaRoutes');
const agendamentoRoutes = require('./routes/agendamentoRoutes');
const professorRoutes = require('./routes/professorRoutes');
const salaRoutes = require('./routes/salaRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const cursoRoutes = require('./routes/cursoRoutes');
const eventRoutes = require('./routes/eventRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const swapRoutes = require('./routes/swapRoutes');

// FASE 3 ENTERPRISE ROUTES
const inventoryRoutes = require('./routes/inventoryRoutes');
const patrimonyRoutes = require('./routes/patrimonyRoutes');
const uniformRoutes = require('./routes/uniformRoutes');
const epiRoutes = require('./routes/epiRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const unitRoutes = require('./routes/unitRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota de Healthcheck pública
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API SQL Macro-Micro Schedule PDR Enterprise (Fases 1, 2, 2.5 e 3) ativa',
    timestamp: new Date().toISOString()
  });
});

// Registra os módulos de rotas das Fases 1, 2, 2.5 e 3
app.use('/api/auth', authRoutes);
app.use('/api/turmas', turmaRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/professores', professorRoutes);
app.use('/api/salas', salaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/calendar/holidays', holidayRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/swaps', swapRoutes);

// FASE 3 API ENDPOINTS
app.use('/api/inventory', inventoryRoutes);
app.use('/api/patrimonies', patrimonyRoutes);
app.use('/api/uniforms', uniformRoutes);
app.use('/api/epis', epiRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/units', unitRoutes);

app.listen(port, () => {
  console.log(`🚀 Servidor SQL Macro-Micro PDR Enterprise (Fase 3 BI & Governança) rodando na porta ${port}`);
});
