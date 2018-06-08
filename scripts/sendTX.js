/* eslint-disable max-len, complexity, no-nested-ternary, global-require */
/**
 * Web3@1.0.0-beta.34
 * 사용법:
 *  - `truffle compile` 을 통해서 `build` 디렉토리를 생성 후 실행하세요.
 *  - Boolean 값들은 true 또는 false 만 받아드립니다.
 *  - parameters는 콤마(,)로 구분되며 두 인자 사이에 공백이 있으면 안됩니다.
 *  - 어카운트 정보는 `.env` 파일의 MNEMONIC에 저장됩니다.
 *
 * 0. 공통 옵션 [필수]
 *  --contract-addresss [배포된 컨트랙트 주소]
 *  --function-name [실행할 함수 이름]
 *
 * 0. 공통 옵션 [선택]
 *  --providerUrl [Web3 provider url]
 *  --gasLimit [TX 가스]
 *  --gasPrice [TX 가스 가격]
 *  --nonce [TX nonce]
 *
 * 0. sendTransaction
 *  --function-name sendEther
 *  --parameters [ETH 를 받을 주소], [모든 이더를 보낼 지 여부, default false]
 *  --wei-amount [보낼 ETH 의 wei 값]
 *
 * 1. KYC.register()
 *  --function-name register
 *  --parameters [KYC 등록할 이더리움 주소]
 *
 * 2. KYC.registerByList()
 *  --function-name registerByList
 *  --parameters [KYC 등록할 이더리움 주소1], ... [KYC 등록할 이더리움 주소N]
 *
 * 사용예:

  KYC: 0x636b31b524143cc6abe6170864131c0ab84cde35

  0. sendEther
  node scripts/sendTX.js \
    --function-name sendEther \
    --provider-url https://ropsten.infura.io \
    --parameters 0x515c1dC61a592D9c30329685A607c9255F950Bae \
    --wei-amount 165358858185734252085 \
    --gas-limit 21000 \
    --gas-price 120000000000 \
    -v

 1. register
 node scripts/sendTX.js \
   --function-name register \
   --contract-address 0x636b31b524143cc6abe6170864131c0ab84cde35 \
   --provider-url https://ropsten.infura.io \
   --parameters 0x075451eaec6c450da3ca169e7187ad8b5b745459 \
   -v

 2. registerByList
 node scripts/sendTX.js \
   --function-name registerByList \
   --contract-address 0x636b31b524143cc6abe6170864131c0ab84cde35 \
   --provider-url https://api.myetherapi.com/eth \
   --gas-limit 4300000 \
   --gas-price 30000000000 \
   --parameters 0xEE18A02aDbD1781D840cd62D11f70482e852E33b,0x0D1c87a87eD9503D5139D6ed29530865B8a938bA,0x9364445F97ea5aC67E2F8BF2b2c93D2d2dB07d78,0x9AeD510c5cBf170EC2e1448B36fBC5Cb8f609a78,0x2876A91373e1Dd38b0C507884Fd069b1C436196D,0x2470C2D7A549d872f4D2b796C8cd49A5450458B2,0xF70296e30bb225894e4325F10BEe23B5f0FBb702,0x1aD64C40afCA9A175fb21264ff557B17d0692328,0x1256B05A6b1cc6f17838BeEAb70609821439Dbca,0xec67BC05188770E7F48c9f05d4617e6340cBFb5d,0x41D49d162ac6eAB80Cf4F6eF514db17B8Df4b43D,0xA4c7A05bE6d9922b7090222E670376412837C35B,0x50c400Ff10af613a45f4D9011b5D7623B5c04E1A,0xB1876C5A4255b0D91a5BAD25F4943E0A43D502ea,0x5afABc7f77779eF211361EE145a6d48768FF4a22,0xd1d1A6e83ef917416D90C64a0a4b764Dc4ec82f9,0xecfcd51d41115b57300f0edd3360360b7e82580a,0xe26b98d784bf1cda10ddc53ada6f1b4e345cb2b4,0x840248F295E540B6164D2D56C8327e675f5Af6aF,0xAA6552D197FDF12D2849506d397f65ff6fEb0b6A,0x8D295caB9C3E676fB503a9ae5B1919859F629ac0,0x4CAe34c86E614976C4E99Bdeb01D4CF0ae9ED3ED,0x5b2af8ebc9a2abc704bfdcdf7377c63eb82683c9,0xA7126a9B02A0abff2f91c455a0955B0b4FB39a00,0xDeaB301Fd3F621c9bCd0727B5FEdF1BfA9dB69e2true \
   -v

 3. registerByList
 node scripts/sendTX.js \
   --function-name registerByList \
   --contract-address 0x636b31b524143cc6abe6170864131c0ab84cde35 \
   --provider-url http://localhost:8545 \
   --gas-limit 4300000 \
   --gas-price 1e9 \
   --parameters 0xEE18A02aDbD1781D840cd62D11f70482e852E33b,0x0D1c87a87eD9503D5139D6ed29530865B8a938bA,0x9364445F97ea5aC67E2F8BF2b2c93D2d2dB07d78,0x9AeD510c5cBf170EC2e1448B36fBC5Cb8f609a78,0x2876A91373e1Dd38b0C507884Fd069b1C436196D,0x2470C2D7A549d872f4D2b796C8cd49A5450458B2,0xF70296e30bb225894e4325F10BEe23B5f0FBb702,0x1aD64C40afCA9A175fb21264ff557B17d0692328,0x1256B05A6b1cc6f17838BeEAb70609821439Dbca,0xec67BC05188770E7F48c9f05d4617e6340cBFb5d,0x41D49d162ac6eAB80Cf4F6eF514db17B8Df4b43D,0xA4c7A05bE6d9922b7090222E670376412837C35B,0x50c400Ff10af613a45f4D9011b5D7623B5c04E1A,0xB1876C5A4255b0D91a5BAD25F4943E0A43D502ea,0x5afABc7f77779eF211361EE145a6d48768FF4a22,0xd1d1A6e83ef917416D90C64a0a4b764Dc4ec82f9,0xecfcd51d41115b57300f0edd3360360b7e82580a,0xe26b98d784bf1cda10ddc53ada6f1b4e345cb2b4,0x840248F295E540B6164D2D56C8327e675f5Af6aF,0xAA6552D197FDF12D2849506d397f65ff6fEb0b6A,0x8D295caB9C3E676fB503a9ae5B1919859F629ac0,0x4CAe34c86E614976C4E99Bdeb01D4CF0ae9ED3ED,0x5b2af8ebc9a2abc704bfdcdf7377c63eb82683c9,0xA7126a9B02A0abff2f91c455a0955B0b4FB39a00,0xDeaB301Fd3F621c9bCd0727B5FEdF1BfA9dB69e2 \
   -v
 */

