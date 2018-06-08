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

const BigNumber = web3.BigNumber;
const eth = web3.eth;

const should = require("chai")
  .use(require("chai-as-promised"))
  .use(require("chai-bignumber")(BigNumber))
  .should();

const CustomToken = artifacts.require("./RankingBallGoldCustomToken.sol");
const POSController = artifacts.require("./POSController.sol");

contract("RankingBallGoldCustomToken", async ([ owner, other, investor1, investor2, investor3, ...accounts ]) => {
  describe("POSController", async () => {
    // pos contract instance
    let posToken, posController;

    // holders
    const numHolders = 5;
    const tokenHolders = accounts.slice(1, numHolders + 1);
    const tokenAmount = ether(10);

    // pos parameters. 10% intereest for each 100 blocks
    const posInterval = new BigNumber(30);
    const posRate = new BigNumber(100);
    const posCoeff = new BigNumber(1000);
    const _1ClaimRate = new BigNumber(1.100);
    const _2ClaimRate = new BigNumber(1.210);
    const _3ClaimRate = new BigNumber(1.331);

    // helper function
    const moveAfterInterval = async () => {
      const initBlock = await posController.initBlockNumber();
      const currentBlockNumber = web3.eth.blockNumber;
      const diff = posInterval - (currentBlockNumber - initBlock) % posInterval;
      const targetBlockNumber = currentBlockNumber + diff + 5; // 5 more blocks

      console.log(`move from ${ web3.eth.blockNumber } to ${ targetBlockNumber } with posInitBlock ${ initBlock }, diff ${ diff }`);

      await advanceToBlock(targetBlockNumber);
    };
    const getTokenBalance = holder => posToken.balanceOf(holder);
    const claimTokens = holder => posController.claimTokens(holder, { from: holder })
      .should.be.fulfilled;
    const claimAllHolderTokens = () => Promise.all(tokenHolders
      .map(claimTokens)
      .map(p => p.should.be.fulfilled));

    before(async () => {
      // deploy new contract
      posToken = await CustomToken.new("0x00");
      posController = await POSController.new(posToken.address, posInterval, 0, posRate, posCoeff);

      await Promise.all(tokenHolders.map(holder => posToken.generateTokens(holder, tokenAmount)))
        .should.be.fulfilled;
      await posToken.changeController(posController.address);
    });

    // just test pos controller works. it is tested in its own test suite.
    it("holders can claim tokens after 1 intervals passed", async () => {
      await claimAllHolderTokens();

      await moveAfterInterval();

      const beforeBalances = await Promise.all(tokenHolders.map(getTokenBalance));
      const claimRate = _1ClaimRate;

      await Promise.all(tokenHolders
        .map(claimTokens));

      const afterBalances = await Promise.all(tokenHolders.map(getTokenBalance));

      afterBalances.forEach((afterBalance, i) => {
        const beforeBalance = beforeBalances[ i ];

        afterBalance.should.be.bignumber
          .equal(beforeBalance.mul(claimRate));
      });
    });

    it("should claim token ownership from controller", async () => {
      await posController.claimTokenOwnership(owner).should.be.fulfilled;
    });
  });
});
