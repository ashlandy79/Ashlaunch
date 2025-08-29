// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Sales
 * @dev 固定价格白名单销售合约，允许白名单用户以固定价格购买代币
 */
contract Sales is Ownable {
    using SafeERC20 for IERC20;

    // 销售代币合约地址
    IERC20 public immutable saleToken;
    
    // 用于购买的代币合约地址 (例如 ETH 或稳定币)
    IERC20 public immutable paymentToken;
    
    // 固定价格 (每单位 saleToken 需要支付的 paymentToken 数量，带18位小数)
    uint256 public immutable price;
    
    // 每个地址的最大购买限额
    uint256 public purchaseLimit;
    
    // 白名单映射
    mapping(address => bool) public isWhitelisted;
    
    // 用户已购买数量映射
    mapping(address => uint256) public purchasedAmount;
    
    // 销售开始和结束时间
    uint256 public startTime;
    uint256 public endTime;
    
    // 销售状态
    bool public isSaleActive;
    
    // 要求用户持有的最低代币数量才能注册白名单
    uint256 public requiredTokenBalance;
    
    // 合约事件
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event WhitelistAdded(address[] users);
    event WhitelistRemoved(address[] users);
    event PurchaseLimitUpdated(uint256 newLimit);
    event SalePeriodUpdated(uint256 startTime, uint256 endTime);
    event SaleStatusUpdated(bool isActive);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    event PaymentTokensWithdrawn(address indexed owner, uint256 amount);
    event RequiredTokenBalanceUpdated(uint256 newBalance);
    event UserRegisteredForWhitelist(address user);

    // 自定义错误
    error ZeroAddress();
    error InvalidAmount();
    error SaleNotActive();
    error SaleNotStarted();
    error SaleEnded();
    error NotWhitelisted();
    error PurchaseLimitExceeded();
    error InsufficientBalance();
    error TransferFailed();
    error InsufficientTokenBalance();

    /**
     * @dev 初始化销售合约
     * @param _saleToken 销售的代币地址
     * @param _paymentToken 用于支付的代币地址
     * @param _price 固定价格 (每单位 saleToken 需要支付的 paymentToken 数量)
     * @param _purchaseLimit 每个地址的最大购买限额
     * @param _startTime 销售开始时间
     * @param _endTime 销售结束时间
     * @param _requiredTokenBalance 要求用户持有的最低代币数量才能注册白名单
     * @param initialOwner 合约所有者
     */
    constructor(
        address _saleToken,
        address _paymentToken,
        uint256 _price,
        uint256 _purchaseLimit,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _requiredTokenBalance,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_saleToken == address(0) || _paymentToken == address(0)) revert ZeroAddress();
        if (_price == 0) revert InvalidAmount();
        if (_startTime >= _endTime) revert InvalidAmount();
        
        saleToken = IERC20(_saleToken);
        paymentToken = IERC20(_paymentToken);
        price = _price;
        purchaseLimit = _purchaseLimit;
        startTime = _startTime;
        endTime = _endTime;
        requiredTokenBalance = _requiredTokenBalance;
        isSaleActive = true;
    }

    /**
     * @dev 购买代币
     * @param _amount 购买数量
     */
    function purchase(uint256 _amount) external {
        // 检查销售是否激活
        if (!isSaleActive) revert SaleNotActive();
        
        // 检查销售时间
        if (block.timestamp < startTime) revert SaleNotStarted();
        if (block.timestamp > endTime) revert SaleEnded();
        
        // 检查购买数量
        if (_amount == 0) revert InvalidAmount();
        
        // 检查是否在白名单中
        if (!isWhitelisted[msg.sender]) revert NotWhitelisted();
        
        // 检查购买限额
        if (purchasedAmount[msg.sender] + _amount > purchaseLimit) revert PurchaseLimitExceeded();
        
        // 计算所需支付金额
        uint256 cost = _amount * price / 1e18;
        
        // 检查合约中是否有足够的代币
        if (saleToken.balanceOf(address(this)) < _amount) revert InsufficientBalance();
        
        // 更新用户已购买数量
        purchasedAmount[msg.sender] += _amount;
        
        // 转移支付代币到合约
        paymentToken.safeTransferFrom(msg.sender, address(this), cost);
        
        // 转移销售代币给购买者
        saleToken.safeTransfer(msg.sender, _amount);
        
        emit TokensPurchased(msg.sender, _amount, cost);
    }

    /**
     * @dev 用户自己注册白名单
     */
    function registerForWhitelist() external {
        // 检查用户是否持有足够的代币
        if (paymentToken.balanceOf(msg.sender) < requiredTokenBalance) {
            revert InsufficientTokenBalance();
        }
        
        // 添加到白名单
        isWhitelisted[msg.sender] = true;
        emit UserRegisteredForWhitelist(msg.sender);
    }

    /**
     * @dev 添加白名单 (仅限合约所有者)
     * @param _users 用户地址数组
     */
    function addToWhitelist(address[] calldata _users) external onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            isWhitelisted[_users[i]] = true;
        }
        emit WhitelistAdded(_users);
    }

    /**
     * @dev 从白名单中移除 (仅限合约所有者)
     * @param _users 用户地址数组
     */
    function removeFromWhitelist(address[] calldata _users) external onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            isWhitelisted[_users[i]] = false;
        }
        emit WhitelistRemoved(_users);
    }

    /**
     * @dev 更新购买限额 (仅限合约所有者)
     * @param _newLimit 新的购买限额
     */
    function updatePurchaseLimit(uint256 _newLimit) external onlyOwner {
        purchaseLimit = _newLimit;
        emit PurchaseLimitUpdated(_newLimit);
    }

    /**
     * @dev 更新销售时间 (仅限合约所有者)
     * @param _startTime 新的开始时间
     * @param _endTime 新的结束时间
     */
    function updateSalePeriod(uint256 _startTime, uint256 _endTime) external onlyOwner {
        if (_startTime >= _endTime) revert InvalidAmount();
        startTime = _startTime;
        endTime = _endTime;
        emit SalePeriodUpdated(_startTime, _endTime);
    }

    /**
     * @dev 更新销售状态 (仅限合约所有者)
     * @param _isActive 是否激活销售
     */
    function updateSaleStatus(bool _isActive) external onlyOwner {
        isSaleActive = _isActive;
        emit SaleStatusUpdated(_isActive);
    }

    /**
     * @dev 更新要求的最低代币余额 (仅限合约所有者)
     * @param _newBalance 新的最低代币余额要求
     */
    function updateRequiredTokenBalance(uint256 _newBalance) external onlyOwner {
        requiredTokenBalance = _newBalance;
        emit RequiredTokenBalanceUpdated(_newBalance);
    }

    /**
     * @dev 提取销售代币 (仅限合约所有者)
     * @param _amount 提取数量
     */
    function withdrawTokens(uint256 _amount) external onlyOwner {
        saleToken.safeTransfer(owner(), _amount);
        emit TokensWithdrawn(owner(), _amount);
    }

    /**
     * @dev 提取支付代币 (仅限合约所有者)
     * @param _amount 提取数量
     */
    function withdrawPaymentTokens(uint256 _amount) external onlyOwner {
        paymentToken.safeTransfer(owner(), _amount);
        emit PaymentTokensWithdrawn(owner(), _amount);
    }

    /**
     * @dev 获取用户可购买余额
     * @param _user 用户地址
     * @return 用户还可以购买的数量
     */
    function getRemainingPurchaseAmount(address _user) external view returns (uint256) {
        if (!isWhitelisted[_user]) {
            return 0;
        }
        if (purchasedAmount[_user] >= purchaseLimit) {
            return 0;
        }
        return purchaseLimit - purchasedAmount[_user];
    }

    /**
     * @dev 获取销售信息
     * @return 合约中销售代币余额、开始时间、结束时间、是否激活
     */
    function getSaleInfo() external view returns (uint256, uint256, uint256, bool) {
        return (
            saleToken.balanceOf(address(this)),
            startTime,
            endTime,
            isSaleActive
        );
    }
}