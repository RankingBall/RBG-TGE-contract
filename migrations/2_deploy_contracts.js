const fs = require("fs");
const path = require("path");
const moment = require("moment");
const get = require("lodash/get");
const ethUtils = require("ethereumjs-util");
const validate = require("tokyo-schema").default;

const BigNumber = web3.BigNumber;
const { toBuffer, setLengthLeft, addHexPrefix, isValidAddress } = ethUtils;

/**
 * Contract Artifacts
 */
const KYC = artifacts.require("./KYC.sol");
const Vault = artifacts.require("./MultiHolderVault.sol");
const Locker = artifacts.require("./Locker.sol");
const Multisig = artifacts.require("./MultiSigWallet.sol");
const Token = artifacts.require("./RankingBallGoldCustomToken.sol");
const Crowdsale = artifacts.require("./RankingBallGoldCrowdsale.sol");

module.exports = async function (deployer, network, accounts) {
  console.log(accounts)
  const address = {};
  const { value, error } = validate(getInput());
  const input = value;

  const data = { address, input };

  // contract instance
  let kyc, vault, locker, multisigs, token, crowdsale;

  /**
   * Deploy contracts sequentually
   *  1. KYC / Vault / Locker / Multisigs(optional)
   *  2. Token
   *  3. Crowdsale
   *  4. Initialize contracts
   *   - transfer ownerships of vault, token, lcoker to crowdsale
   *   - Crowdsale.init()
   */

  deployer.deploy([
    KYC,
    [
      Vault,
      get(data, "input.sale.new_token_owner"),
      get(data, "input.sale.coeff"),
    ],
    [
      Token,
      // token arguments...
      "0x0000000000000000000000000000000000000000"
    ]
  ]).then(async () => {
    kyc = await KYC.deployed();
    vault = await Vault.deployed();
    token = await Token.deployed();

    address.kyc = kyc.address;
    address.vault = vault.address;
    address.token = token.address;
  }).then(async () => {
    multisigs = await Promise.all([
      
    ]);

    address.multisigs = multisigs.map(m => m.address);
    console.log("Multisigs :", address.multisigs.join(", "));
    fs.writeFileSync(path.resolve(__dirname, "../multisigs.json"), JSON.stringify(address.multisigs));
  }).then(async () => deployer.deploy([
    [
      Locker,
      get(data, "address.token"),
      get(data, "input.sale.coeff"),
      [
        get(data, "input.locker.beneficiaries.0.address"),
        get(data, "input.locker.beneficiaries.1.address")
      ],
      [
        get(data, "input.locker.beneficiaries.0.ratio"),
        get(data, "input.locker.beneficiaries.1.ratio")
      ]
    ],
  ])).then(async () => {
    locker = await Locker.deployed();

    address.locker = locker.address;
  }).then(() => deployer.deploy([
    [
      Crowdsale,
      [
        get(data, "input.sale.coeff"),
        get(data, "address.token"),
        get(data, "input.sale.valid_purchase.block_interval"),
        get(data, "address.kyc"),
        get(data, "input.sale.stages.length"),
      ].map(toLeftPaddedBuffer)
    ]
  ])).then(async () => {
    crowdsale = await Crowdsale.deployed();

    address.crowdsale = crowdsale.address;
  }).then(async () => {
    
    const tokenDistributions = get(data, "input.sale.distribution.token");
    const lockerRatios = tokenDistributions
      .filter(t => t.token_holder === "locker")[0].token_ratio;
    const crowdsaleRatio = tokenDistributions
      .filter(t => t.token_holder === "crowdsale")[0].token_ratio;
  
    const initArgs = [
      new BigNumber(get(data, "input.sale.start_time")),
      new BigNumber(get(data, "input.sale.end_time")),
      new BigNumber(get(data, "input.sale.rate.base_rate")),
      new BigNumber(get(data, "input.sale.max_cap")),
      new BigNumber(get(data, "input.sale.min_cap")),
      new BigNumber(crowdsaleRatio),
      get(data, "address.vault"),
      get(data, "address.locker"),
      get(data, "input.sale.new_token_owner")
    ];
    
    await crowdsale.init(initArgs.map(toLeftPaddedBuffer));

    const etherHolderAddresses = get(data, "input.sale.distribution.ether").map(({ether_holder}) => {
      if (isValidAddress(ether_holder)) return ether_holder;
      if (ether_holder.includes("multisig")) {
        const idx = Number(ether_holder.split("multisig")[1]);
        if (!isValidAddress(address.multisigs[idx])) throw new Error("Invalid multisig address", address.multisigs[idx]);
    
        return address.multisigs[idx];
      }
    });
    const etherHolderRatios = get(data, "input.sale.distribution.ether").map(e => e.ether_ratio);
    
    await vault.initHolders(
      etherHolderAddresses,
      etherHolderRatios,
    );
    
    const tokenHolderAddresses = get(data, "input.sale.distribution.token").map(({token_holder}) => {
      if (isValidAddress(token_holder)) return token_holder;
      if (token_holder === "crowdsale") return "0x00";
      if (token_holder === "locker") return address.locker;
      if (token_holder.includes("multisig")) {
        const idx = Number(token_holder.split("multisig")[1]);
        if (!isValidAddress(address.multisigs[idx])) throw new Error("Invalid multisig address", address.multisigs[idx]);
    
        return address.multisigs[idx];
      }
    });
    const tokenHolderRatios = get(data, "input.sale.distribution.token").map(e => e.token_ratio);
    
    await crowdsale.initHolders(
      tokenHolderAddresses,
      tokenHolderRatios,
    );
    
    const bonusTimeStages = [
      get(data, "input.sale.rate.bonus.time_bonuses.0.bonus_time_stage"),
      get(data, "input.sale.rate.bonus.time_bonuses.1.bonus_time_stage"),
      get(data, "input.sale.rate.bonus.time_bonuses.2.bonus_time_stage"),
      get(data, "input.sale.rate.bonus.time_bonuses.3.bonus_time_stage"),
      get(data, "input.sale.rate.bonus.time_bonuses.4.bonus_time_stage") ];
    const bonusTimeRatios = [
      get(data, "input.sale.rate.bonus.time_bonuses.0.bonus_time_ratio"),
      get(data, "input.sale.rate.bonus.time_bonuses.1.bonus_time_ratio"),
      get(data, "input.sale.rate.bonus.time_bonuses.2.bonus_time_ratio"),
      get(data, "input.sale.rate.bonus.time_bonuses.3.bonus_time_ratio"),
      get(data, "input.sale.rate.bonus.time_bonuses.4.bonus_time_ratio") ];
      
    const bonusAmountStages = [
       ];
    const bonusAmountRatios = [
       ];

    await crowdsale.setBonusesForTimes(
      bonusTimeStages,
      bonusTimeRatios,
    );

    await crowdsale.setBonusesForAmounts(
      bonusAmountStages,
      bonusAmountRatios,
    );

    const periodStartTimes = [
      get(data, "input.sale.stages.0.start_time"),
      get(data, "input.sale.stages.1.start_time") ];
    const periodEndTimes = [
      get(data, "input.sale.stages.0.end_time"),
      get(data, "input.sale.stages.1.end_time") ];
    const periodCapRatios = [
      get(data, "input.sale.stages.0.cap_ratio"),
      get(data, "input.sale.stages.1.cap_ratio") ];
    const periodMaxPurchaseLimits = [
      get(data, "input.sale.stages.0.max_purchase_limit"),
      get(data, "input.sale.stages.1.max_purchase_limit") ];
    const periodMinPurchaseLimits = [
      get(data, "input.sale.stages.0.min_purchase_limit"),
      get(data, "input.sale.stages.1.min_purchase_limit") ];
    const periodKycs = [
      get(data, "input.sale.stages.0.kyc"),
      get(data, "input.sale.stages.1.kyc") ];

    await crowdsale.initStages(
      periodStartTimes,
      periodEndTimes,
      periodCapRatios,
      periodMaxPurchaseLimits,
      periodMinPurchaseLimits,
      periodKycs,
    );

    const release0Times = [
      get(data, "input.locker.beneficiaries.0.release.0.release_time"),
      get(data, "input.locker.beneficiaries.0.release.1.release_time") ];
    const release0Ratios = [
      get(data, "input.locker.beneficiaries.0.release.0.release_ratio"),
      get(data, "input.locker.beneficiaries.0.release.1.release_ratio") ];

    await locker.lock(
      get(data, "input.locker.beneficiaries.0.address"),
      get(data, "input.locker.beneficiaries.0.is_straight"),
      release0Times,
      release0Ratios,
    );

    const release1Times = [
      get(data, "input.locker.beneficiaries.1.release.0.release_time"),
      get(data, "input.locker.beneficiaries.1.release.1.release_time") ];
    const release1Ratios = [
      get(data, "input.locker.beneficiaries.1.release.0.release_ratio"),
      get(data, "input.locker.beneficiaries.1.release.1.release_ratio") ];

    await locker.lock(
      get(data, "input.locker.beneficiaries.1.address"),
      get(data, "input.locker.beneficiaries.1.is_straight"),
      release1Times,
      release1Ratios,
    );

  }).then(async () => {
    // transfer ownerships to crowdsale
    await Promise.all([
      vault.transferOwnership(crowdsale.address),
      locker.transferOwnership(crowdsale.address),
      token.changeController(crowdsale.address),
    ]);

  });
};