const promisify = require("util").promisify;
const Web3 = require("web3");
const { sprintf } = require("sprintf-js");
const program = require("commander");
const HDWalletProvider = require("truffle-hdwallet-provider");
const { loadTruffleContract } = require("../lib/utils");

// network parameters
const defaultParameters = [];
const defaultProviderUrl = "http://localhost:8545";
const defaultWeiAmount = 0;
const defaultGasLimit = 4500000;
const defaultGasPrice = 20e9;
const defaultNonce = null;
const infuraMainnetUrl = "https://mainnet.infura.io";
const infuraRopstenUrl = "https://ropsten.infura.io";

// contract parameters
const KYC_CONTRACT_NAME = "KYC";

const kycFunctions = [ "register", "registerByList", "isRegistered" ];
const sendEther = [ "sendEther" ];

program
  .option("-f, --function-name [value]", "required. function to call")
  .option("-c, --contract-address [value]", "required. address of deployed contract")
  .option("-i, --network-id [value]", "required for infura. ethereum network id. 1 for mainsale, 3 for ropsten.")
  .option("-p, --parameters [value]>", `arguments for function split by comma. default ${ defaultParameters }`, parseParams)
  .option("-I, --infura", "whether use infura network. this option override provider url. default false")
  .option("-A, --infura-access-token [accessToken]", "access token for infura node. default emptyString")
  .option("-l, --provider-url [url]", `web3 provider url. default ${ defaultProviderUrl }`)
  .option("-w, --wei-amount [value]", `ether to transfer in wei. default ${ defaultWeiAmount }`)
  .option("-L, --gas-limit [value]", `gas limit for transaction. default ${ defaultGasLimit }`)
  .option("-P, --gas-price [value]", `gas price for transaction. default ${ defaultGasPrice }`)
  .option("-N, --nonce [value]", `nonce for transaction. default ${ defaultNonce }`)
  .option("-v, --verbose", "show debug logging")
  .parse(process.argv);

require("dotenv").config();

