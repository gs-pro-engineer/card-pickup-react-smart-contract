const SpadeQ = artifacts.require("SpadeQ");

module.exports = function (deployer) {
  deployer.deploy(SpadeQ, "0xA00dB5424da9ECFC26E0450200D42bab4652602d");
};
