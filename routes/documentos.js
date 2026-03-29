const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ─────────────────────────────────────────────
// PROMPT para Claude — documentos venezolanos
// ─────────────────────────────────────────────
const buildPrompt = (tipoDocumento) => `
Eres un sistema experto en verificación de documentos venezolanos para una app de mototaxi llamada ZAS.

Analiza la imagen del documento y responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.

Tipo de documento esperado: ${tipoDocumento}

Documentos que reconoces:
- CEDULA: Cédula de Identidad venezolana (formato V-12.345.678 o E-81.234.567)
- LICENCIA: Licencia de Conducir venezolana (categorías: A, B, C, D, E)
- CIRCULACION: Certificado de Circulación / Título de Propiedad del vehículo
- SEGURO: Seguro de Responsabilidad Civil Obligatorio del vehículo
- REVISION: Revisión Técnica del vehículo (certificado técnico)

Responde con este JSON exacto:
{
  "esDocumentoValido": true | false,
  "tipoDetectado": "CEDULA" | "LICENCIA" | "CIRCULACION" | "SEGURO" | "REVISION" | "DESCONOCIDO",
  "coincideTipoEsperado": true | false,
  "legible": true | false,
  "datos": {
    "nombreCompleto": "string o null",
    "numeroDocumento": "string o null",
    "prefijo": "V" | "E" | null,
    "fechaEmision": "YYYY-MM-DD o null",
    "fechaVencimiento": "YYYY-MM-DD o null",
    "categoria": "string o null",
    "placa": "string o null",
    "marca": "string o null",
    "modelo": "string o null"
  },
  "vigente": true | false | null,
  "motivoRechazo": "string o null",
  "confianza": "ALTA" | "MEDIA" | "BAJA"
}

Reglas:
- Si la imagen es ilegible, borrosa o no es un documento, esDocumentoValido = false
- vigente = null si no hay fecha de vencimiento en el documento
- motivoRechazo = null si el documento es válido
- Razones comunes de rechazo: ilegible, vencido, tipo incorrecto, imagen cortada, foto de pantalla de baja calidad
- Para cédulas venezolanas verifica el prefijo V- (venezolano) o E- (extranjero)
- confianza ALTA = texto perfectamente legible, MEDIA = legible con pequeñas dudas, BAJA = parcialmente legible
`;

