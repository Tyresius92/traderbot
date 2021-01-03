import alpaca from './alpaca';
import logger from './logger';
import { getDesiredPortfolioState } from './longShort';
import { SideType, PositionType, MINUTE, INTERVAL } from './constants';

export const cancelExistingOrders = async () => {
  let orders = [];
  try {
    orders = await alpaca.getOrders({
      status: 'open',
      direction: 'desc',
    });
  } catch (err) {
    logger.error(JSON.stringify(err.error));
  }

  return Promise.all(orders.map(order => alpaca.cancelOrder(order.id)));
};

// Spin until the market is open
export const awaitMarketOpen = () =>
  new Promise(resolve => {
    const check = async () => {
      try {
        const clock = await getMarketHours();
        if (clock.isOpen) {
          resolve();
        } else {
          const openTime = new Date(clock.nextOpen);
          const currTime = new Date(clock.timestamp);

          const timeToOpen = Math.floor((openTime - currTime) / 1000 / 60);
          logger.info(`${timeToOpen} minutes til next market open.`);
          setTimeout(check, MINUTE);
        }
      } catch (err) {
        logger.error(err.error);
      }
    };
    check();
  });

const getMarketHours = async () =>
  await alpaca
    .getClock()
    .then(
      ({
        is_open: isOpen,
        next_open: nextOpen,
        next_close: nextClose,
        timestamp,
      }) => ({
        isOpen,
        // Raw format is '2020-12-28T20:07:06.359787957-05:00'.
        // substring removes the `-05:00`
        nextOpen: nextOpen.substring(0, nextOpen.length - 6),
        nextClose: nextClose.substring(0, nextClose.length - 6),
        timestamp: timestamp.substring(0, timestamp.length - 6),
      })
    );

export const isMarketClosingSoon = async () => {
  const clock = await getMarketHours();
  const nextClose = new Date(clock.nextClose);
  const currTime = new Date(clock.timestamp);
  const timeToClose = Math.abs(nextClose - currTime);

  return timeToClose < MINUTE * INTERVAL;
};

export const closeAllPositionsBeforeMarketCloses = async () => {
  // Close all positions when 15 minutes til market close.
  logger.info('Market closing soon. Closing positions.');

  try {
    const positions = await alpaca.getPositions();

    await Promise.all(
      positions.map(position =>
        submitOrder({
          quantity: Math.abs(position.qty),
          symbol: position.symbol,
          side:
            position.side === PositionType.LONG ? SideType.SELL : SideType.BUY,
        })
      )
    );
  } catch (err) {
    logger.error(err.error);
  }
};

// Submit an order if quantity is above 0.
const submitOrder = async ({ quantity, symbol, side }) => {
  if (quantity <= 0) {
    logger.info(
      `Quantity is <= 0, order of | ${quantity}\t${symbol}\t${side} | not sent.`
    );
    return true;
  }

  try {
    await alpaca.createOrder({
      symbol,
      qty: quantity,
      side,
      type: 'market',
      // must be camelcase to match the alpaca API
      // eslint-disable-next-line camelcase
      time_in_force: 'day',
    });
    logger.info(
      `Market order of | ${quantity}\t${symbol}\t${side}\t| completed.`
    );
    return true;
  } catch (err) {
    logger.error(`Encountered an error placing trade: ${err.message}`);
    logger.info(
      `Market order of | ${quantity}\t${symbol}\t${side}\t| did not go through.`
    );
    return false;
  }
};

const adjustPosition = async (
  symbol,
  currentNumberOfShares,
  desiredNumberOfShares
) => {
  if (currentNumberOfShares !== desiredNumberOfShares) {
    const diff = Number(currentNumberOfShares) - Number(desiredNumberOfShares);
    try {
      await submitOrder({
        quantity: Math.abs(diff),
        symbol,
        // Less than 0: Too many short positions or too few long.
        // Buy some to rebalance.
        // Greater than 0: Too little short positions or too many long.
        // Sell some to rebalance.
        side: diff > 0 ? SideType.BUY : SideType.SELL,
      });
    } catch (err) {
      logger.error(err.error);
    }
  }
};

// Submit a batch order that returns completed and uncompleted orders.
const sendBatchOrder = async orders =>
  await Promise.all(orders.map(order => submitOrder(order)));

// Rebalance our position after an update.
export const rebalance = async () => {
  // Clear existing orders again.
  await cancelExistingOrders();

  const desiredPortfolioState = await getDesiredPortfolioState();

  const desiredStocks = desiredPortfolioState.map(decision => decision.symbol);
  const stocksToLong = desiredPortfolioState
    .filter(decision => decision.side === PositionType.LONG)
    .map(decision => decision.symbol);

  const stocksToShort = desiredPortfolioState
    .filter(decision => decision.side === PositionType.SHORT)
    .map(decision => decision.symbol);

  logger.info(`We are taking a long position in: ${stocksToLong.toString()}`);
  logger.info(`We are taking a short position in: ${stocksToShort.toString()}`);

  // Remove positions that are no longer in the short or long list,
  // and make a list of positions that do not need to change.
  // Adjust position quantities if needed.
  let positions = [];
  try {
    positions = await alpaca.getPositions();
  } catch (err) {
    logger.info(err.error);
  }

  const blacklist = new Set();

  await Promise.all(
    positions.map(({ qty, symbol, side }) => {
      const quantity = Math.abs(qty);

      // TODO: Technically, each stock is either NOT in desired stocks,
      // or IS in stocks to short or stocks to long, but these 5 if statements
      // make it appear otherwise at first glance.
      // In general, refactor this trash

      if (!desiredStocks.includes(symbol)) {
        // We want to neither short nor long this stock.
        // Clear position.
        try {
          return submitOrder({
            quantity,
            symbol,
            side: side === PositionType.LONG ? SideType.SELL : SideType.BUY,
          });
        } catch (err) {
          logger.info(err.error);
        }
      }

      if (stocksToLong.includes(symbol) && side === PositionType.LONG) {
        // Currently long, but probably want a different number of shares.
        // Adjust accordingly
        blacklist.add(symbol);
        return adjustPosition(
          symbol,
          quantity,
          desiredPortfolioState.find(decision => decision.symbol === symbol)
            .quantity
        );
      }

      if (stocksToShort.includes(symbol) && side === PositionType.SHORT) {
        // Currently short, but probably want a different number of shares.
        // Adjust accordingly
        blacklist.add(symbol);
        return adjustPosition(
          symbol,
          quantity,
          desiredPortfolioState.find(decision => decision.symbol === symbol)
            .quantity
        );
      }

      if (stocksToShort.includes(symbol) && side === PositionType.LONG) {
        // Currently long, but want to be short. Clear long position
        // shorting is handled elsewhere
        try {
          return submitOrder({
            quantity,
            symbol,
            side: SideType.SELL,
          });
        } catch (err) {
          logger.info(err.error);
        }
      }

      if (stocksToLong.includes(symbol) && side === PositionType.SHORT) {
        // Currently short, but want to be long. Clear short position
        // longing handled below
        try {
          return submitOrder({
            quantity,
            symbol,
            side: SideType.BUY,
          });
        } catch (err) {
          logger.info(err.error);
        }
      }

      // TODO: We should never hit this case.
      // refactor to make us not need this line
      return null;
    })
  );

  try {
    // Send orders to all remaining stocks in the long and short list
    await sendBatchOrder(
      desiredPortfolioState.filter(decision => !blacklist.has(decision.symbol))
    );
  } catch (err) {
    logger.error(err.error);
  }
};
