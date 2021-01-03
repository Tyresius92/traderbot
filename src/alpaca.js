import Alpaca from '@alpacahq/alpaca-trade-api';

const API_KEY = process.env.ALPACA_API_KEY;
const API_SECRET = process.env.ALPACA_API_SECRET;

const alpaca = new Alpaca({
  keyId: API_KEY,
  secretKey: API_SECRET,
  paper: true,
  usePolygon: false,
});

export default alpaca;
