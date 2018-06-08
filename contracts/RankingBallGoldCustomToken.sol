pragma solidity ^0.4.24;

import "pos-controller/contracts/POSMiniMeToken.sol";
import "./RankingBallGoldToken.sol";
import "./_import.sol";

contract RankingBallGoldCustomToken is POSMiniMeToken, RankingBallGoldToken {
  function RankingBallGoldCustomToken(address _tokenFactory)
    RankingBallGoldToken(_tokenFactory)
    public
  {}
}
