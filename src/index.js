import logger from './logger';
import {
  cancelExistingOrders,
  awaitMarketOpen,
  isMarketClosingSoon,
  closeAllPositionsBeforeMarketCloses,
  rebalance,
} from './bot.js';
import { MINUTE, INTERVAL } from './constants';

const run = async () => {
  // First, cancel any existing orders so they don't impact our buying power.
  await cancelExistingOrders();

  // Wait for market to open.
  logger.info('Waiting for market to open...');
  await awaitMarketOpen();
  logger.info('Market opened.');

  // Rebalance the portfolio every minute, making necessary trades.
  const spin = setInterval(async () => {
    // Figure out when the market will close so we can sell beforehand.
    try {
      // save in a local var because otherwise it wasn't stopping execution
      const isMarketAboutToClose = await isMarketClosingSoon();
      if (isMarketAboutToClose) {
        await closeAllPositionsBeforeMarketCloses();

        clearInterval(spin);
        logger.info(`Sleeping until market close (${INTERVAL} minutes).`);

        setTimeout(() => {
          // Run script again after market close for next trading day.
          run();
        }, MINUTE * INTERVAL);
      } else {
        // Rebalance the portfolio.
        await rebalance();
      }
    } catch (err) {
      logger.info(err.error);
    }
  }, MINUTE);
};

run();
