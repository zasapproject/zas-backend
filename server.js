const express = require('express');
const cors = require('cors');
require('dotenv').config();


// Importar rutas
const usuariosRoutes = require('./routes/usuarios');
const conductoresRoutes = require('./routes/conductores');
const viajesRoutes = require('./routes/viajes');
const pagosRoutes = require('./routes/pagos');
const suscripcionesRouter = require('./routes/suscripciones');
// Iniciar servidor
const app = express();
app.use(cors());
app.use(express.json());




// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    mensaje: '⚡ Servidor ZAS funcionando correctamente',
    version: '1.0.0'
  });
});

// Rutas de ZAS
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/conductores', conductoresRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/suscripciones', suscripcionesRouter);
// Iniciar en el puerto 3000
const PORT = process.env.PORT || process.env.RAILWAY_TCP_PROXY_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Servidor ZAS corriendo en puerto ${PORT}`);
});
