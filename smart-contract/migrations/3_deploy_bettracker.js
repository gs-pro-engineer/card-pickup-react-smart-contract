const BetTracker = artifacts.require("BetTracker");

module.exports = function (deployer) {
  deployer.deploy(BetTracker);
};
