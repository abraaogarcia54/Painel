require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const data = require('./data.js');
const cron = require('node-cron');
const authRoutes = require('./routes/auth.js');
const moduleRoutes = require('./routes/modules.js');
const userRoutes = require('./routes/users.js');
const historyRoutes = require('./routes/history.js');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'painel')));

app.use('/auth', authRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/history', historyRoutes);

// ---- Daily snapshot cron ----

if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 0 * * *', () => {
    try {
      data.appendSnapshot(data.getModules());
    } catch (err) {
      console.error('[cron] appendSnapshot failed:', err);
    }
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
