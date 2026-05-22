const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    tasas: {
      cop_bs: parseFloat(process.env.TASA_COP_BS || '5.5'),
      usd_bs: parseFloat(process.env.TASA_USD_BS || '36'),
    }
  });
});

module.exports = router;