// ─────────────────────────────────────────────
// Calcular si un documento está vigente
// ─────────────────────────────────────────────
const calcularVigencia = (fechaVencimiento) => {
  if (!fechaVencimiento) return null;
  try {
    const vence = new Date(fechaVencimiento);
    const hoy = new Date();
    return vence >= hoy;
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────
// POST /api/documentos/verificar
// Body: { imagen: "base64...", tipoDocumento: "CEDULA", usuarioId: "uuid", conductorId: "uuid" }
// ─────────────────────────────────────────────
router.post('/verificar', async (req, res) => {
  const { imagen, tipoDocumento, usuarioId, conductorId } = req.body;

  // Validaciones básicas
  if (!imagen) {
    return res.status(400).json({ error: 'Se requiere la imagen en base64', code: 'IMAGEN_REQUERIDA' });
  }
  if (!tipoDocumento) {
    return res.status(400).json({ error: 'Se requiere el tipo de documento', code: 'TIPO_REQUERIDO' });
  }
  if (!usuarioId && !conductorId) {
    return res.status(400).json({ error: 'Se requiere usuarioId o conductorId', code: 'PROPIETARIO_REQUERIDO' });
  }

  const tiposValidos = ['CEDULA', 'LICENCIA', 'CIRCULACION', 'SEGURO', 'REVISION'];
  if (!tiposValidos.includes(tipoDocumento.toUpperCase())) {
    return res.status(400).json({ error: `Tipo de documento inválido. Válidos: ${tiposValidos.join(', ')}`, code: 'TIPO_INVALIDO' });
  }

  // Limpiar el base64 por si viene con el prefijo data:image/...
  const base64Limpio = imagen.replace(/^data:image\/[a-z]+;base64,/, '');

  // Detectar el tipo de imagen (jpeg por defecto)
  let mediaType = 'image/jpeg';
  if (imagen.startsWith('data:image/png')) mediaType = 'image/png';
  else if (imagen.startsWith('data:image/webp')) mediaType = 'image/webp';

  try {
    // ── Llamada a Claude Vision ──
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Limpio,
              },
            },
            {
              type: 'text',
              text: buildPrompt(tipoDocumento.toUpperCase()),
            },
          ],
        },
      ],
    });

    // Parsear la respuesta de Claude
    const textoRespuesta = response.content[0].text.trim();
    let resultado;
    try {
      // Limpiar por si Claude agrega markdown ocasionalmente
      const jsonLimpio = textoRespuesta.replace(/```json|```/g, '').trim();
      resultado = JSON.parse(jsonLimpio);
    } catch {
      console.error('Error parseando respuesta de Claude:', textoRespuesta);
      return res.status(502).json({ error: 'Error al procesar respuesta del verificador', code: 'PARSE_ERROR' });
    }

    // Recalcular vigencia con lógica del servidor (no confiar solo en Claude)
    if (resultado.datos?.fechaVencimiento) {
      resultado.vigente = calcularVigencia(resultado.datos.fechaVencimiento);
    }

    // ── Guardar resultado en Supabase ──
    const registroDb = {
      tipo_documento: tipoDocumento.toUpperCase(),
      usuario_id: usuarioId || null,
      conductor_id: conductorId || null,
      es_valido: resultado.esDocumentoValido,
      tipo_detectado: resultado.tipoDetectado,
      legible: resultado.legible,
      vigente: resultado.vigente,
      confianza: resultado.confianza,
      nombre_completo: resultado.datos?.nombreCompleto || null,
      numero_documento: resultado.datos?.numeroDocumento || null,
      prefijo: resultado.datos?.prefijo || null,
      fecha_emision: resultado.datos?.fechaEmision || null,
      fecha_vencimiento: resultado.datos?.fechaVencimiento || null,
      categoria_licencia: resultado.datos?.categoria || null,
      placa: resultado.datos?.placa || null,
      motivo_rechazo: resultado.motivoRechazo || null,
      verificado_en: new Date().toISOString(),
    };

    const { data: dbData, error: dbError } = await supabase
      .from('verificaciones_documentos')
      .insert(registroDb)
      .select('id')
      .single();

    if (dbError) {
      // Log del error pero no falla la respuesta al cliente
      console.error('Error guardando verificación en DB:', dbError.message);
    }

    // ── Respuesta al cliente ──
    return res.json({
      ok: true,
      verificacionId: dbData?.id || null,
      resultado: {
        aprobado: resultado.esDocumentoValido && resultado.vigente !== false && resultado.legible,
        tipoDetectado: resultado.tipoDetectado,
        coincideTipoEsperado: resultado.coincideTipoEsperado,
        legible: resultado.legible,
        vigente: resultado.vigente,
        confianza: resultado.confianza,
        datos: resultado.datos,
        motivoRechazo: resultado.motivoRechazo,
      },
    });

  } catch (error) {
    console.error('Error en verificación de documento:', error.message);

    if (error.status === 401) {
      return res.status(500).json({ error: 'Error de configuración del verificador', code: 'AUTH_ERROR' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Demasiadas verificaciones simultáneas, intenta en unos segundos', code: 'RATE_LIMIT' });
    }

    return res.status(500).json({ error: 'Error interno al verificar documento', code: 'SERVER_ERROR' });
  }
});

// ─────────────────────────────────────────────
// GET /api/documentos/historial/:conductorId
// Devuelve las últimas verificaciones de un conductor
// ─────────────────────────────────────────────
router.get('/historial/:conductorId', async (req, res) => {
  const { conductorId } = req.params;

  const { data, error } = await supabase
    .from('verificaciones_documentos')
    .select('id, tipo_documento, es_valido, vigente, confianza, motivo_rechazo, verificado_en, nombre_completo, numero_documento, fecha_vencimiento')
    .eq('conductor_id', conductorId)
    .order('verificado_en', { ascending: false })
    .limit(20);

  if (error) {
    return res.status(500).json({ error: 'Error al obtener historial', code: 'DB_ERROR' });
  }

  return res.json({ ok: true, historial: data });
});

// ─────────────────────────────────────────────
// GET /api/documentos/estado/:conductorId
// Resumen: qué documentos tiene aprobados y cuáles faltan
// ─────────────────────────────────────────────
router.get('/estado/:conductorId', async (req, res) => {
  const { conductorId } = req.params;

  const documentosRequeridos = ['CEDULA', 'LICENCIA', 'CIRCULACION', 'SEGURO', 'REVISION'];

  const { data, error } = await supabase
    .from('verificaciones_documentos')
    .select('tipo_documento, es_valido, vigente, verificado_en')
    .eq('conductor_id', conductorId)
    .eq('es_valido', true)
    .order('verificado_en', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Error al obtener estado', code: 'DB_ERROR' });
  }

  // Tomar el más reciente aprobado por tipo
  const aprobados = {};
  for (const doc of data) {
    if (!aprobados[doc.tipo_documento]) {
      aprobados[doc.tipo_documento] = doc;
    }
  }

  const estado = documentosRequeridos.map(tipo => ({
    tipo,
    aprobado: !!aprobados[tipo],
    vigente: aprobados[tipo]?.vigente ?? null,
    verificadoEn: aprobados[tipo]?.verificado_en ?? null,
  }));

  const habilitado = estado.every(d => d.aprobado && d.vigente !== false);

  return res.json({
    ok: true,
    conductorId,
    habilitado,
    documentos: estado,
  });
});

module.exports = router;