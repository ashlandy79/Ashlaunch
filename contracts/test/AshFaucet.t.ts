import "@nomicfoundation/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";


describe("AshFaucet", function () {
  let AshCoin: any;
  let ashCoin: any;
  let AshFaucet: any;
  let ashFaucet: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addrs: any;

  beforeEach(async function () {
    // 获取合约工厂和账户
    AshCoin = await ethers.getContractFactory("AshCoin");
    AshFaucet = await ethers.getContractFactory("AshFaucet");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // 部署AshCoin合约
    ashCoin = await AshCoin.deploy(owner.address);
    await ashCoin.waitForDeployment();

    // 部署AshFaucet合约
    const airdropAmount = ethers.parseEther("100");
    const claimPeriod = 60; // 60秒申领间隔
    ashFaucet = await AshFaucet.deploy(
      await ashCoin.getAddress(),
      airdropAmount,
      claimPeriod,
      owner.address
    );
    await ashFaucet.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置合约参数", async function () {
      expect(await ashFaucet.token()).to.equal(await ashCoin.getAddress());
      expect(await ashFaucet.airdropAmount()).to.equal(ethers.parseEther("100"));
      expect(await ashFaucet.claimPeriod()).to.equal(60);
      expect(await ashFaucet.owner()).to.equal(owner.address);
    });
  });

  describe("存款功能", function () {
    beforeEach(async function () {
      // 先铸造一些代币给owner用于存款
      const mintAmount = ethers.parseEther("1000");
      await ashCoin.connect(owner).mint(owner.address, mintAmount);
    });

    it("合约拥有者应该能够存款", async function () {
      const depositAmount = ethers.parseEther("500");
      
      // 授权给faucet合约
      await ashCoin.connect(owner).approve(await ashFaucet.getAddress(), depositAmount);
      
      // 存款
      await expect(ashFaucet.connect(owner).depositTokens(depositAmount))
        .to.emit(ashFaucet, "TokensDeposited")
        .withArgs(owner.address, depositAmount);

      expect(await ashCoin.balanceOf(await ashFaucet.getAddress())).to.equal(depositAmount);
    });

    it("非拥有者不应该能够存款", async function () {
      const depositAmount = ethers.parseEther("500");
      
      // 授权给faucet合约
      await ashCoin.connect(owner).approve(await ashFaucet.getAddress(), depositAmount);
      
      // 尝试从非拥有者账户存款
      await expect(
        ashFaucet.connect(addr1).depositTokens(depositAmount)
      ).to.be.revertedWithCustomError(ashFaucet, "OwnableUnauthorizedAccount");
    });
  });

  describe("空投申领功能", function () {
    const airdropAmount = ethers.parseEther("100");
    
    beforeEach(async function () {
      // 铸造代币并存入faucet合约
      const mintAmount = ethers.parseEther("1000");
      await ashCoin.connect(owner).mint(owner.address, mintAmount);
      
      // 存款
      await ashCoin.connect(owner).approve(await ashFaucet.getAddress(), mintAmount);
      await ashFaucet.connect(owner).depositTokens(mintAmount);
    });

    it("用户应该能够申领空投", async function () {
      // 初始余额检查
      const initialBalance = await ashCoin.balanceOf(addr1.address);
      expect(initialBalance).to.equal(0);
      
      // 申领空投
      await expect(ashFaucet.connect(addr1).claim())
        .to.emit(ashFaucet, "AirdropClaimed")
        .withArgs(addr1.address, airdropAmount);

      // 检查余额增加
      expect(await ashCoin.balanceOf(addr1.address)).to.equal(airdropAmount);
      
      // 检查合约余额减少
      expect(await ashCoin.balanceOf(await ashFaucet.getAddress())).to.equal(
        ethers.parseEther("1000") - airdropAmount
      );
      
      // 检查下次申领时间设置
      const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
      expect(await ashFaucet.nextClaimTime(addr1.address)).to.equal(currentTime + 60);
    });

    it("用户在冷却期内不应该能够再次申领", async function () {
      // 第一次申领
      await ashFaucet.connect(addr1).claim();
      
      // 立即尝试再次申领应该失败
      await expect(
        ashFaucet.connect(addr1).claim()
      ).to.be.revertedWithCustomError(ashFaucet, "ClaimTooEarly");
    });

    it("用户在冷却期后应该能够再次申领", async function () {
      // 第一次申领
      await ashFaucet.connect(addr1).claim();
      
      // 增加时间到冷却期之后
      await ethers.provider.send("evm_increaseTime", [61]); // 增加61秒
      await ethers.provider.send("evm_mine", []); // 挖掘新区块
      
      // 再次申领应该成功
      await expect(ashFaucet.connect(addr1).claim())
        .to.emit(ashFaucet, "AirdropClaimed")
        .withArgs(addr1.address, airdropAmount);
    });

    it("当合约余额不足时用户不应该能够申领", async function () {
      // 提取所有代币
      const contractBalance = await ashCoin.balanceOf(await ashFaucet.getAddress());
      await ashFaucet.connect(owner).withdrawTokens(contractBalance);
      
      // 尝试申领应该失败
      await expect(
        ashFaucet.connect(addr1).claim()
      ).to.be.revertedWithCustomError(ashFaucet, "InsufficientBalance");
    });
  });

  describe("查询功能", function () {
    const airdropAmount = ethers.parseEther("100");
    
    beforeEach(async function () {
      // 铸造代币并存入faucet合约
      const mintAmount = ethers.parseEther("1000");
      await ashCoin.connect(owner).mint(owner.address, mintAmount);
      
      // 存款
      await ashCoin.connect(owner).approve(await ashFaucet.getAddress(), mintAmount);
      await ashFaucet.connect(owner).depositTokens(mintAmount);
    });

    it("应该能够查询合约余额", async function () {
      expect(await ashFaucet.getContractBalance()).to.equal(ethers.parseEther("1000"));
    });

    it("应该能够查询用户下次申领时间", async function () {
      // 申领前时间应该为0
      expect(await ashFaucet.getNextClaimTime(addr1.address)).to.equal(0);
      
      // 申领后应该设置下次申领时间
      const tx = await ashFaucet.connect(addr1).claim();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockHash);
      const expectedNextClaimTime = block!.timestamp + 60;
      
      expect(await ashFaucet.getNextClaimTime(addr1.address)).to.equal(expectedNextClaimTime);
    });

    it("应该能够检查用户是否可以申领", async function () {
      // 申领前应该可以申领
      expect(await ashFaucet.canClaim(addr1.address)).to.equal(true);
      
      // 申领后不应该可以申领
      await ashFaucet.connect(addr1).claim();
      expect(await ashFaucet.canClaim(addr1.address)).to.equal(false);
      
      // 增加时间后应该可以再次申领
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);
      expect(await ashFaucet.canClaim(addr1.address)).to.equal(true);
    });
  });

  describe("管理功能", function () {
    it("合约拥有者应该能够更新申领间隔", async function () {
      const newPeriod = 120; // 120秒
      
      await expect(ashFaucet.connect(owner).updateClaimPeriod(newPeriod))
        .to.emit(ashFaucet, "ClaimPeriodUpdated")
        .withArgs(newPeriod);

      expect(await ashFaucet.claimPeriod()).to.equal(newPeriod);
    });

    it("非拥有者不应该能够更新申领间隔", async function () {
      const newPeriod = 120;
      
      await expect(
        ashFaucet.connect(addr1).updateClaimPeriod(newPeriod)
      ).to.be.revertedWithCustomError(ashFaucet, "OwnableUnauthorizedAccount");
    });

    it("合约拥有者应该能够提取代币", async function () {
      // 先存入一些代币
      const mintAmount = ethers.parseEther("1000");
      await ashCoin.connect(owner).mint(owner.address, mintAmount);
      await ashCoin.connect(owner).approve(await ashFaucet.getAddress(), mintAmount);
      await ashFaucet.connect(owner).depositTokens(mintAmount);
      
      // 提取部分代币
      const withdrawAmount = ethers.parseEther("500");
      await expect(ashFaucet.connect(owner).withdrawTokens(withdrawAmount))
        .to.emit(ashFaucet, "TokensWithdrawn")
        .withArgs(owner.address, withdrawAmount);

      expect(await ashCoin.balanceOf(await ashFaucet.getAddress())).to.equal(
        ethers.parseEther("500")
      );
    });

    it("非拥有者不应该能够提取代币", async function () {
      await expect(
        ashFaucet.connect(addr1).withdrawTokens(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(ashFaucet, "OwnableUnauthorizedAccount");
    });
  });
});