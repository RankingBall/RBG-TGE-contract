// in truffle environment

/* eslint-disable */
moment = require("moment");
get = require("lodash/get");
range = require("lodash/range");
ethUtils = require("ethereumjs-util");
validate = require("tokyo-schema").default;
parseUnixTimestamp = require("./lib/utils").parseUnixTimestamp;

BigNumber = web3.BigNumber;
const {toBuffer, setLengthLeft, addHexPrefix, isValidAddress} = ethUtils;

// Contract Artifacts
Vault = MultiHolderVault;
Multisig = MultiSigWallet;
Token = RankingBallGoldCustomToken;
Crowdsale = RankingBallGoldCrowdsale;


// helper functions
toLeftPaddedBuffer = (v) => {val = addHexPrefix(new BigNumber(v).toString(16));buf = toBuffer(val);hex = setLengthLeft(buf, 32).toString("hex");return addHexPrefix(hex);};
logAddress = caption => i => {console.log(caption, i.address);};

// Main scripts
address = {};
const { value, error } = validate(require("./input.json"));
input = value;

data = { address, input };

let kyc, vault, locker, multisigs, token, crowdsale;

// Transactions
KYC.new().then(i => kyc = i).then(logAddress("KYC:"));
Vault.new(get(data, "input.sale.new_token_owner"),get(data, "input.sale.coeff")).then(i => vault = i).then(logAddress("Vault:"));
Token.new("0x00").then(i => token = i).then(logAddress("Token:"));

address.kyc = kyc.address;
address.vault = vault.address;
address.token = token.address;



Promise.all([Multisig.new(["0xbB4774A4acCe63Bbbc564dc5C77886B7257DE9b8", "0x55E628D4bAb3Aa9aB593717E2a15690254Ed1B04", "0x977035241e4BED626965ab21c93ef4eb342b7BDD"], 2),Multisig.new(["0xE21cC11659F79c2D1d185619fD32Dc2C0120D4Ac", "0x9DE692A1F1F22e4Be4A890B3adEc0D31E99B6D92", "0xEb39b26B44b29A29e55dE2bAaBB5C9b2bf867e2c"], 2)]).then(arr => multisigs = arr).then(() => multisigs.forEach(logAddress("Multisig")));
address.multisigs = multisigs.map(m => m.address);


Locker.new(get(data, "address.token"),get(data, "input.sale.coeff"),[get(data, "input.locker.beneficiaries.0.address"),get(data, "input.locker.beneficiaries.1.address")],[get(data, "input.locker.beneficiaries.0.ratio"),get(data, "input.locker.beneficiaries.1.ratio")]).then(i => locker = i).then(logAddress("Locker:"))
address.locker = locker.address;


Crowdsale.new([get(data, "input.sale.coeff"),get(data, "address.token"),get(data, "input.sale.valid_purchase.block_interval"),get(data, "address.kyc"),get(data, "input.sale.stages.length")].map(toLeftPaddedBuffer)).then(i => crowdsale = i).then(logAddress("Crowdsale:"))
address.crowdsale = crowdsale.address;


tokenDistributions = get(data, "input.sale.distribution.token");
lockerRatios = tokenDistributions.filter(t => t.token_holder === "locker")[0].token_ratio;
crowdsaleRatio = tokenDistributions.filter(t => t.token_holder === "crowdsale")[0].token_ratio;
initArgs = [new BigNumber(get(data, "input.sale.start_time")),new BigNumber(get(data, "input.sale.end_time")),new BigNumber(get(data, "input.sale.rate.base_rate")),new BigNumber(get(data, "input.sale.max_cap")),new BigNumber(get(data, "input.sale.min_cap")),new BigNumber(crowdsaleRatio),get(data, "address.vault"),get(data, "address.locker"),get(data, "input.sale.new_token_owner")];

// initialize crowdsale
crowdsale.init(initArgs.map(toLeftPaddedBuffer));

// init ether holders
etherHolderAddresses = get(data, "input.sale.distribution.ether").map(({ether_holder}) => {if (isValidAddress(ether_holder)) return ether_holder;if (ether_holder.includes("multisig")) {idx = Number(ether_holder.split("multisig")[1]);if (!isValidAddress(address.multisigs[idx])) throw new Error("Invalid multisig address", address.multisigs[idx]);return address.multisigs[idx];}});
etherHolderRatios = get(data, "input.sale.distribution.ether").map(e => e.ether_ratio);

vault.initHolders(etherHolderAddresses,etherHolderRatios,);

// init token holders
tokenHolderAddresses = get(data, "input.sale.distribution.token").map(({token_holder}) => {if (isValidAddress(token_holder)) return token_holder;if (token_holder === "crowdsale") return "0x00";if (token_holder === "locker") return address.locker;if (token_holder.includes("multisig")) {idx = Number(token_holder.split("multisig")[1]);if (!isValidAddress(address.multisigs[idx])) throw new Error("Invalid multisig address", address.multisigs[idx]);return address.multisigs[idx];}});
tokenHolderRatios = get(data, "input.sale.distribution.token").map(e => e.token_ratio);

crowdsale.initHolders(tokenHolderAddresses,tokenHolderRatios,);


