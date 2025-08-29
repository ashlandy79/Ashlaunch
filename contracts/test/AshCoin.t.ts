import "@nomicfoundation/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";


describe("AshCoin", function () {
  let AshCoin:any;
  let ashCoin:any;
  let owner:any;
  let addr1:any;
  let addr2:any;
  let addrs:any;

  beforeEach(async function () {
    // 获取合约工厂和账户
    AshCoin = await ethers.getContractFactory("AshCoin");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // 部署合约
    ashCoin = await AshCoin.deploy(owner.address);
    await ashCoin.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确设置名称和符号", async function () {
      expect(await ashCoin.NAME()).to.equal("AshCoin");
      expect(await ashCoin.SYMBOL()).to.equal("AC");
    });

    it("应该将所有者设置为部署者", async function () {
      expect(await ashCoin.owner()).to.equal(owner.address);
    });

    it("初始供应量应该为0", async function () {
      expect(await ashCoin.totalSupply()).to.equal(0);
    });
  });

  describe("铸币功能", function () {
    it("所有者应该能够铸造代币", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      console.log("铸造前 addr1 余额:", (await ashCoin.balanceOf(addr1.address)).toString());
      console.log("铸造前总供应量:", (await ashCoin.totalSupply()).toString());
      
      await expect(ashCoin.connect(owner).mint(addr1.address, mintAmount))
        .to.emit(ashCoin, "Mint")
        .withArgs(addr1.address, mintAmount);

      const finalBalance = await ashCoin.balanceOf(addr1.address);
      const finalSupply = await ashCoin.totalSupply();
      
      console.log("铸造后 addr1 余额:", finalBalance.toString());
      console.log("铸造后总供应量:", finalSupply.toString());
      
      expect(finalBalance).to.equal(mintAmount);
      expect(finalSupply).to.equal(mintAmount);
    });

    it("非所有者不应该能够铸造代币", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        ashCoin.connect(addr1).mint(addr1.address, mintAmount)
      ).to.be.revertedWithCustomError(ashCoin, "OwnableUnauthorizedAccount");
    });

    it("应该拒绝向零地址铸造代币", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        ashCoin.connect(owner).mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWithCustomError(ashCoin, "ERC20InvalidReceiver");
    });
  });

  describe("销毁功能", function () {
    beforeEach(async function () {
      // 先铸造一些代币用于测试销毁
      const mintAmount = ethers.parseEther("1000");
      await ashCoin.connect(owner).mint(addr1.address, mintAmount);
    });

    it("所有者应该能够销毁代币", async function () {
      const burnAmount = ethers.parseEther("500");
      const initialBalance = await ashCoin.balanceOf(addr1.address);
      const initialSupply = await ashCoin.totalSupply();

      await expect(ashCoin.connect(owner).burn(addr1.address, burnAmount))
        .to.emit(ashCoin, "Burn")
        .withArgs(addr1.address, burnAmount);

      expect(await ashCoin.balanceOf(addr1.address)).to.equal(initialBalance - burnAmount);
      expect(await ashCoin.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("非所有者不应该能够销毁代币", async function () {
      const burnAmount = ethers.parseEther("500");
      
      await expect(
        ashCoin.connect(addr1).burn(addr1.address, burnAmount)
      ).to.be.revertedWithCustomError(ashCoin, "OwnableUnauthorizedAccount");
    });

    it("不应该销毁超过余额的代币", async function () {
      const excessiveAmount = ethers.parseEther("2000");
      
      await expect(
        ashCoin.connect(owner).burn(addr1.address, excessiveAmount)
      ).to.be.revertedWithCustomError(ashCoin, "ERC20InsufficientBalance");
    });

    it("应该拒绝从零地址销毁代币", async function () {
      const burnAmount = ethers.parseEther("500");
      
      await expect(
        ashCoin.connect(owner).burn(ethers.ZeroAddress, burnAmount)
      ).to.be.revertedWithCustomError(ashCoin, "ERC20InvalidSender");
    });
  });

  describe("ERC20标准功能", function () {
    beforeEach(async function () {
      // 铸造一些代币用于测试转账
      const mintAmount = ethers.parseEther("1000");
      await ashCoin.connect(owner).mint(addr1.address, mintAmount);
    });

    it("应该允许代币转账", async function () {
      const transferAmount = ethers.parseEther("100");
      const initialBalanceAddr1 = await ashCoin.balanceOf(addr1.address);
      const initialBalanceAddr2 = await ashCoin.balanceOf(addr2.address);

      await ashCoin.connect(addr1).transfer(addr2.address, transferAmount);

      expect(await ashCoin.balanceOf(addr1.address)).to.equal(initialBalanceAddr1 - transferAmount);
      expect(await ashCoin.balanceOf(addr2.address)).to.equal(initialBalanceAddr2 + transferAmount);
    });

    it("应该允许代币授权和转账", async function () {
      const approveAmount = ethers.parseEther("200");
      const transferAmount = ethers.parseEther("100");

      // 授权
      await ashCoin.connect(addr1).approve(addr2.address, approveAmount);
      expect(await ashCoin.allowance(addr1.address, addr2.address)).to.equal(approveAmount);

      // 从授权账户转账
      await ashCoin.connect(addr2).transferFrom(addr1.address, addr2.address, transferAmount);

      expect(await ashCoin.allowance(addr1.address, addr2.address)).to.equal(approveAmount - transferAmount);
      expect(await ashCoin.balanceOf(addr2.address)).to.equal(transferAmount);
    });
  });
});