async function main() {
  const {
    functionName,
    contractAddress,
    networkId = null,
    infura = false,
    infuraAccessToken = "",
    gasLimit = defaultGasLimit,
    gasPrice = defaultGasPrice,
    nonce = defaultNonce,
    weiAmount = defaultWeiAmount,
    parameters,
    verbose = false,
  } = program;

  if (!functionName) throw new Error("Function name must be specified.");
  if (infura && !networkId) throw new Error("Network identifier must be specified to use infura.");

  const providerUrl = infura ? getInfuraProviderUrl(networkId, infuraAccessToken) : (program.providerUrl || defaultProviderUrl);

  const logger = Logger(verbose);
  const { mnemonic, contractName } = getMnemonic(functionName);
  const { web3, from } = loadWeb3FromMnemonic(providerUrl, mnemonic);

  logger("network id", networkId);
  logger("provider url", providerUrl);
  logger("from", from);
  logger("contract address", contractAddress);
  logger("contract name", contractName);
  logger("function name", functionName);
  logger("parameters", parameters.join(", "));
  logger("wei amount", weiAmount);
  logger("gas limit", gasLimit);
  logger("gas price", gasPrice);
  logger("nonce", nonce);

  // call contract function or send ether
  if (contractName) {
    if (!contractAddress) throw new Error("Contract address must be specified.");

    const contract = await loadContract(web3, contractName, contractAddress);

    const txObject = {
      from,
      value: weiAmount,
      gas: gasLimit,
      gasPrice,
    };

    if (nonce) {
      txObject.nonce = nonce;
    }

    return contract[ functionName ](...[ parameters,
      txObject ]).then(JSON.stringify)
      .then(console.log)
      .catch(console.error);
  }
  const sendTransaction = promisify(web3.eth.sendTransaction);
  const entireBalance = parameters.length === 2 && parameters[ 1 ] === "true";
  const value = entireBalance ? (await web3.eth.getBalance(from)).sub(21000) : weiAmount;

  const txObject = {
    from,
    to: parameters[ 0 ],
    value,
    gas: 21000,
    gasPrice,
  };

  if (nonce) {
    txObject.nonce = nonce;
  }

  return sendTransaction(txObject).then(JSON.stringify)
    .then(console.log)
    .catch(console.error);
}

main()
  .catch(console.error);

function web3AsynWrapper(web3Fun) {
  return function (arg) {
    return new Promise((resolve, reject) => {
      web3Fun(arg, (e, data) => (e ? reject(e) : resolve(data)));
    });
  };
}

function parseParams(args = "") {
  if (!args) return defaultParameters;
  return args.trim().split(",")
    .map(_ => _.trim())
    .map(v => (v === "true" ? true : v === "false" ? false : v)); // parse boolean value
}

function Logger(verbose) {
  const _2Format = "%20s\t%s";

  function log2(...args) {
    if (verbose) console.log(sprintf(_2Format, ...args));
  }

  return function (...args) {
    if (args.length === 2) return log2(...args);
  };
}

function getMnemonic(functionName) {
  if (kycFunctions.includes(functionName)) {
    return {
      mnemonic: process.env.MNEMONIC,
      contractName: KYC_CONTRACT_NAME,
    };
  } else if (sendEther.includes(functionName)) {
    return {
      mnemonic: process.env.MNEMONIC,
    };
  }
  throw new Error(`Couldn't specify mnemonic type for function ${ functionName }`);
}

function getInfuraProviderUrl(networkId, infuraAccessToken) {
  const baseUrl = networkId === "1" ? infuraMainnetUrl : networkId === "3" ? infuraRopstenUrl : "";

  if (!baseUrl) throw new Error(`Couldn't specify network id ${ networkId }`);

  return infuraAccessToken ? `${ baseUrl }/${ infuraAccessToken }` : baseUrl;
}

function loadContract(web3, contractName, contractAddress) {
  if (contractName === KYC_CONTRACT_NAME) {
    return loadKYC(web3.currentProvider, contractAddress);
  }

  throw new Error(`Unspecified contract name ${ contractName }`);
}

function loadKYC(provider, address) {
  return loadTruffleContract(require("../build/contracts/KYC.json"), provider, address);
}

function loadWeb3FromMnemonic(providerUrl, mnemonic) {
  const web3 = new Web3();
  const provider = new HDWalletProvider(mnemonic, providerUrl, 0, 50);
  web3.setProvider(provider);

  const from = provider.addresses[ 0 ];
  return { web3, from };
}
