import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('zas_local.db');

export async function initDatabase() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cache_tarifas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      municipio_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_usuario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cache_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cola_operaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      payload TEXT NOT NULL,
      creado_at INTEGER NOT NULL,
      intentos INTEGER DEFAULT 0
    );
  `);
}

// --- TARIFAS ---
export async function guardarTarifas(municipioId: string, data: any) {
  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO cache_tarifas (municipio_id, data, updated_at)
     VALUES (?, ?, ?)`,
    [municipioId, JSON.stringify(data), now]
  );
}

export async function obtenerTarifas(municipioId: string) {
  const row = await db.getFirstAsync<{ data: string; updated_at: number }>(
    `SELECT data, updated_at FROM cache_tarifas WHERE municipio_id = ? LIMIT 1`,
    [municipioId]
  );
  if (!row) return null;
  const edad = Date.now() - row.updated_at;
  if (edad > 1000 * 60 * 60 * 24) return null; // caché de 24h
  return JSON.parse(row.data);
}

// --- USUARIO ---
export async function guardarUsuario(userId: string, data: any) {
  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO cache_usuario (user_id, data, updated_at)
     VALUES (?, ?, ?)`,
    [userId, JSON.stringify(data), now]
  );
}

export async function obtenerUsuario(userId: string) {
  const row = await db.getFirstAsync<{ data: string }>(
    `SELECT data FROM cache_usuario WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return row ? JSON.parse(row.data) : null;
}

// --- HISTORIAL ---
export async function guardarHistorial(userId: string, data: any) {
  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO cache_historial (user_id, data, updated_at)
     VALUES (?, ?, ?)`,
    [userId, JSON.stringify(data), now]
  );
}

export async function obtenerHistorial(userId: string) {
  const row = await db.getFirstAsync<{ data: string }>(
    `SELECT data FROM cache_historial WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return row ? JSON.parse(row.data) : null;
}

// --- COLA DE OPERACIONES ---
export async function agregarACola(tipo: string, payload: any) {
  await db.runAsync(
    `INSERT INTO cola_operaciones (tipo, payload, creado_at)
     VALUES (?, ?, ?)`,
    [tipo, JSON.stringify(payload), Date.now()]
  );
}

export async function obtenerCola() {
  return await db.getAllAsync<{ id: number; tipo: string; payload: string }>(
    `SELECT id, tipo, payload FROM cola_operaciones ORDER BY creado_at ASC`
  );
}

export async function eliminarDeCola(id: number) {
  await db.runAsync(`DELETE FROM cola_operaciones WHERE id = ?`, [id]);
}