// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

interface Token {
    function transferFrom(address, address, uint) external returns (bool);
    function transfer(address, uint) external returns (bool);
}
