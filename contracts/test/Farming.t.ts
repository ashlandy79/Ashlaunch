import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("Farming", function () {
  let ashCoin: any;
  let farming: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署 AshCoin 合约
    const AshCoin = await ethers.getContractFactory("AshCoin");
    ashCoin = await AshCoin.deploy(owner.address);
    await ashCoin.waitForDeployment();

    // 部署 Farming 合约
    const rewardRatePerSecond = ethers.parseEther("0.000001"); // 每秒每个质押代币可获得 0.000001 奖励
    const Farming = await ethers.getContractFactory("Farming");
    farming = await Farming.deploy(
      await ashCoin.getAddress(),  // 质押代币地址
      await ashCoin.getAddress(),  // 奖励代币地址
      rewardRatePerSecond,         // 奖励率
      owner.address                // 合约所有者
    );
    await farming.waitForDeployment();

    // 为用户铸造一些代币
    const initialAmount = ethers.parseEther("1000");
    await ashCoin.mint(user1.address, initialAmount);
    await ashCoin.mint(user2.address, initialAmount);
    
    // 为farming合约铸造奖励代币
    const rewardAmount = ethers.parseEther("10000");
    await ashCoin.mint(owner.address, rewardAmount);
    await ashCoin.transfer(await farming.getAddress(), rewardAmount);
  });

  describe("Deployment", function () {
    it("应该设置正确的参数", async function () {
      expect(await farming.stakingToken()).to.equal(await ashCoin.getAddress());
      expect(await farming.rewardToken()).to.equal(await ashCoin.getAddress());
      expect(await farming.rewardRatePerSecond()).to.equal(ethers.parseEther("0.000001"));
      expect(await farming.owner()).to.equal(owner.address);
    });

    it("应该在使用零地址时失败", async function () {
      const Farming = await ethers.getContractFactory("Farming");
      const rewardRatePerSecond = ethers.parseEther("0.000001");
      
      await expect(
        Farming.deploy(
          ethers.ZeroAddress,
          await ashCoin.getAddress(),
          rewardRatePerSecond,
          owner.address
        )
      ).to.be.revertedWithCustomError(farming, "ZeroAddress");
      
      await expect(
        Farming.deploy(
          await ashCoin.getAddress(),
          ethers.ZeroAddress,
          rewardRatePerSecond,
          owner.address
        )
      ).to.be.revertedWithCustomError(farming, "ZeroAddress");
    });
  });

  describe("Staking", function () {
    it("用户应该能够质押代币", async function () {
      const stakeAmount = ethers.parseEther("100");
      
      // 用户授权并质押
      await ashCoin.connect(user1).approve(await farming.getAddress(), stakeAmount);
      await expect(farming.connect(user1).stake(stakeAmount))
        .to.emit(farming, "Staked")
        .withArgs(user1.address, stakeAmount);
      
      // 检查质押状态
      const userInfo = await farming.userInfo(user1.address);
      expect(userInfo.stakedAmount).to.equal(stakeAmount);
      expect(userInfo.lastUpdateTime).to.be.above(0);
      expect(await farming.totalStaked()).to.equal(stakeAmount);
    });

    it("使用零数量质押应该失败", async function () {
      await expect(farming.connect(user1).stake(0))
        .to.be.revertedWithCustomError(farming, "InvalidAmount");
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      // 先质押一些代币
      const stakeAmount = ethers.parseEther("100");
      await ashCoin.connect(user1).approve(await farming.getAddress(), stakeAmount);
      await farming.connect(user1).stake(stakeAmount);
    });

    it("用户应该能够解押代币", async function () {
      const unstakeAmount = ethers.parseEther("50");
      
      await expect(farming.connect(user1).unstake(unstakeAmount))
        .to.emit(farming, "Unstaked")
        .withArgs(user1.address, unstakeAmount);
      
      // 检查解押状态
      const userInfo = await farming.userInfo(user1.address);
      expect(userInfo.stakedAmount).to.equal(ethers.parseEther("50"));
      expect(await farming.totalStaked()).to.equal(ethers.parseEther("50"));
    });

    it("使用零数量解押应该失败", async function () {
      await expect(farming.connect(user1).unstake(0))
        .to.be.revertedWithCustomError(farming, "InvalidAmount");
    });

    it("解押超过质押数量应该失败", async function () {
      const unstakeAmount = ethers.parseEther("150");
      await expect(farming.connect(user1).unstake(unstakeAmount))
        .to.be.revertedWithCustomError(farming, "InsufficientStakedAmount");
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      // 用户质押代币
      const stakeAmount = ethers.parseEther("100");
      await ashCoin.connect(user1).approve(await farming.getAddress(), stakeAmount);
      await farming.connect(user1).stake(stakeAmount);
    });

    it("应该能够计算待领取奖励", async function () {
      // 增加时间以产生奖励
      await ethers.provider.send("evm_increaseTime", [3600]); // 增加1小时
      await ethers.provider.send("evm_mine", []);
      
      // 计算预期奖励: 100 * 3600 * 0.000001 = 0.36
      const expectedReward = ethers.parseEther("0.36");
      const pendingReward = await farming.pendingReward(user1.address);
      
      // 允许小的误差范围
      expect(pendingReward).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
    });

    it("用户应该能够领取奖励", async function () {
      // 增加时间以产生奖励
      await ethers.provider.send("evm_increaseTime", [3600]); // 增加1小时
      await ethers.provider.send("evm_mine", []);
      
      // 记录领取前的余额
      const balanceBefore = await ashCoin.balanceOf(user1.address);
      
      // 领取奖励
      await expect(farming.connect(user1).claimReward())
        .to.emit(farming, "RewardClaimed");
      
      // 检查余额增加
      const balanceAfter = await ashCoin.balanceOf(user1.address);
      expect(balanceAfter).to.be.above(balanceBefore);
    });

    it("没有奖励时领取应该失败", async function () {
      // 刚质押完立即领取应该失败
      await expect(farming.connect(user1).claimReward())
        .to.be.revertedWithCustomError(farming, "NoRewardToClaim");
    });
  });

  describe("Integration", function () {
    it("质押、等待、领取、解押流程应该正常工作", async function () {
      const stakeAmount = ethers.parseEther("100");
      
      // 1. 质押代币
      await ashCoin.connect(user1).approve(await farming.getAddress(), stakeAmount);
      await expect(farming.connect(user1).stake(stakeAmount))
        .to.emit(farming, "Staked")
        .withArgs(user1.address, stakeAmount);
      
      // 2. 等待一段时间
      await ethers.provider.send("evm_increaseTime", [3600]); // 增加1小时
      await ethers.provider.send("evm_mine", []);
      
      // 3. 领取奖励
      const balanceBefore = await ashCoin.balanceOf(user1.address);
      await expect(farming.connect(user1).claimReward())
        .to.emit(farming, "RewardClaimed");
      const balanceAfter = await ashCoin.balanceOf(user1.address);
      expect(balanceAfter).to.be.above(balanceBefore);
      
      // 4. 解押代币
      await expect(farming.connect(user1).unstake(stakeAmount))
        .to.emit(farming, "Unstaked")
        .withArgs(user1.address, stakeAmount);
      
      // 验证最终状态
      const userInfo = await farming.userInfo(user1.address);
      expect(userInfo.stakedAmount).to.equal(0);
      expect(await farming.totalStaked()).to.equal(0);
    });
  });
});