import moment from "moment";
import get from "lodash/get";
import range from "lodash/range";
import validate from "tokyo-schema";

import ether from "./helpers/ether";
import advanceToBlock, { advanceBlock, advanceManyBlock } from "./helpers/advanceToBlock";
import increaseTime, { increaseTimeTo, duration } from "./helpers/increaseTime";
import latestTime from "./helpers/latestTime";
import EVMThrow from "./helpers/EVMThrow";
import { capture, restore, Snapshot } from "./helpers/snapshot";
import timer from "./helpers/timer";
import sendTransaction from "./helpers/sendTransaction";
import "./helpers/upgradeBigNumber";

import { parseUnixTimestamp } from "../lib/utils";

const BigNumber = web3.BigNumber;
const eth = web3.eth;

const should = require("chai")
  .use(require("chai-as-promised"))
  .use(require("chai-bignumber")(BigNumber))
  .should();

const KYC = artifacts.require("./KYC.sol");
const Vault = artifacts.require("./MultiHolderVault.sol");
const Locker = artifacts.require("./Locker.sol");
const Token = artifacts.require("./RankingBallGoldCustomToken.sol");
const Crowdsale = artifacts.require("./RankingBallGoldCrowdsale.sol");

contract("RankingBallGoldCrowdsale", async ([ owner, other, investor1, investor2, investor3, ...accounts ]) => {
  // contract instances
  let kyc, vault, locker, token, crowdsale;
  const investors = accounts.slice(0, 20);

  // TX parameteres
  const gas = 2000000;

  // test parameteres
  const input = validate(getInput()).value;
  const timeBonuses = input.sale.rate.bonus
    .time_bonuses.map(b => b.bonus_time_ratio); // 21%, 20%, 15%, 10%, 5%
  const amountBonus = input.sale.rate.bonus
    .amount_bonuses.map(b => b.bonus_amount_ratio)[ 0 ] || new BigNumber(0); // 27% or 0%

  const baseRate = new BigNumber(input.sale.rate.base_rate);
  const coeff = new BigNumber(input.sale.coeff); // 10000

  const maxCap = new BigNumber(input.sale.max_cap); // 30000 ether
  const minCap = new BigNumber(input.sale.min_cap); // #000 ether
  const purchaseLimits = [
    maxCap, // stage 0 has no max purcahse limit.
    ether(1000),
  ];

  before(async () => {
    // load contracts
    kyc = await KYC.deployed();
    vault = await Vault.deployed();
    locker = await Locker.deployed();
    token = await Token.deployed();
    crowdsale = await Crowdsale.deployed();

    console.log(`
      kyc: ${ kyc.address }
      vault: ${ vault.address }
      locker: ${ locker.address }
      token: ${ token.address }
      token.controller: ${ await token.controller() }
      crowdsale: ${ crowdsale.address }
    `);
  });

  // const snapshot = new Snapshot();
  // before(snapshot.captureContracts);
  // after(snapshot.restoreContracts);

  // helper functions
  const advanceBlocks = () => advanceManyBlock(input.sale.valid_purchase.block_interval);

  // test purchase scenarios for stage#1 (stage#0 has different test cases)
  const purchaseTest = (investor, timeBonus, purchaseLimit) => async () => {
    it("reject buying tokens for unknown account", async () => {
      const investAmount = ether(10);

      await sendTransaction({
        from: other, to: crowdsale.address, value: investAmount, gas,
      }).should.be.rejectedWith(EVMThrow);
    });

    it("reject buying tokens under min purchase", async () => {
      const investAmount = ether(0.099);

      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.rejectedWith(EVMThrow);
    });

    it("accept buying tokens for known account", async () => {
      const investAmount = ether(1000);
      const rate = calcRate(baseRate, timeBonus, coeff);

      const tokenAmount = investAmount.mul(rate);
      const tokenBalance = await token.balanceOf(investor);

      await advanceBlocks();
      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.fulfilled;

      (await token.balanceOf(investor))
        .should.be.bignumber.equal(tokenBalance.add(tokenAmount));
    });

    it("accept buying tokens with dirty amount", async () => {
      const investAmount = ether(12.154261371);
      const rate = calcRate(baseRate, timeBonus, coeff);

      const tokenAmount = investAmount.mul(rate);
      const tokenBalance = await token.balanceOf(investor);

      await advanceBlocks();
      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.fulfilled;

      (await token.balanceOf(investor))
        .should.be.bignumber.equal(tokenBalance.add(tokenAmount));
    });

    it("accept buying tokens over max purchase limit", async () => {
      const investAmount = purchaseLimit.mul(2);
      const fundedAmount = purchaseLimit;
      const rate = calcRate(baseRate, timeBonus, coeff);

      const tokenAmount = fundedAmount.mul(rate);
      const tokenBalance = await token.balanceOf(investor);

      await advanceBlocks();
      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.fulfilled;

      (await token.balanceOf(investor))
        .should.be.bignumber.equal(tokenBalance.add(tokenAmount));
    });

    it("reject buying tokens within a few blocks", async () => {
      const investAmount = ether(10);

      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.rejectedWith(EVMThrow);
    });
  };

  // test over max cap case
  const testOverMaxCap = async (timeBonus, purchaseLimit) => {
    let remainingEther = maxCap.sub(await crowdsale.weiRaised());

    while (remainingEther.gt(0)) {
      const investor = investor1;
      const investAmount = purchaseLimit;

      let fundedAmount;
      if (investAmount.gt(remainingEther)) {
        fundedAmount = remainingEther;
      } else {
        fundedAmount = purchaseLimit;
      }

      const rate = calcRate(baseRate, timeBonus, coeff);

      const tokenAmount = fundedAmount.mul(rate);
      const tokenBalance = await token.balanceOf(investor);

      await advanceBlocks();
      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.fulfilled;

      (await token.balanceOf(investor))
        .should.be.bignumber.equal(tokenBalance.add(tokenAmount));

      remainingEther = maxCap.sub(await crowdsale.weiRaised());
    }
  };

  // test finalize case
  const testFianlize = async () => {
    const tokenDistributions = input.sale.distribution.token;
    const etherDistributions = input.sale.distribution.ether;

    const lockerRatio = tokenDistributions
      .filter(t => t.token_holder === "locker")[ 0 ].token_ratio;
    const saleRatio = tokenDistributions
      .filter(t => t.token_holder === "crowdsale")[ 0 ].token_ratio;

    const saleAmounts = await token.totalSupply();
    const totalEtherFunded = await web3.eth.getBalance(vault.address);

    await crowdsale.finalize()
      .should.be.fulfilled;

    const totalSupply = await token.totalSupply();
    const lockerAmounts = await token.balanceOf(locker.address);

    lockerAmounts.should.be.bignumber.equal(totalSupply.mul(lockerRatio).div(coeff));
    saleAmounts.should.be.bignumber.equal(totalSupply.mul(saleRatio).div(coeff));

    // token distribution
    for (const { token_holder, token_ratio } of tokenDistributions) {
      if (token_holder === "crowdsale") {
        continue;
      }

      let addr;
      if (token_holder === "locker") {
        addr = locker.address;
      } else {
        addr = token_holder;
      }

      const holderBalance = await token.balanceOf(addr);

      holderBalance.should.be.bignumber.equal(totalSupply.mul(token_ratio).div(coeff));
    }

    // ether distribution
    for (let i = 0; i < 5; i++) {
      const holder = (await vault.holders(i))[ 0 ];
      const holderBalance = await web3.eth.getBalance(holder);

      // 20% for each holder
      holderBalance.should.be.bignumber.equal(totalEtherFunded.div(5));
    }
  };

  it("setup contracts", async () => {
    await kyc.register(investor1, { from: owner })
      .should.be.fulfilled;
    await kyc.register(investor2, { from: owner })
      .should.be.fulfilled;
    await kyc.register(investor3, { from: owner })
      .should.be.fulfilled;

    await kyc.registerByList(investors)
      .should.be.fulfilled;

    await advanceBlocks();
  });

  it("check parameters", async () => {
    (await crowdsale.nextTokenOwner())
      .should.be.equal(input.sale.new_token_owner);

    (await crowdsale.cap())
      .should.be.bignumber.equal(maxCap);

    (await crowdsale.goal())
      .should.be.bignumber.equal(minCap);
  });

  describe("Before start time", async () => {
    it("reject buying tokens", async () => {
      const investAmount = ether(10);
      await sendTransaction({
        from: investor1, to: crowdsale.address, value: investAmount, gas,
      }).should.be.rejectedWith(EVMThrow);
    });
  });

  describe("After start time (stage 0, bonus 60%)", async () => {
    const timeBonusIndex = 0;
    const timeBonus = timeBonuses[ timeBonusIndex ];
    const timeBonusString = timeBonus.div(coeff).mul(100).toString();
    const amountBonusString = amountBonus.div(coeff).mul(100).toString();

    const stageIndex = 0;
    const maxPurchaseLimit = purchaseLimits[ stageIndex ];

    const targetTime = input.sale.start_time;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString } with time bonus ${ timeBonusString }% & amount bonus ${ amountBonusString }%`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    it("reject buying tokens for unknown account", async () => {
      const investAmount = ether(10);

      await sendTransaction({
        from: other, to: crowdsale.address, value: investAmount, gas,
      }).should.be.rejectedWith(EVMThrow);
    });

    it(`accept buying tokens for known account without amount bonus (only with time bonus ${ timeBonusString }%)`, async () => {
      const investor = investor1;
      const investAmount = ether(1000);
      const rate = calcRate(baseRate, timeBonus, coeff);

      const tokenAmount = investAmount.mul(rate);
      const tokenBalance = await token.balanceOf(investor);

      await advanceBlocks();
      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.fulfilled;

      (await token.balanceOf(investor))
        .should.be.bignumber.equal(tokenBalance.add(tokenAmount));
    });

    it(`accept buying tokens for known account with amount bonus (time bonus ${ timeBonusString }% + amount bonus ${ amountBonusString }%)`, async () => {
      const investor = investor2;
      const investAmount = ether(5000);
      const bonus = amountBonus.add(timeBonus);
      const rate = calcRate(baseRate, bonus, coeff);

      const tokenAmount = investAmount.mul(rate);
      const tokenBalance = await token.balanceOf(investor);

      await advanceBlocks();
      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.fulfilled;

      (await token.balanceOf(investor))
        .should.be.bignumber.equal(tokenBalance.add(tokenAmount));
    });

    it("reject buying tokens within a few blocks", async () => {
      const investor = investor2;
      const investAmount = ether(10);

      await sendTransaction({
        from: investor, to: crowdsale.address, value: investAmount, gas,
      }).should.be.rejectedWith(EVMThrow);
    });

    describe("Over max cap scenarios", async () => {
      const snapshot2 = new Snapshot();

      before(snapshot2.captureContracts);
      after(snapshot2.restoreContracts);

      it("accept buying tokens over max cap", async () => {
        const bonus = timeBonus.add(amountBonus);
        await testOverMaxCap(bonus, maxPurchaseLimit).should.be.fulfilled;
      });

      it("should finalize crowdsale before end time if max cap reached", async () => {
        await testFianlize().should.be.fulfilled;
      });
    });
  });

  describe("After start time (stage 1, bonus 20%)", async () => {
    const timeBonusIndex = 1;
    const timeBonus = timeBonuses[ timeBonusIndex ];
    const timeBonusString = timeBonus.div(coeff).mul(100).toString();

    const stageIndex = 1;
    const maxPurchaseLimit = purchaseLimits[ stageIndex ];

    const targetTime = input.sale.rate.bonus
      .time_bonuses[ timeBonusIndex - 1 ].bonus_time_stage + 1;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString } with bonus ${ timeBonusString }%`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    describe("Purchase scenarios", async () => {
      const investor = investor1;
      const test = purchaseTest(investor, timeBonus, maxPurchaseLimit);
      await test();
    });

    describe("Over max cap scenarios", async () => {
      const snapshot2 = new Snapshot();

      before(snapshot2.captureContracts);
      after(snapshot2.restoreContracts);

      it("accept buying tokens over max cap", async () => {
        await testOverMaxCap(timeBonus, maxPurchaseLimit).should.be.fulfilled;
      });

      it("should finalize crowdsale before end time if max cap reached", async () => {
        await testFianlize().should.be.fulfilled;
      });
    });
  });

  describe("After start time (stage 1, bonus 15%)", async () => {
    const timeBonusIndex = 2;
    const timeBonus = timeBonuses[ timeBonusIndex ];
    const timeBonusString = timeBonus.div(coeff).mul(100).toString();

    const stageIndex = 1;
    const maxPurchaseLimit = purchaseLimits[ stageIndex ];

    const targetTime = input.sale.rate.bonus
      .time_bonuses[ timeBonusIndex - 1 ].bonus_time_stage + 1;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString } with bonus ${ timeBonusString }%`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    describe("Purchase scenarios", async () => {
      const investor = investor2;
      const test = purchaseTest(investor, timeBonus, maxPurchaseLimit);
      await test();
    });

    describe("Over max cap scenarios", async () => {
      const snapshot2 = new Snapshot();

      before(snapshot2.captureContracts);
      after(snapshot2.restoreContracts);

      it("accept buying tokens over max cap", async () => {
        await testOverMaxCap(timeBonus, maxPurchaseLimit).should.be.fulfilled;
      });

      it("should finalize crowdsale before end time if max cap reached", async () => {
        await testFianlize().should.be.fulfilled;
      });
    });
  });

  describe("After start time (stage 1, bonus 10%)", async () => {
    const timeBonusIndex = 3;
    const timeBonus = timeBonuses[ timeBonusIndex ];
    const timeBonusString = timeBonus.div(coeff).mul(100).toString();

    const stageIndex = 1;
    const maxPurchaseLimit = purchaseLimits[ stageIndex ];

    const targetTime = input.sale.rate.bonus
      .time_bonuses[ timeBonusIndex - 1 ].bonus_time_stage + 1;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString } with bonus ${ timeBonusString }%`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    describe("Purchase scenarios", async () => {
      const investor = investor3;
      const test = purchaseTest(investor, timeBonus, maxPurchaseLimit);
      await test();
    });

    describe("Over max cap scenarios", async () => {
      const snapshot2 = new Snapshot();

      before(snapshot2.captureContracts);
      after(snapshot2.restoreContracts);

      it("accept buying tokens over max cap", async () => {
        await testOverMaxCap(timeBonus, maxPurchaseLimit).should.be.fulfilled;
      });

      it("should finalize crowdsale before end time if max cap reached", async () => {
        await testFianlize().should.be.fulfilled;
      });
    });
  });

  describe("After start time (stage 1, bonus 5%)", async () => {
    const timeBonusIndex = 4;
    const timeBonus = timeBonuses[ timeBonusIndex ];
    const timeBonusString = timeBonus.div(coeff).mul(100).toString();

    const stageIndex = 1;
    const maxPurchaseLimit = purchaseLimits[ stageIndex ];

    const targetTime = input.sale.rate.bonus
      .time_bonuses[ timeBonusIndex - 1 ].bonus_time_stage + 1;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString } with bonus ${ timeBonusString }%`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    describe("Purchase scenarios", async () => {
      const investor = investor1;
      const test = purchaseTest(investor, timeBonus, maxPurchaseLimit);
      await test();
    });

    describe("Over max cap scenarios", async () => {
      const snapshot2 = new Snapshot();

      before(snapshot2.captureContracts);
      after(snapshot2.restoreContracts);

      it("accept buying tokens over max cap", async () => {
        await testOverMaxCap(timeBonus, maxPurchaseLimit).should.be.fulfilled;
      });

      it("should finalize crowdsale before end time if max cap reached", async () => {
        await testFianlize().should.be.fulfilled;
      });
    });
  });

  describe("After start time (stage 1, bonus 0%)", async () => {
    const timeBonusIndex = 5;
    const timeBonus = new BigNumber(0);
    const timeBonusString = timeBonus.div(coeff).mul(100).toString();

    const stageIndex = 1;
    const maxPurchaseLimit = purchaseLimits[ stageIndex ];

    const targetTime = input.sale.rate.bonus
      .time_bonuses[ timeBonusIndex - 1 ].bonus_time_stage + 1;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString } with bonus ${ timeBonusString }%`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    describe("Purchase scenarios", async () => {
      const investor = investor3;
      const test = purchaseTest(investor, timeBonus, maxPurchaseLimit);
      await test();
    });

    describe("Over max cap scenarios", async () => {
      const snapshot2 = new Snapshot();

      before(snapshot2.captureContracts);
      after(snapshot2.restoreContracts);

      it("accept buying tokens over max cap", async () => {
        await testOverMaxCap(timeBonus, maxPurchaseLimit).should.be.fulfilled;
      });

      it("should finalize crowdsale before end time if max cap reached", async () => {
        await testFianlize().should.be.fulfilled;
      });
    });
  });

  describe("After sale period ended", async () => {
    const targetTime = input.sale.end_time + 1;
    const targetTimeString = parseUnixTimestamp(targetTime);

    it(`increase time to ${ targetTimeString }`, async () => {
      await increaseTimeTo(targetTime)
        .should.be.fulfilled;
    });

    it("should finalize crowdsale and distribute token correctly", async () => {
      console.log(`weiRaised: ${ await crowdsale.weiRaised() }`);
      await testFianlize().should.be.fulfilled;
    });
  });
});

function getInput() {
  /* eslint-disable */
  return require("../input.json");
  /* eslint-enable */
}

function calcRate(baseRate, bonus, coeff) {
  const r = new BigNumber(baseRate);
  const b = new BigNumber(bonus);
  const c = new BigNumber(coeff);

  return r.mul(b.add(c)).div(c);
}
