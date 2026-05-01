const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    tasas: {
      usd_cop: parseFloat(process.env.TASA_USD_COP || '4000'),
      usd_bs: parseFloat(process.env.TASA_USD_BS || '487.12'),
    }
  });
});

module.exports = router;