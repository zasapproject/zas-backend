require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const supabase = require('./supabase');

// Importar rutas
const usuariosRoutes = require('./routes/usuarios');
const conductoresRoutes = require('./routes/conductores');
const viajesRoutes = require('./routes/viajes');
const pagosRoutes = require('./routes/pagos');
const suscripcionesRouter = require('./routes/suscripciones');
const saldoRouter = require('./routes/saldo');
const datosBancariosRouter = require('./routes/datos-bancarios');
const storageRouter = require('./routes/storage');
const documentosRouter = require('./routes/documentos');
const soporteRouter = require('./routes/soporte');
const tarifasRouter = require('./routes/tarifas');
const tasasRouter = require('./routes/tasas');
const authAdmin = require('./middleware/authAdmin');
const adminRouter = require('./routes/admin');

// Iniciar app
const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin: ['https://zasapps.com', 'https://admin.zasapps.com'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'x-admin-key'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Archivos estáticos (solicitar.html, privacidad.html, card/index.html, etc.)
app.use(express.static('public'));

// Rutas estáticas explícitas
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/solicitar.html');
});
app.get('/solicitar', (req, res) => {
  res.sendFile(__dirname + '/public/solicitar.html');
});
app.get('/privacidad', (req, res) => {
  res.sendFile(__dirname + '/public/privacidad.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/solicitar.html');
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('usuarios').select('id').limit(1);
    const dbStatus = error ? 'error' : 'connected';
    res.json({ status: 'ok', db: dbStatus });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Rutas API
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/conductores', conductoresRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/suscripciones', suscripcionesRouter);
app.use('/api/saldo', saldoRouter);
app.use('/api/datos-bancarios', datosBancariosRouter);
app.use('/api/storage', storageRouter);
app.use('/api/documentos', documentosRouter);
app.use('/api/soporte', soporteRouter);
app.use('/api/tarifas', tarifasRouter);
app.use('/api/tasas', tasasRouter);
app.use('/api/admin', adminRouter);
const verificacionRouter = require('./routes/verificacion');
app.use('/api/verificacion', verificacionRouter);

// ─────────────────────────────────────────────
// CRON — Reset semanal lunes 00:00 (America/Bogota)
// saldo_retenido y total_ganado vuelven a cero
// saldo_disponible NO se toca
// ─────────────────────────────────────────────
cron.schedule('0 0 * * 1', async () => {
  console.log('🔄 Cron: reset semanal de contadores conductores...');
  try {
    const { error } = await supabase
      .from('saldo_conductores')
      .update({
        saldo_retenido: 0,
        total_ganado: 0,
        ultima_actualizacion: new Date().toISOString(),
      })
      .neq('conductor_id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('❌ Error reset semanal:', error.message);
    } else {
      console.log('✅ Reset semanal completado — lunes 00:00');
    }
  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
}, {
  timezone: 'America/Bogota'
});

// Iniciar servidor
const PORT = process.env.PORT || process.env.RAILWAY_TCP_PROXY_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Servidor ZAS corriendo en puerto ${PORT}`);
});