const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const usd_cop = parseFloat(process.env.TASA_USD_COP || '3700');
  const usd_bs  = parseFloat(process.env.TASA_USD_BS  || '655.38');
  res.json({
    ok: true,
    tasas: {
      cop_bs: usd_cop / usd_bs,
      usd_bs: usd_bs,
    }
  });
});

module.exports = router;