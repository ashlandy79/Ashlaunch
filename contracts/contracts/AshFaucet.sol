// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AshFaucet is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public immutable airdropAmount;
    uint256 public claimPeriod;
    
    // 记录用户下次可申领时间
    mapping(address => uint256) public nextClaimTime;
    
    event AirdropClaimed(address indexed user, uint256 amount);
    event ClaimPeriodUpdated(uint256 newPeriod);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    event TokensDeposited(address indexed depositor, uint256 amount);

    error ClaimTooEarly(uint256 remainingTime);
    error ZeroAddress();
    error InvalidClaimPeriod();
    error InsufficientBalance();

    /**
     * @dev 初始化空投合约
     * @param _token AshCoin代币地址
     * @param _airdropAmount 每次空投数量(带18位小数)
     * @param _claimPeriod 申领间隔(秒)
     * @param initialOwner 合约所有者
     */
    constructor(
        address _token,
        uint256 _airdropAmount,
        uint256 _claimPeriod,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_claimPeriod == 0) revert InvalidClaimPeriod();

        token = IERC20(_token);
        airdropAmount = _airdropAmount;
        claimPeriod = _claimPeriod;
    }

    /**
     * @dev 申领空投代币
     */
    function claim() external {
        address user = msg.sender;
        
        // 检查是否可以申领
        if (block.timestamp < nextClaimTime[user]) {
            revert ClaimTooEarly(nextClaimTime[user] - block.timestamp);
        }
        
        // 检查合约余额是否足够
        if (token.balanceOf(address(this)) < airdropAmount) {
            revert InsufficientBalance();
        }
        
        // 更新下次申领时间
        nextClaimTime[user] = block.timestamp + claimPeriod;
        
        // 发送代币
        token.safeTransfer(user, airdropAmount);
        
        emit AirdropClaimed(user, airdropAmount);
    }

    /**
     * @dev 合约拥有者存入代币
     * @param amount 存入数量
     */
    function depositTokens(uint256 amount) external onlyOwner {
        token.safeTransferFrom(owner(), address(this), amount);
        emit TokensDeposited(owner(), amount);
    }

    /**
     * @dev 更新申领间隔
     * @param _newPeriod 新的申领间隔(秒)
     */
    function updateClaimPeriod(uint256 _newPeriod) external onlyOwner {
        if (_newPeriod == 0) revert InvalidClaimPeriod();
        claimPeriod = _newPeriod;
        emit ClaimPeriodUpdated(_newPeriod);
    }

    /**
     * @dev 提取合约中的代币
     * @param amount 提取数量
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
        emit TokensWithdrawn(owner(), amount);
    }

    /**
     * @dev 获取用户剩余等待时间
     * @param user 用户地址
     * @return 剩余等待时间(秒)，0表示可以立即申领
     */
    function getRemainingTime(address user) external view returns (uint256) {
        if (block.timestamp >= nextClaimTime[user]) {
            return 0;
        }
        return nextClaimTime[user] - block.timestamp;
    }

    /**
     * @dev 获取合约代币余额
     * @return 合约中代币的余额
     */
    function getContractBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev 获取用户下次申领时间
     * @param user 用户地址
     * @return 用户下次可申领时间的时间戳
     */
    function getNextClaimTime(address user) external view returns (uint256) {
        return nextClaimTime[user];
    }

    /**
     * @dev 检查用户是否可以申领
     * @param user 用户地址
     * @return 是否可以申领
     */
    function canClaim(address user) external view returns (bool) {
        return block.timestamp >= nextClaimTime[user] && 
               token.balanceOf(address(this)) >= airdropAmount;
    }
}