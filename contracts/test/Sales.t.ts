import "@nomicfoundation/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Sales", function () {
  let ashCoin: any;
  let sales: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let addrs: any;

  beforeEach(async function () {
    [owner, user1, user2, ...addrs] = await ethers.getSigners();

    // 部署 AshCoin 合约
    const AshCoin = await ethers.getContractFactory("AshCoin");
    ashCoin = await AshCoin.deploy(owner.address);
    await ashCoin.waitForDeployment();

    // 部署 Sales 合约
    const Sales = await ethers.getContractFactory("Sales");
    const price = ethers.parseEther("0.1"); // 1 TOKEN = 0.1 USDT
    const purchaseLimit = ethers.parseEther("1000"); // 每个地址最大购买1000个代币
    const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始
    const endTime = startTime + 30 * 24 * 60 * 60; // 30天后结束
    const requiredTokenBalance = ethers.parseEther("100"); // 要求持有100个代币
    
    sales = await Sales.deploy(
      await ashCoin.getAddress(),  // 销售代币地址
      await ashCoin.getAddress(),  // 支付代币地址 (使用AshCoin作为USDT替代)
      price,                       // 固定价格
      purchaseLimit,               // 购买限额
      startTime,                   // 开始时间
      endTime,                     // 结束时间
      requiredTokenBalance,        // 要求的最低代币余额
      owner.address                // 合约所有者
    );
    await sales.waitForDeployment();

    // 为用户铸造一些代币用于购买
    const initialAmount = ethers.parseEther("10000");
    await ashCoin.mint(user1.address, initialAmount);
    await ashCoin.mint(user2.address, initialAmount);
    
    // 向Sales合约转入销售代币
    const salesAmount = ethers.parseEther("50000");
    await ashCoin.mint(owner.address, salesAmount);
    await ashCoin.transfer(await sales.getAddress(), salesAmount);
  });

  describe("Deployment", function () {
    it("应该正确设置合约参数", async function () {
      expect(await sales.saleToken()).to.equal(await ashCoin.getAddress());
      expect(await sales.paymentToken()).to.equal(await ashCoin.getAddress());
      expect(await sales.price()).to.equal(ethers.parseEther("0.1"));
      expect(await sales.purchaseLimit()).to.equal(ethers.parseEther("1000"));
      expect(await sales.requiredTokenBalance()).to.equal(ethers.parseEther("100"));
      expect(await sales.owner()).to.equal(owner.address);
    });
  });

  describe("Whitelist", function () {
    it("用户应该能够自己注册白名单", async function () {
      // 确保用户有足够的代币余额
      const requiredBalance = await sales.requiredTokenBalance();
      expect(await ashCoin.balanceOf(user1.address)).to.be.gte(requiredBalance);

      // 用户注册白名单
      await expect(sales.connect(user1).registerForWhitelist())
        .to.emit(sales, "UserRegisteredForWhitelist")
        .withArgs(user1.address);

      expect(await sales.isWhitelisted(user1.address)).to.equal(true);
    });

    it("余额不足的用户不应该能够注册白名单", async function () {
      // 转移用户部分代币，使其余额低于要求
      const requiredBalance = await sales.requiredTokenBalance();
      const currentBalance = await ashCoin.balanceOf(user1.address);
      const transferAmount = currentBalance - (requiredBalance - 1n); // 使其余额略低于要求
      
      await ashCoin.connect(user1).transfer(owner.address, transferAmount);
      expect(await ashCoin.balanceOf(user1.address)).to.be.lt(requiredBalance);

      // 尝试注册白名单应该失败
      await expect(sales.connect(user1).registerForWhitelist())
        .to.be.revertedWithCustomError(sales, "InsufficientTokenBalance");
    });

    it("合约所有者应该能够添加白名单", async function () {
      await expect(sales.addToWhitelist([user1.address, user2.address]))
        .to.emit(sales, "WhitelistAdded")
        .withArgs([user1.address, user2.address]);

      expect(await sales.isWhitelisted(user1.address)).to.equal(true);
      expect(await sales.isWhitelisted(user2.address)).to.equal(true);
    });

    it("非所有者不应该能够添加白名单", async function () {
      await expect(sales.connect(user1).addToWhitelist([user2.address]))
        .to.be.revertedWithCustomError(sales, "OwnableUnauthorizedAccount");
    });

    it("合约所有者应该能够从白名单中移除用户", async function () {
      // 先添加到白名单
      await sales.addToWhitelist([user1.address]);
      expect(await sales.isWhitelisted(user1.address)).to.equal(true);

      // 移除白名单
      await expect(sales.removeFromWhitelist([user1.address]))
        .to.emit(sales, "WhitelistRemoved")
        .withArgs([user1.address]);

      expect(await sales.isWhitelisted(user1.address)).to.equal(false);
    });
  });

  describe("Purchase", function () {
    beforeEach(async function () {
      // 添加用户到白名单
      await sales.addToWhitelist([user1.address, user2.address]);
      
      // 调整时间为销售期间
      const startTime = await sales.startTime();
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 100]);
      await ethers.provider.send("evm_mine", []);
    });

    it("白名单用户应该能够购买代币", async function () {
      const purchaseAmount = ethers.parseEther("100"); // 购买100个代币
      const cost = ethers.parseEther("10"); // 100 * 0.1 = 10 USDT
      
      // 用户授权支付代币
      await ashCoin.connect(user1).approve(await sales.getAddress(), cost);
      
      // 购买代币
      await expect(sales.connect(user1).purchase(purchaseAmount))
        .to.emit(sales, "TokensPurchased")
        .withArgs(user1.address, purchaseAmount, cost);

      // 检查用户余额
      expect(await ashCoin.balanceOf(user1.address)).to.equal(ethers.parseEther("10000").sub(cost));
      expect(await ashCoin.balanceOf(await sales.getAddress())).to.equal(ethers.parseEther("50000").sub(purchaseAmount));
      
      // 检查用户购买记录
      expect(await sales.purchasedAmount(user1.address)).to.equal(purchaseAmount);
    });

    it("非白名单用户不应该能够购买代币", async function () {
      const purchaseAmount = ethers.parseEther("100");
      
      await expect(sales.connect(addrs[0]).purchase(purchaseAmount))
        .to.be.revertedWithCustomError(sales, "NotWhitelisted");
    });

    it("用户不应该能够购买超过限额的代币", async function () {
      const purchaseAmount = ethers.parseEther("1100"); // 超过1000的限额
      
      await ashCoin.connect(user1).approve(await sales.getAddress(), ethers.parseEther("110"));
      
      await expect(sales.connect(user1).purchase(purchaseAmount))
        .to.be.revertedWithCustomError(sales, "PurchaseLimitExceeded");
    });

    it("用户不应该在销售开始前购买", async function () {
      // 部署一个新的Sales合约，开始时间设置为未来
      const Sales = await ethers.getContractFactory("Sales");
      const price = ethers.parseEther("0.1");
      const purchaseLimit = ethers.parseEther("1000");
      const futureStartTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后开始
      const endTime = futureStartTime + 30 * 24 * 60 * 60;
      
      const futureSales = await Sales.deploy(
        await ashCoin.getAddress(),
        await ashCoin.getAddress(),
        price,
        purchaseLimit,
        futureStartTime,
        endTime,
        owner.address
      );
      await futureSales.waitForDeployment();
      
      // 添加用户到白名单
      await futureSales.addToWhitelist([user1.address]);
      
      // 尝试购买
      const purchaseAmount = ethers.parseEther("100");
      await ashCoin.connect(user1).approve(await futureSales.getAddress(), ethers.parseEther("10"));
      
      await expect(futureSales.connect(user1).purchase(purchaseAmount))
        .to.be.revertedWithCustomError(futureSales, "SaleNotStarted");
    });
  });

  describe("Management Functions", function () {
    it("合约所有者应该能够更新购买限额", async function () {
      const newLimit = ethers.parseEther("2000");
      
      await expect(sales.connect(owner).updatePurchaseLimit(newLimit))
        .to.emit(sales, "PurchaseLimitUpdated")
        .withArgs(newLimit);

      expect(await sales.purchaseLimit()).to.equal(newLimit);
    });

    it("非所有者不应该能够更新购买限额", async function () {
      const newLimit = ethers.parseEther("2000");
      
      await expect(sales.connect(user1).updatePurchaseLimit(newLimit))
        .to.be.revertedWithCustomError(sales, "OwnableUnauthorizedAccount");
    });

    it("合约所有者应该能够更新销售状态", async function () {
      // 激活销售
      await expect(sales.connect(owner).updateSaleStatus(true))
        .to.emit(sales, "SaleStatusUpdated")
        .withArgs(true);

      expect(await sales.isSaleActive()).to.equal(true);
      
      // 停止销售
      await expect(sales.connect(owner).updateSaleStatus(false))
        .to.emit(sales, "SaleStatusUpdated")
        .withArgs(false);

      expect(await sales.isSaleActive()).to.equal(false);
    });

    it("合约所有者应该能够更新要求的最低代币余额", async function () {
      const newBalance = ethers.parseEther("200");
      
      await expect(sales.connect(owner).updateRequiredTokenBalance(newBalance))
        .to.emit(sales, "RequiredTokenBalanceUpdated")
        .withArgs(newBalance);

      expect(await sales.requiredTokenBalance()).to.equal(newBalance);
    });

    it("合约所有者应该能够提取销售代币", async function () {
      const withdrawAmount = ethers.parseEther("1000");
      
      await expect(sales.connect(owner).withdrawTokens(withdrawAmount))
        .to.emit(sales, "TokensWithdrawn")
        .withArgs(owner.address, withdrawAmount);

      expect(await ashCoin.balanceOf(owner.address)).to.equal(withdrawAmount);
    });

    it("合约所有者应该能够提取支付代币", async function () {
      // 先进行一次购买，使支付代币进入合约
      await sales.addToWhitelist([user1.address]);
      
      const startTime = await sales.startTime();
      await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 100]);
      await ethers.provider.send("evm_mine", []);
      
      const purchaseAmount = ethers.parseEther("100");
      const cost = ethers.parseEther("10");
      
      await ashCoin.connect(user1).approve(await sales.getAddress(), cost);
      await sales.connect(user1).purchase(purchaseAmount);
      
      // 提取支付代币
      await expect(sales.connect(owner).withdrawPaymentTokens(cost))
        .to.emit(sales, "PaymentTokensWithdrawn")
        .withArgs(owner.address, cost);

      expect(await ashCoin.balanceOf(owner.address)).to.equal(cost);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // 添加用户到白名单
      await sales.addToWhitelist([user1.address]);
    });

    it("应该能够获取用户剩余购买额度", async function () {
      const remaining = await sales.getRemainingPurchaseAmount(user1.address);
      expect(remaining).to.equal(ethers.parseEther("1000")); // 初始限额1000
    });

    it("应该能够获取销售信息", async function () {
      const saleInfo = await sales.getSaleInfo();
      expect(saleInfo[0]).to.equal(ethers.parseEther("50000")); // 合约余额
      expect(saleInfo[3]).to.equal(true); // 销售激活状态
    });
  });
});