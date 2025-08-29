// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AshCoin is ERC20, Ownable {
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    
    string public constant NAME = "AshCoin";
    string public constant SYMBOL = "AC";

    constructor(address initialOwner)
        ERC20(NAME, SYMBOL)
        Ownable(initialOwner)
    {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
        emit Burn(from, amount);
    }
}