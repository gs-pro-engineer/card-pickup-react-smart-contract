// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./v0.8/VRFConsumerBase.sol";
import "./SafeMath.sol";
import "./IERC20.sol";
import "./Context.sol";
import "./Ownable.sol";

contract BetTracker is VRFConsumerBase, Context, Ownable {
    using SafeMath for uint256;

    address public immutable deadAddress = 0x000000000000000000000000000000000000dEaD;

    // Please confirm these addresses, and keyHash & fee in constructor
    address private constant VRFCoordinator = address(0xa555fC018435bef5A13C6c6870a9d4C11DEC329C);
    address private constant LinkToken = address(0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06);
    bytes32 internal keyHash;
    uint256 internal fee;

    uint256 public constant SPADEQ = 11;
    uint256 public maxBets = 100;

    IERC20 public token;
    uint8 public decimalsOfToken;
    address internal developer;

    bool public isStarted = false;
    bool internal pending = false;

    uint256 public betAmount = 10000;
    uint256 public rejectAmount = 5000;

    uint256 public burnPercentage = 5;
    uint256 public developerBonusPercentage = 5;

    uint256 public totalBets = 0;
    uint256 internal totalWins = 0;
    uint256 public totalRejects = 0;
    uint256 public roundNo = 0;

    uint256 internal cardsSrc = 0;

    // address vs rejected number
    mapping (address => uint256) internal rejects;
    address[] internal rejectedUsers;

    mapping (address => uint256) internal bets;
    mapping (address => uint256) internal lastCards;
    address[] internal bettedUsers;

    // address vs spadeQ selected count
    mapping (address => uint256) internal winners;
    address[] internal winnedUsers;

    uint256[] public wHistory;
    uint256[] public rHistory;

    modifier onlyStopped() {
        require(isStarted == false, "It can be called after stopped current round!");
        _;
    }

    modifier onlyStarted() {
        require(isStarted == true, "It is not started yet!");
        _;
    }

    modifier onlyIdle() {
        require(pending == false, "Not finished the previous request!");
        _;
    }

    event Started(uint256 indexed round, uint256 indexed betsLimit);

    event Stopped(uint256 indexed round);

    event Finished(uint256 indexed round, uint256 indexed winners, uint256 indexed rejectors);

    constructor() VRFConsumerBase(VRFCoordinator, LinkToken) public {
        // Please confirm keyHash & fee, and addresses above
        keyHash = 0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186;
        fee = 0.1 * 10 ** 18; // 0.1 LINK (Varies by network)
    }

    function setToken(address _token, uint8 _decimals) external onlyOwner() onlyStopped() {
        token = IERC20(_token);
        decimalsOfToken = _decimals;
    }

    function setMaxBets(uint256 _count) external onlyOwner() onlyStopped() {
        require(_count > 0, "It should be greater than 0!");
        maxBets = _count;
    }

    function setBetAmount(uint256 _amount) external onlyOwner() onlyStopped() {
        betAmount = _amount;
    }

    function setRejectAmount(uint256 _amount) external onlyOwner() onlyStopped() {
        rejectAmount = _amount;
    }

    function setBurnPercentage(uint256 _value) external onlyOwner() onlyStopped() {
        burnPercentage = _value;
    }

    function setDeveloperBonusPercentage(uint256 _value) external onlyOwner() onlyStopped() {
        developerBonusPercentage = _value;
    }

    function setDeveloper(address _developer) external onlyOwner() onlyStopped() {
        developer = _developer;
    }

    // Request randomness
    function seedRandomCards() internal returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK - fill contract with faucet");
        pending = true;
        return requestRandomness(keyHash, fee);
    }

    // Callback used by VRF Coordinator
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        // shuffle cards based on random number
        cardsSrc = uint256(keccak256(abi.encode(randomness, block.number)));
        pending = false;
    }

    /**
        It should reset all required status.
     */
    function startBet() public onlyOwner() onlyStopped() {
        // clear bets / win / rejects status
        for (uint256 i = 0; i < bettedUsers.length; i++) {
            bets[bettedUsers[i]] = 0;
        }
        for (uint256 i = 0; i < bettedUsers.length; i++) {
            lastCards[bettedUsers[i]] = 0;
        }
        delete bettedUsers;

        for (uint256 i = 0; i < rejectedUsers.length; i++) {
            rejects[rejectedUsers[i]] = 0;
        }
        delete rejectedUsers;

        for (uint256 i = 0; i < winnedUsers.length; i++) {
            winners[winnedUsers[i]] = 0;
        }
        delete winnedUsers;

        totalBets = 0;
        totalWins = 0;
        totalRejects = 0;
        roundNo ++;

        seedRandomCards();

        isStarted = true;

        emit Started(roundNo, maxBets);
    }

    /**
        While stopping bet, it should refund all current bet/reject amount.
     */
    function stopBet() public onlyOwner() {
        isStarted = false;

        refundAllBets();
        refundAllRejects();

        emit Stopped(roundNo);
    }

    function refundAllBets() internal {
        for (uint256 i = 0; i < bettedUsers.length; i++) {
            uint256 betCount = bets[bettedUsers[i]];
            bets[bettedUsers[i]] = 0;
            token.transfer(bettedUsers[i], betCount * betAmount * (10**decimalsOfToken));
        }
    }

    function refundAllRejects() internal {
        for (uint256 i = 0; i < rejectedUsers.length; i++) {
            uint256 rejectCount = rejects[rejectedUsers[i]];
            rejects[rejectedUsers[i]] = 0;
            token.transfer(rejectedUsers[i], rejectCount * rejectAmount * (10**decimalsOfToken));
        }
    }

    function lastCard() external view returns (uint256) {
        return lastCards[_msgSender()];
    }

    function numberOfBets() external view returns (uint256) {
        return bets[_msgSender()];
    }

    function numberOfRejects() external view returns (uint256) {
        return rejects[_msgSender()];
    }

    function winned() external view returns (uint256) {
        return winners[_msgSender()];
    }

    /**
        Transfer token(betAmount) into this contract address.
        And get one random card, and if it is spade Q, then updates winners
        And check if it is final, then perform final logic.
        calculate prize amount, and distribute
     */
    function bet() public onlyIdle() onlyStarted() {
        require(token.balanceOf(_msgSender()) >= betAmount * (10**decimalsOfToken), "Not enough balance!");
        require(token.allowance(_msgSender(), address(this)) >= betAmount * (10**decimalsOfToken), "Not allowed balance!");

        address _better = _msgSender();
        token.transferFrom(_better, address(this), betAmount * (10**decimalsOfToken));

        totalBets ++;
        if (isExistInAddresses(bettedUsers, _better)) {
            bets[_better] ++;
        } else {
            bettedUsers.push(_better);
            bets[_better] = 1;
        }

        uint256 selectedCard = (cardsSrc & 0xFF).mod(54) + 1;
        lastCards[_better] = selectedCard;
        if (selectedCard == SPADEQ) {
            totalWins ++;
            if (isExistInAddresses(winnedUsers, _better)) {
                winners[_better] ++;
            } else {
                winnedUsers.push(_better);
                winners[_better] = 1;
            }
        }

        cardsSrc >>= 8;
        if (cardsSrc == 0) {
            // generate random numbers again for next incoming betters
            seedRandomCards();
        }

        if (totalBets >= maxBets) {
            // game over
            isStarted = false;

            if (totalWins > 0) {
                distributeRewardsToBetters();
            } else {
                distributeRewardsToRejecters();
            }

            emit Finished(roundNo, totalWins, totalRejects);
        }
    }

    function distributeCommonRewards() internal returns (uint256) {
        uint256 unitReturn = token.balanceOf(address(this)).div(100);
        // burn
        token.transfer(deadAddress, unitReturn.mul(burnPercentage));
        // send to developer
        token.transfer(deadAddress, unitReturn.mul(developerBonusPercentage));
        uint256 totalRewards = unitReturn.mul(100 - burnPercentage - developerBonusPercentage);

        return totalRewards;
    }

    function distributeRewardsToBetters() internal {
        uint256 totalRewards = distributeCommonRewards();
        uint256 unitRewards = totalRewards.div(totalWins);

        for (uint256 i = 0; i < winnedUsers.length; i++) {
            token.transfer(
                winnedUsers[i],
                unitRewards * winners[winnedUsers[i]]
            );
        }

        wHistory.push(totalWins);
    }

    function distributeRewardsToRejecters() internal {
        uint256 totalRewards = distributeCommonRewards();
        uint256 unitRewards = totalRewards.div(totalRejects);

        for (uint256 i = 0; i < rejectedUsers.length; i++) {
            token.transfer(
                rejectedUsers[i],
                unitRewards * rejects[rejectedUsers[i]]
            );
        }

        rHistory.push(totalRejects);
    }

    /**
        Transfer token(rejectAmount) into this contract address.
        And updates rejects.
     */
    function reject() public onlyStarted() {
        require(token.balanceOf(_msgSender()) >= rejectAmount * (10**decimalsOfToken), "Not enough balance!");
        require(token.allowance(_msgSender(), address(this)) >= rejectAmount * (10**decimalsOfToken), "Not allowed balance!");

        address _rejecter = _msgSender();
        token.transferFrom(_rejecter, address(this), rejectAmount * (10**decimalsOfToken));

        totalRejects ++;
        if (isExistInAddresses(rejectedUsers, _rejecter)) {
            rejects[_rejecter] ++;
        } else {
            rejectedUsers.push(_rejecter);
            rejects[_rejecter] = 1;
        }
    }

    function isExistInAddresses(address[] memory _addresses, address target) pure internal returns (bool) {
        for (uint256 i = 0; i < _addresses.length; i++) {
            if (_addresses[i] == target) {
                return true;
            }
        }
        return false;
    }
}