bonusTimeStages = [get(data, "input.sale.rate.bonus.time_bonuses.0.bonus_time_stage"),get(data, "input.sale.rate.bonus.time_bonuses.1.bonus_time_stage"),get(data, "input.sale.rate.bonus.time_bonuses.2.bonus_time_stage"),get(data, "input.sale.rate.bonus.time_bonuses.3.bonus_time_stage"),get(data, "input.sale.rate.bonus.time_bonuses.4.bonus_time_stage") ];
bonusTimeRatios = [get(data, "input.sale.rate.bonus.time_bonuses.0.bonus_time_ratio"),get(data, "input.sale.rate.bonus.time_bonuses.1.bonus_time_ratio"),get(data, "input.sale.rate.bonus.time_bonuses.2.bonus_time_ratio"),get(data, "input.sale.rate.bonus.time_bonuses.3.bonus_time_ratio"),get(data, "input.sale.rate.bonus.time_bonuses.4.bonus_time_ratio") ];

// no amount bonus
// bonusAmountStages = [get(data, "input.sale.rate.bonus.amount_bonuses.0.bonus_amount_stage") ];
// bonusAmountRatios = [get(data, "input.sale.rate.bonus.amount_bonuses.0.bonus_amount_ratio") ];

bonusAmountStages = [];
bonusAmountRatios = [];

crowdsale.setBonusesForTimes(bonusTimeStages,bonusTimeRatios);
crowdsale.setBonusesForAmounts(bonusAmountStages,bonusAmountRatios);


// init stages
periodStartTimes = [get(data, "input.sale.stages.0.start_time"),get(data, "input.sale.stages.1.start_time") ];
periodEndTimes = [get(data, "input.sale.stages.0.end_time"),get(data, "input.sale.stages.1.end_time") ];
periodCapRatios = [get(data, "input.sale.stages.0.cap_ratio"),get(data, "input.sale.stages.1.cap_ratio") ];
periodMaxPurchaseLimits = [get(data, "input.sale.stages.0.max_purchase_limit"),get(data, "input.sale.stages.1.max_purchase_limit") ];
periodMinPurchaseLimits = [get(data, "input.sale.stages.0.min_purchase_limit"),get(data, "input.sale.stages.1.min_purchase_limit") ];
periodKycs = [get(data, "input.sale.stages.0.kyc"),get(data, "input.sale.stages.1.kyc") ];

crowdsale.initStages(periodStartTimes,periodEndTimes,periodCapRatios,periodMaxPurchaseLimits,periodMinPurchaseLimits,periodKycs);


release0Times = [get(data, "input.locker.beneficiaries.0.release.0.release_time"),get(data, "input.locker.beneficiaries.0.release.1.release_time") ];
release0Ratios = [get(data, "input.locker.beneficiaries.0.release.0.release_ratio"),get(data, "input.locker.beneficiaries.0.release.1.release_ratio") ];

locker.lock(get(data, "input.locker.beneficiaries.0.address"),get(data, "input.locker.beneficiaries.0.is_straight"),release0Times,release0Ratios);

release1Times = [get(data, "input.locker.beneficiaries.1.release.0.release_time"),get(data, "input.locker.beneficiaries.1.release.1.release_time") ];
release1Ratios = [get(data, "input.locker.beneficiaries.1.release.0.release_ratio"),get(data, "input.locker.beneficiaries.1.release.1.release_ratio") ];

locker.lock(get(data, "input.locker.beneficiaries.1.address"),get(data, "input.locker.beneficiaries.1.is_straight"),release1Times,release1Ratios);


vault.transferOwnership(crowdsale.address);
locker.transferOwnership(crowdsale.address);
token.changeController(crowdsale.address);


// check parameters
token.name();
token.transfersEnabled();

crowdsale.startTime().then(parseUnixTimestamp);
crowdsale.endTime().then(parseUnixTimestamp);
crowdsale.rate();
crowdsale.coeff();
crowdsale.goal().then(v => v.toPrecision(18));
crowdsale.cap().then(v => v.toPrecision(18));
crowdsale.nextTokenOwner();
crowdsale.crowdsaleRatio();


crowdsale.bonusesForTimesCount().then(v => numTimeBonuses = v);
crowdsale.bonusesForAmountsCount().then(v => numAmountBonuses = v);

Promise.all(range(numTimeBonuses).map((i) => crowdsale.BONUS_TIMES(i)));
Promise.all(range(numTimeBonuses).map((i) => crowdsale.BONUS_TIMES_VALUES(i)));

Promise.all(range(numAmountBonuses).map((i) => crowdsale.BONUS_AMOUNTS(i)));
Promise.all(range(numAmountBonuses).map((i) => crowdsale.BONUS_AMOUNTS_VALUES(i)));


crowdsale.getHolderCount().then(v => numTokenHolders = v);
Promise.all(range(numTokenHolders).map((i) => crowdsale.holders(i).then(arr => [arr[0], arr[1].valueOf()])));

vault.getHolderCount().then(v => numEtherHolders = v);
Promise.all(range(numEtherHolders).map((i) => vault.holders(i).then(arr => [arr[0], arr[1].valueOf()])));

locker.coeff();

beneficiary0 = get(data, "input.locker.beneficiaries.0.address");
locker.locked(beneficiary0);
locker.getReleaseType(beneficiary0);
locker.getReleaseTimes(beneficiary0);
locker.getReleaseRatios(beneficiary0).then(JSON.stringify);

beneficiary1 = get(data, "input.locker.beneficiaries.1.address");
locker.locked(beneficiary1);
locker.getReleaseType(beneficiary1);
locker.getReleaseTimes(beneficiary1);
locker.getReleaseRatios(beneficiary1).then(JSON.stringify);
