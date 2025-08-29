import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // 获取部署者账户
  const [deployer] = await ethers.getSigners();

  console.log("部署账户地址:", deployer.address);
  console.log("账户余额:", (await deployer.provider.getBalance(deployer.address)).toString());

  // 部署 AshCoin 合约
  console.log("\n正在部署 AshCoin 合约...");
  const AshCoin = await ethers.getContractFactory("AshCoin");
  const ashCoin = await AshCoin.deploy(deployer.address);
  await ashCoin.waitForDeployment();
  
  const ashCoinAddress = await ashCoin.getAddress();
  console.log("AshCoin 合约部署地址:", ashCoinAddress);
  console.log("合约名称:", await ashCoin.NAME());
  console.log("合约符号:", await ashCoin.SYMBOL());
  console.log("合约所有者:", await ashCoin.owner());

  // 部署 AshFaucet 合约
  console.log("\n正在部署 AshFaucet 合约...");
  const AshFaucet = await ethers.getContractFactory("AshFaucet");
  
  // 设置空投参数
  const airdropAmount = ethers.parseEther("100"); // 每次空投 100 个代币
  const claimPeriod = 24 * 60 * 60; // 24 小时冷却期
  
  const ashFaucet = await AshFaucet.deploy(
    ashCoinAddress,        // AshCoin 合约地址
    airdropAmount,         // 空投数量
    claimPeriod,           // 申领间隔
    deployer.address       // 合约所有者
  );
  
  await ashFaucet.waitForDeployment();
  const ashFaucetAddress = await ashFaucet.getAddress();
  console.log("AshFaucet 合约部署地址:", ashFaucetAddress);
  
  // 验证 AshFaucet 参数
  console.log("\nAshFaucet 合约参数:");
  console.log("代币地址:", await ashFaucet.token());
  console.log("空投数量:", (await ashFaucet.airdropAmount()).toString());
  console.log("申领间隔:", (await ashFaucet.claimPeriod()).toString());
  console.log("合约所有者:", await ashFaucet.owner());

  // 部署 Farming 合约
  console.log("\n正在部署 Farming 合约...");
  const Farming = await ethers.getContractFactory("Farming");
  
  // 设置 farming 参数 - 使用更低的奖励率，适合测试环境
  const rewardRatePerSecond = ethers.parseEther("0.000001"); // 每秒每个质押代币可获得 0.000001 奖励
  
  const farming = await Farming.deploy(
    ashCoinAddress,              // 质押代币地址 (AshCoin)
    ashCoinAddress,              // 奖励代币地址 (AshCoin)
    rewardRatePerSecond,         // 奖励率
    deployer.address             // 合约所有者
  );
  
  await farming.waitForDeployment();
  const farmingAddress = await farming.getAddress();
  console.log("Farming 合约部署地址:", farmingAddress);
  
  // 验证 Farming 参数（使用合约实例调用）
  const farmingContract = await ethers.getContractAt("Farming", farmingAddress);
  
  console.log("\nFarming 合约参数:");
  console.log("质押代币地址:", await farmingContract.stakingToken());
  console.log("奖励代币地址:", await farmingContract.rewardToken());
  console.log("奖励率:", (await farmingContract.rewardRatePerSecond()).toString());
  console.log("合约所有者:", await farmingContract.owner());

  // 部署 Sales 合约
  console.log("\n正在部署 Sales 合约...");
  const Sales = await ethers.getContractFactory("Sales");
  
  // 设置 sales 参数
  const price = ethers.parseEther("0.1"); // 1 TOKEN = 0.1 USDT (假设USDT也是AshCoin用于测试)
  const purchaseLimit = ethers.parseEther("1000"); // 每个地址最大购买1000个代币
  const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始
  const endTime = startTime + 30 * 24 * 60 * 60; // 30天后结束
  const requiredTokenBalance = ethers.parseEther("100"); // 要求持有100个代币才能注册白名单
  
  const sales = await Sales.deploy(
    ashCoinAddress,              // 销售代币地址 (AshCoin)
    ashCoinAddress,              // 支付代币地址 (AshCoin作为USDT替代)
    price,                       // 固定价格
    purchaseLimit,               // 购买限额
    startTime,                   // 开始时间
    endTime,                     // 结束时间
    requiredTokenBalance,        // 要求的最低代币余额
    deployer.address             // 合约所有者
  );
  
  await sales.waitForDeployment();
  const salesAddress = await sales.getAddress();
  console.log("Sales 合约部署地址:", salesAddress);
  
  // 验证 Sales 参数
  const salesContract = await ethers.getContractAt("Sales", salesAddress);
  
  console.log("\nSales 合约参数:");
  console.log("销售代币地址:", await salesContract.saleToken());
  console.log("支付代币地址:", await salesContract.paymentToken());
  console.log("价格:", (await salesContract.price()).toString());
  console.log("购买限额:", (await salesContract.purchaseLimit()).toString());
  console.log("开始时间:", (await salesContract.startTime()).toString());
  console.log("结束时间:", (await salesContract.endTime()).toString());
  console.log("要求的最低代币余额:", (await salesContract.requiredTokenBalance()).toString());
  console.log("合约所有者:", await salesContract.owner());

  // 向 AshFaucet 合约转入一些代币用于空投
  console.log("\n向 AshFaucet 合约转入代币...");
  const transferAmount = ethers.parseEther("10000"); // 转入 10,000 个代币
  const mintTx = await ashCoin.mint(deployer.address, transferAmount);
  await mintTx.wait();
  
  const depositTx = await ashCoin.approve(ashFaucetAddress, transferAmount);
  await depositTx.wait();
  
  const depositToFaucetTx = await ashFaucet.depositTokens(transferAmount);
  await depositToFaucetTx.wait();
  
  console.log("已向 AshFaucet 合约转入", ethers.formatEther(transferAmount), "个代币");
  console.log("AshFaucet 合约当前余额:", ethers.formatEther(await ashFaucet.getContractBalance()));

  // 向 Farming 合约转入一些代币用于奖励
  console.log("\n向 Farming 合约转入奖励代币...");
  const rewardAmount = ethers.parseEther("5000"); // 转入 5,000 个代币作为奖励
  const mintRewardTx = await ashCoin.mint(deployer.address, rewardAmount);
  await mintRewardTx.wait();
  
  const approveRewardTx = await ashCoin.approve(farmingAddress, rewardAmount);
  await approveRewardTx.wait();
  
  const depositToFarmingTx = await ashCoin.transfer(farmingAddress, rewardAmount);
  await depositToFarmingTx.wait();
  
  console.log("已向 Farming 合约转入", ethers.formatEther(rewardAmount), "个奖励代币");
  console.log("Farming 合约当前奖励余额:", ethers.formatEther(await farmingContract.getRewardBalance()));

  // 向 Sales 合约转入一些代币用于销售
  console.log("\n向 Sales 合约转入销售代币...");
  const salesAmount = ethers.parseEther("20000"); // 转入 20,000 个代币用于销售
  const mintSalesTx = await ashCoin.mint(deployer.address, salesAmount);
  await mintSalesTx.wait();
  
  const approveSalesTx = await ashCoin.approve(salesAddress, salesAmount);
  await approveSalesTx.wait();
  
  const depositToSalesTx = await ashCoin.transfer(salesAddress, salesAmount);
  await depositToSalesTx.wait();
  
  console.log("已向 Sales 合约转入", ethers.formatEther(salesAmount), "个销售代币");
  console.log("Sales 合约当前销售代币余额:", ethers.formatEther((await salesContract.getSaleInfo())[0]));

  // 输出环境变量格式的地址
  console.log("\n--- 合约地址 (请更新您的 .env.local 文件) ---");
  console.log(`NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL=${ashCoinAddress}`);
  console.log(`NEXT_PUBLIC_ASHFAUCET_ADDRESS_LOCAL=${ashFaucetAddress}`);
  console.log(`NEXT_PUBLIC_FARMING_ADDRESS_LOCAL=${farmingAddress}`);
  console.log(`NEXT_PUBLIC_SALES_ADDRESS_LOCAL=${salesAddress}`);

  // 尝试更新前端的 .env.local 文件
  updateFrontendEnvFile(ashCoinAddress, ashFaucetAddress, farmingAddress, salesAddress);

  console.log("\n部署完成!");
}

