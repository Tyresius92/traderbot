import alpaca from './alpaca';
import { stocks } from './stocks';
import logger from './logger';
import { PositionType } from './constants';

// Re-rank all stocks to adjust longs and shorts.
export const getDesiredPortfolioState = async () => {
  try {
    const rankedStocks = await getRankedStocks();

    const bucketPct = 0.25;
    const bucketSize = Math.floor(rankedStocks.length * bucketPct);
    // Grabs the top and bottom bucket (according to percentage)
    // of the sorted stock list to get the long and short lists.
    const stocksToShort = rankedStocks.slice(0, bucketSize);
    const stocksToLong = rankedStocks.slice(rankedStocks.length - bucketSize);

    // Determine amount to long/short based on total stock price of each bucket.
    // Employs 130-30 Strategy
    const accountInfo = await alpaca.getAccount();
    const equity = accountInfo.equity;
    const shortAmount = 0.3 * equity;
    const targetLongAmount = Number(shortAmount) + Number(equity);

    // use the same number of shares for each stock
    const totalLongPrice = await getTotalPriceForOneShareOfEachStock(
      stocksToLong
    );
    const quantityLong = Math.floor(targetLongAmount / totalLongPrice);

    const totalShortPrice = await getTotalPriceForOneShareOfEachStock(
      stocksToShort
    );
    const quantityShort = Math.floor(shortAmount / totalShortPrice);

    const shortedStocks = stocksToShort.map(symbol => ({
      symbol,
      side: PositionType.SHORT,
      quantity: quantityShort,
    }));

    const longedStocks = stocksToLong.map(symbol => ({
      symbol,
      side: PositionType.LONG,
      quantity: quantityLong,
    }));

    return [...shortedStocks, ...longedStocks];
  } catch (err) {
    logger.error(err.error);
    return [];
  }
};

// Mechanism used to rank the stocks,
// the basis of the Long-Short Equity Strategy.
const getRankedStocks = async () => {
  // Ranks all stocks by percent change over the past 10 minutes
  // (higher is better)
  const percentChanges = await getPercentChanges();
  return [...percentChanges]
    .sort((a, b) => a.percentChange - b.percentChange)
    .map(({ name }) => name);
};

// Get percent changes of the stock prices over the past 10 minutes.
const getPercentChanges = () =>
  Promise.all(
    stocks.map(stock => {
      const TEN_MINUTES = 10;

      return alpaca
        .getBars('minute', stock, {
          limit: TEN_MINUTES,
        })
        .then(resp => {
          const numberOfDataPoints = resp[stock].length;
          const lastClose = resp[stock][numberOfDataPoints - 1].closePrice;
          const firstOpen = resp[stock][0].openPrice;
          const percentChange = (lastClose - firstOpen) / firstOpen;

          return { name: stock, percentChange };
        });
    })
  );

// Get the total price of the array of input stocks.
const getTotalPriceForOneShareOfEachStock = async (stocks = []) =>
  Promise.all(
    stocks.map(stock =>
      alpaca
        .getBars('minute', stock, {
          limit: 1,
        })
        .then(response => response[stock][0].closePrice)
    )
  ).then(responses => responses.reduce((acc, curr) => acc + curr, 0));