function getInput() {
  return JSON.parse('{"project_name":"RankingBall Gold","token":{"token_type":{"is_minime":true},"token_option":{"burnable":true,"pausable":true,"no_mint_after_sale":false},"token_name":"RankingBall Gold","token_symbol":"RBG","decimals":18,"use_custom_token":true},"sale":{"max_cap":"30000000000000000000000","min_cap":"3000000000000000000000","start_time":"2018/06/08 00:00:00","end_time":"2018/07/01 23:59:59","coeff":"10000","rate":{"is_static":false,"base_rate":"50000","bonus":{"use_time_bonus":true,"use_amount_bonus":false,"time_bonuses":[{"bonus_time_stage":"2018/06/10 23:59:59","bonus_time_ratio":"4838"},{"bonus_time_stage":"2018/06/11 23:59:59","bonus_time_ratio":"2000"},{"bonus_time_stage":"2018/06/13 23:59:59","bonus_time_ratio":"1500"},{"bonus_time_stage":"2018/06/17 23:59:59","bonus_time_ratio":"1000"},{"bonus_time_stage":"2018/06/24 23:59:59","bonus_time_ratio":"500"}],"amount_bonuses":[]}},"distribution":{"token":[{"token_holder":"crowdsale","token_ratio":"2500"},{"token_holder":"0xacc68c2fa1b34185f0110204ba6bc859e3dfa679","_comment":"reserve1","token_ratio":"833"},{"token_holder":"0x15fe28b0f99332c3e1d0494b6b9629523cba8227","_comment":"reserve2","token_ratio":"833"},{"token_holder":"0x5a6d72a08f2e1f4c690908fb370d56898224822e","_comment":"reserve3","token_ratio":"834"},{"token_holder":"0x1019eb2378a6f3983e4e737320bea9318e5633a1","_comment":"martketingReserve1","token_ratio":"1000"},{"token_holder":"0xb1ee23f9700f3f3c29286a13664408cf410c8e76","_comment":"martketingReserve2","token_ratio":"1000"},{"token_holder":"0x0f562205ee4c8ec149114273e5a77220cf848c7f","_comment":"martketingReserve3","token_ratio":"1000"},{"token_holder":"0x2e018be3593b375b78b2e25727ceaa8b050a3e20","_comment":"businessPartner","token_ratio":"1000"},{"token_holder":"locker","_comment":"locker for owner and dev team","token_ratio":"1000"}],"ether":[{"ether_holder":"0x2ce0e6ff80d8d8838c87d1f025dcd18b7adcf299","ether_ratio":"2000"},{"ether_holder":"0x3ae6238eaee221d794db8df7ff6168ec9f33a718","ether_ratio":"2000"},{"ether_holder":"0x8e40c592cf5def82797b8b0e97e3f740293975ce","ether_ratio":"2000"},{"ether_holder":"0x6e0da2014aeda7a34b4d6c52e0929f322fa0042a","ether_ratio":"2000"},{"ether_holder":"0x966316b7bd078bed6039dcb355f38711fa774c45","ether_ratio":"2000"}]},"stages":[{"start_time":"2018/06/08 00:00:00","end_time":"2018/06/10 23:59:59","cap_ratio":"0","max_purchase_limit":"0","min_purchase_limit":"0","kyc":true},{"start_time":"2018/06/11 00:00:00","end_time":"2018/07/01 23:59:59","cap_ratio":"0","max_purchase_limit":"1000000000000000000000","min_purchase_limit":"100000000000000000","kyc":true}],"valid_purchase":{"max_purchase_limit":"0","min_purchase_limit":"0","block_interval":5},"new_token_owner":"0xaa6d812eefd2c8e36cd38b12ec6ddea6130b6346"},"multisig":{"use_multisig":false,"infos":[]},"locker":{"use_locker":true,"beneficiaries":[{"address":"0xc096d38e2ec3c7f8cf746bb48fb248cf122b0f81","ratio":"5000","is_straight":true,"release":[{"release_time":"2018/08/01 00:00:00","release_ratio":"0"},{"release_time":"2020/07/31 00:00:00","release_ratio":"10000"}]},{"address":"0x3fff7e15ac0da0297b0a05ca4f6256cac198ec41","ratio":"5000","is_straight":true,"release":[{"release_time":"2018/08/01 00:00:00","release_ratio":"5000"},{"release_time":"2020/07/31 00:00:00","release_ratio":"10000"}]}]}}');
}

function toLeftPaddedBuffer(v) {
  const val = addHexPrefix(new BigNumber(v).toString(16));
  const buf = toBuffer(val);
  const hex = setLengthLeft(buf, 32).toString("hex");
  return addHexPrefix(hex);
}



