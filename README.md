# TraderBot

TraderBot is an algorithmic stock trading bot. It was written as an exercise to see how a trading bot worked, and explore possibilities for one day starting some kind of investing financial service (a la Betterment or Wealthfront).

## What I learned

I'd be interested in working in FinTech, but I would definitely not want to be doing any kind of short term algorithmic trading. I've definitely confirmed for myself that I am a long term buy and hold investor. 

Betterment, Wealthfront, Blooom, hit me up. Hedge fund folks, I'll pass. 

## Provisos, Warnings, Gotchas, etc.

Please don't use this bot. Seriously. This is a _TERRIBLE_ way to invest your money unless you're doing the arbitrage thing where your computer is right next to the actual stock exchange's computer. For the average person, you are about 100 times better off dropping your money into low cost index funds over the course of 20 years. 

![Dilbert Comic about beating the market](https://ritholtz.com/wp-content/uploads/2015/02/dilbert.gif)

Here's an article explaining why: [https://www.thesimpledollar.com/investing/stocks/even-the-experts-cant-beat-the-market-why-would-you/](https://www.thesimpledollar.com/investing/stocks/even-the-experts-cant-beat-the-market-why-would-you/)

You can find a whole bunch more out on the internet.

Additionally, this particular algorithm, when run on live market data for a few days, _NEVER_ had a day that it made money, and in one day LOST 15%. 

If you really are dead set on the idea that you can beat the market, write and import a new function called `getDesiredPortfolioState` and use it in `bot.js`. This is _*NOT RECOMMENDED*_. 

![Dilbert comic about forecasting just being guessing plus math](https://i.pinimg.com/originals/8f/21/b0/8f21b0f186ba65c13f63a9b1805349cd.gif)
