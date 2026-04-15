const express = require('express');
const cors = require('cors');
require('dotenv').config();

const supabase = require('./supabase');


// Importar rutas
const usuariosRoutes = require('./routes/usuarios');
const conductoresRoutes = require('./routes/conductores');
const viajesRoutes = require('./routes/viajes');
const pagosRoutes = require('./routes/pagos');
const suscripcionesRouter = require('./routes/suscripciones');
// Iniciar servidor
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.get('/solicitar', (req, res) => {
  res.sendFile(__dirname + '/public/solicitar.html');
});
app.get('/privacidad', (req, res) => {
  res.sendFile(__dirname + '/public/privacidad.html');
});





// Ruta de prueba
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/solicitar.html');
});
app.get('/api/test-email', async (req, res) => {
  const { emailConductorAprobado } = require('./mailer');
  try {
    await emailConductorAprobado('Conductor Prueba', process.env.GMAIL_USER);
    res.json({ ok: true, mensaje: 'Email enviado' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('usuarios').select('id').limit(1);
    const dbStatus = error ? 'error' : 'connected';
    res.json({
      status: 'ok',
      version: '1.0.0',
      db: dbStatus,
      uptime: Math.floor(process.uptime()) + 's',
      memoria: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Rutas de ZAS
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/conductores', conductoresRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/suscripciones', suscripcionesRouter);
const storageRouter = require('./routes/storage');
app.use('/api/storage', storageRouter);
const documentosRouter = require('./routes/documentos');
app.use('/api/documentos', documentosRouter);
const soporteRouter = require('./routes/soporte'); // v2
app.use('/api/soporte', soporteRouter);
const tarifasRouter = require('./routes/tarifas');
app.use('/api/tarifas', tarifasRouter);
const authAdmin = require('./middleware/authAdmin');
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);
// Iniciar en el puerto 3000
const PORT = process.env.PORT || process.env.RAILWAY_TCP_PROXY_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Servidor ZAS corriendo en puerto ${PORT}`);
});
