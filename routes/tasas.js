const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const usd_cop = parseFloat(process.env.TASA_USD_COP || '3600');
  const cop_bs  = parseFloat(process.env.TASA_COP_BS  || '4.3');
  res.json({
    ok: true,
    tasas: {
      usd_cop,   // COP por cada USD → precio ÷ usd_cop = USD
      cop_bs,    // COP por cada Bs  → precio ÷ cop_bs  = Bs
    }
  });
});

module.exports = router;