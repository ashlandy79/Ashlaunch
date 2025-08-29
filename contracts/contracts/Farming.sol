// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Farming
 * @dev 合约允许用户质押代币并获得奖励
 * 用户可以质押指定的代币，然后根据质押时间和数量获得奖励代币
 */
contract Farming is Ownable {
    using SafeERC20 for IERC20;

    // 质押的代币合约地址
    IERC20 public immutable stakingToken;
    
    // 奖励的代币合约地址
    IERC20 public immutable rewardToken;
    
    // 每秒每个质押代币可获得的奖励 (以wei为单位)
    uint256 public immutable rewardRatePerSecond;
    
    // 总质押数量
    uint256 public totalStaked;
    
    // 用户信息结构
    struct UserInfo {
        uint256 stakedAmount;     // 用户质押数量
        uint256 rewardDebt;       // 用户已获得的奖励债务
        uint256 lastUpdateTime;   // 上次更新时间
    }
    
    // 用户地址到用户信息的映射
    mapping(address => UserInfo) public userInfo;
    
    // 合约事件
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRewardRate);

    // 自定义错误
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientStakedAmount();
    error InsufficientRewardBalance();
    error NoRewardToClaim();

    /**
     * @dev 初始化Farming合约
     * @param _stakingToken 质押代币地址
     * @param _rewardToken 奖励代币地址
     * @param _rewardRatePerSecond 每秒每个质押代币可获得的奖励
     * @param initialOwner 合约所有者
     */
    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRatePerSecond,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_stakingToken == address(0) || _rewardToken == address(0)) revert ZeroAddress();
        
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRatePerSecond = _rewardRatePerSecond;
    }

    /**
     * @dev 获取用户累积的奖励
     * @param _user 用户地址
     * @return 用户可领取的奖励数量
     */
    function pendingReward(address _user) public view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 stakedAmount = user.stakedAmount;
        
        if (stakedAmount == 0) {
            return 0;
        }
        
        // 计算从上次更新到现在的时间
        uint256 timePassed = block.timestamp - user.lastUpdateTime;
        
        // 计算应得奖励 = 质押数量 * 时间 * 奖励率
        // 使用较小的奖励率以避免奖励池快速耗尽
        uint256 reward = stakedAmount * timePassed * rewardRatePerSecond / 1e18;
        
        return reward;
    }

    /**
     * @dev 质押代币
     * @param _amount 质押数量
     */
    function stake(uint256 _amount) external {
        if (_amount == 0) revert InvalidAmount();
        
        UserInfo storage user = userInfo[msg.sender];
        
        // 如果用户已有质押，先领取奖励
        if (user.stakedAmount > 0) {
            uint256 pending = pendingReward(msg.sender);
            if (pending > 0) {
                _claimReward(msg.sender, pending);
            }
        }
        
        // 更新用户信息
        user.stakedAmount += _amount;
        user.lastUpdateTime = block.timestamp;
        totalStaked += _amount;
        
        // 转移质押代币到合约
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev 解押代币
     * @param _amount 解押数量
     */
    function unstake(uint256 _amount) external {
        if (_amount == 0) revert InvalidAmount();
        
        UserInfo storage user = userInfo[msg.sender];
        if (user.stakedAmount < _amount) revert InsufficientStakedAmount();
        
        // 先领取奖励
        uint256 pending = pendingReward(msg.sender);
        if (pending > 0) {
            _claimReward(msg.sender, pending);
        }
        
        // 更新用户信息
        user.stakedAmount -= _amount;
        user.lastUpdateTime = block.timestamp;
        totalStaked -= _amount;
        
        // 转移质押代币回用户
        stakingToken.safeTransfer(msg.sender, _amount);
        
        emit Unstaked(msg.sender, _amount);
    }

    /**
     * @dev 领取奖励
     */
    function claimReward() external {
        uint256 pending = pendingReward(msg.sender);
        if (pending == 0) revert NoRewardToClaim();
        
        _claimReward(msg.sender, pending);
    }
    
    /**
     * @dev 内部函数：发放奖励
     * @param _user 用户地址
     * @param _amount 奖励数量
     */
    function _claimReward(address _user, uint256 _amount) internal {
        if (rewardToken.balanceOf(address(this)) < _amount) revert InsufficientRewardBalance();
        
        // 更新用户信息
        userInfo[_user].lastUpdateTime = block.timestamp;
        
        // 转移奖励代币给用户
        rewardToken.safeTransfer(_user, _amount);
        
        emit RewardClaimed(_user, _amount);
    }
    
    /**
     * @dev 获取合约中奖励代币的余额
     * @return 奖励代币余额
     */
    function getRewardBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
}