function updateFrontendEnvFile(ashCoinAddress: string, ashFaucetAddress: string, farmingAddress: string, salesAddress: string) {
  const envFilePath = path.join(__dirname, "..", "..", "frontend", ".env.local");
  
  try {
    // 检查文件是否存在
    if (fs.existsSync(envFilePath)) {
      // 读取现有内容
      let envContent = fs.readFileSync(envFilePath, "utf8");
      
      // 更新 AshCoin 地址
      if (envContent.includes("NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL=")) {
        envContent = envContent.replace(
          /NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL=.*$/m,
          `NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL=${ashCoinAddress}`
        );
      } else {
        envContent += `\nNEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL=${ashCoinAddress}`;
      }
      
      // 更新 AshFaucet 地址
      if (envContent.includes("NEXT_PUBLIC_ASHFAUCET_ADDRESS_LOCAL=")) {
        envContent = envContent.replace(
          /NEXT_PUBLIC_ASHFAUCET_ADDRESS_LOCAL=.*$/m,
          `NEXT_PUBLIC_ASHFAUCET_ADDRESS_LOCAL=${ashFaucetAddress}`
        );
      } else {
        envContent += `\nNEXT_PUBLIC_ASHFAUCET_ADDRESS_LOCAL=${ashFaucetAddress}`;
      }
      
      // 更新 Farming 地址
      if (envContent.includes("NEXT_PUBLIC_FARMING_ADDRESS_LOCAL=")) {
        envContent = envContent.replace(
          /NEXT_PUBLIC_FARMING_ADDRESS_LOCAL=.*$/m,
          `NEXT_PUBLIC_FARMING_ADDRESS_LOCAL=${farmingAddress}`
        );
      } else {
        envContent += `\nNEXT_PUBLIC_FARMING_ADDRESS_LOCAL=${farmingAddress}`;
      }
      
      // 更新 Sales 地址
      if (envContent.includes("NEXT_PUBLIC_SALES_ADDRESS_LOCAL=")) {
        envContent = envContent.replace(
          /NEXT_PUBLIC_SALES_ADDRESS_LOCAL=.*$/m,
          `NEXT_PUBLIC_SALES_ADDRESS_LOCAL=${salesAddress}`
        );
      } else {
        envContent += `\nNEXT_PUBLIC_SALES_ADDRESS_LOCAL=${salesAddress}`;
      }
      
      // 写入更新后的内容
      fs.writeFileSync(envFilePath, envContent);
      console.log("已自动更新 frontend/.env.local 文件");
    } else {
      console.log("frontend/.env.local 文件不存在，跳过自动更新");
    }
  } catch (error) {
    console.error("更新 frontend/.env.local 文件时出错:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });