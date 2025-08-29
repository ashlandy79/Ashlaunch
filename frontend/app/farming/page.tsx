"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { ethers } from "ethers";

// AshCoin 合约 ABI (简化版，仅包含需要的方法)
const ASHCOIN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)"
];

// Farming 合约 ABI (简化版，仅包含需要的方法)
const FARMING_ABI = [
  "function stake(uint256 amount)",
  "function unstake(uint256 amount)",
  "function claimReward()",
  "function pendingReward(address user) view returns (uint256)",
  "function userInfo(address user) view returns (uint256 stakedAmount, uint256 rewardDebt, uint256 lastUpdateTime)",
  "function getRewardBalance() view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function owner() view returns (address)"
];

// 合约地址 (从环境变量获取)
const ASHCOIN_ADDRESS = process.env.NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL || '';
const FARMING_ADDRESS = process.env.NEXT_PUBLIC_FARMING_ADDRESS_LOCAL || '';

export default function Farming() {
  const [isMounted, setIsMounted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionStatus, setActionStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [userBalance, setUserBalance] = useState<string>('0');
  const [stakedAmount, setStakedAmount] = useState<string>('0');
  const [pendingReward, setPendingReward] = useState<string>('0');
  const [contractRewardBalance, setContractRewardBalance] = useState<string>('0');
  const [totalStaked, setTotalStaked] = useState<string>('0');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [addRewardAmount, setAddRewardAmount] = useState<string>('');
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const { isConnected, account } = useWallet();

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 检查用户状态
  useEffect(() => {
    if (isConnected && account && FARMING_ADDRESS && ASHCOIN_ADDRESS) {
      checkUserStatus();
      const interval = setInterval(checkUserStatus, 30000); // 每30秒检查一次
      return () => clearInterval(interval);
    }
  }, [isConnected, account]);

  const checkUserStatus = async () => {
    if (!window.ethereum || !account) return;

    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const ashCoin = new ethers.Contract(ASHCOIN_ADDRESS, ASHCOIN_ABI, provider);
      const farming = new ethers.Contract(FARMING_ADDRESS, FARMING_ABI, provider);

      // 获取用户AC代币余额
      const balance = await ashCoin.balanceOf(account);
      setUserBalance(ethers.utils.formatEther(balance));

      // 获取用户质押信息
      const userInfo = await farming.userInfo(account);
      setStakedAmount(ethers.utils.formatEther(userInfo.stakedAmount));

      // 获取用户待领取奖励
      const reward = await farming.pendingReward(account);
      setPendingReward(ethers.utils.formatEther(reward));

      // 获取合约奖励余额
      const rewardBalance = await farming.getRewardBalance();
      setContractRewardBalance(ethers.utils.formatEther(rewardBalance));

      // 获取总质押量
      const total = await farming.totalStaked();
      setTotalStaked(ethers.utils.formatEther(total));

      // 检查用户是否为合约所有者
      const owner = await farming.owner();
      setIsOwner(account.toLowerCase() === owner.toLowerCase());
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };

  const handleStake = async () => {
    if (!isConnected || !account || !window.ethereum || !stakeAmount) return;
    
    setIsProcessing(true);
    setActionStatus("processing");
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const ashCoin = new ethers.Contract(ASHCOIN_ADDRESS, ASHCOIN_ABI, signer);
      const farming = new ethers.Contract(FARMING_ADDRESS, FARMING_ABI, signer);
      
      const amount = ethers.utils.parseEther(stakeAmount);
      
      // 检查授权
      const allowance = await ashCoin.allowance(account, FARMING_ADDRESS);
      if (allowance < amount) {
        // 授权
        const approveTx = await ashCoin.approve(FARMING_ADDRESS, amount);
        await approveTx.wait();
      }
      
      // 质押
      const tx = await farming.stake(amount);
      await tx.wait();
      
      setActionStatus("success");
      setStakeAmount('');
      
      // 更新状态
      setTimeout(() => {
        checkUserStatus();
      }, 3000);
    } catch (error: any) {
      console.error('Stake error:', error);
      setActionStatus("error");
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else {
        alert('质押失败，请稍后再试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnstake = async () => {
    if (!isConnected || !account || !window.ethereum || !unstakeAmount) return;
    
    setIsProcessing(true);
    setActionStatus("processing");
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const farming = new ethers.Contract(FARMING_ADDRESS, FARMING_ABI, signer);
      
      const amount = ethers.utils.parseEther(unstakeAmount);
      
      // 解押
      const tx = await farming.unstake(amount);
      await tx.wait();
      
      setActionStatus("success");
      setUnstakeAmount('');
      
      // 更新状态
      setTimeout(() => {
        checkUserStatus();
      }, 3000);
    } catch (error: any) {
      console.error('Unstake error:', error);
      setActionStatus("error");
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else if (error?.message?.includes('InsufficientRewardBalance')) {
        alert('合约奖励代币余额不足，无法解押。请联系项目方充值奖励代币。');
      } else if (error?.message?.includes('InsufficientStakedAmount')) {
        alert('解押数量超过质押数量');
      } else if (error?.message?.includes('InvalidAmount')) {
        alert('解押数量无效');
      } else {
        alert('解押失败，请稍后再试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimReward = async () => {
    if (!isConnected || !account || !window.ethereum) return;
    
    setIsProcessing(true);
    setActionStatus("processing");
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const farming = new ethers.Contract(FARMING_ADDRESS, FARMING_ABI, signer);
      
      // 领取奖励
      const tx = await farming.claimReward();
      await tx.wait();
      
      setActionStatus("success");
      
      // 更新状态
      setTimeout(() => {
        checkUserStatus();
      }, 3000);
    } catch (error: any) {
      console.error('Claim reward error:', error);
      setActionStatus("error");
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else if (error?.message?.includes('NoRewardToClaim')) {
        alert('没有可领取的奖励');
      } else if (error?.message?.includes('InsufficientRewardBalance')) {
        alert('合约奖励代币余额不足，无法领取奖励。请联系项目方充值奖励代币。');
      } else {
        alert('领取奖励失败，请稍后再试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddRewards = async () => {
    if (!isConnected || !account || !window.ethereum || !addRewardAmount) return;
    
    setIsProcessing(true);
    setActionStatus("processing");
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const ashCoin = new ethers.Contract(ASHCOIN_ADDRESS, ASHCOIN_ABI, signer);
      
      const amount = ethers.utils.parseEther(addRewardAmount);
      
      // 向Farming合约转账奖励代币
      const tx = await ashCoin.transfer(FARMING_ADDRESS, amount);
      await tx.wait();
      
      setActionStatus("success");
      setAddRewardAmount('');
      
      // 更新状态
      setTimeout(() => {
        checkUserStatus();
      }, 3000);
    } catch (error: any) {
      console.error('Add rewards error:', error);
      setActionStatus("error");
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else {
        alert('添加奖励失败，请稍后再试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* 动态背景光效 */}
      <div 
        className="fixed inset-0 opacity-70 pointer-events-none"
        style={{
          background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.15), transparent 80%)`
        }}
      />
      
      {/* 网格背景 */}
      <div className="fixed inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }} />

      {/* Farming Section */}
      <section className="py-20 px-4 relative z-10 max-w-6xl mx-auto">
        <div className={`transition-all duration-1000 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-6">
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 mb-4">
              FARMING
            </span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500">
              EARN $ASH TOKENS
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 text-center max-w-3xl mx-auto font-medium">
            Stake your tokens to earn passive income. Deposit tokens to earn rewards based on the time and amount staked.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* 质押操作面板 */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h2 className="text-2xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                Stake & Unstake
              </h2>
              
              {isConnected ? (
                <div className="space-y-6">
                  {/* 质押部分 */}
                  <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-bold mb-4 text-cyan-300">Stake Tokens</h3>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Your Wallet Balance</span>
                      <span className="text-cyan-300">{parseFloat(userBalance).toFixed(2)} AC</span>
                    </div>
                    <div className="flex mb-4">
                      <input
                        type="number"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-gray-900 border border-gray-700 rounded-l-lg py-3 px-4 text-white focus:outline-none focus:border-purple-500"
                        disabled={isProcessing}
                      />
                      <button 
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-r-lg"
                        onClick={handleStake}
                        disabled={isProcessing || !stakeAmount}
                      >
                        Stake
                      </button>
                    </div>
                  </div>
                  
                  {/* 解押部分 */}
                  <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-bold mb-4 text-pink-300">Unstake Tokens</h3>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Your Staked Amount</span>
                      <span className="text-pink-300">{parseFloat(stakedAmount).toFixed(2)} AC</span>
                    </div>
                    <div className="flex mb-4">
                      <input
                        type="number"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-gray-900 border border-gray-700 rounded-l-lg py-3 px-4 text-white focus:outline-none focus:border-pink-500"
                        disabled={isProcessing}
                      />
                      <button 
                        className="bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold py-3 px-6 rounded-r-lg"
                        onClick={handleUnstake}
                        disabled={isProcessing || !unstakeAmount}
                      >
                        Unstake
                      </button>
                    </div>
                  </div>
                  
                  {/* 领取奖励部分 */}
                  <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-bold mb-4 text-purple-300">Claim Rewards</h3>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-gray-400">Pending Rewards</span>
                      <span className="text-purple-300">{parseFloat(pendingReward).toFixed(4)} AC</span>
                    </div>
                    <button
                      onClick={handleClaimReward}
                      disabled={isProcessing || parseFloat(pendingReward) <= 0}
                      className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 ${
                        parseFloat(pendingReward) > 0
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                          : "bg-gray-700 cursor-not-allowed"
                      }`}
                    >
                      Claim Rewards
                    </button>
                  </div>
                  
                  {/* 合约所有者添加奖励代币部分 */}
                  {isOwner && (
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                      <h3 className="text-lg font-bold mb-4 text-yellow-300">Add Rewards (Owner Only)</h3>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Your Wallet Balance</span>
                        <span className="text-yellow-300">{parseFloat(userBalance).toFixed(2)} AC</span>
                      </div>
                      <div className="flex mb-4">
                        <input
                          type="number"
                          value={addRewardAmount}
                          onChange={(e) => setAddRewardAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-gray-900 border border-gray-700 rounded-l-lg py-3 px-4 text-white focus:outline-none focus:border-yellow-500"
                          disabled={isProcessing}
                        />
                        <button 
                          className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold py-3 px-6 rounded-r-lg"
                          onClick={handleAddRewards}
                          disabled={isProcessing || !addRewardAmount}
                        >
                          Add Rewards
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* 操作状态反馈 */}
                  {actionStatus === "success" && (
                    <div className="p-4 bg-green-900/30 border border-green-800 rounded-lg text-center">
                      <p className="text-green-400 font-bold">🎉 Transaction successful!</p>
                      <p className="text-green-300 text-sm mt-1">Your action has been processed.</p>
                    </div>
                  )}
                  
                  {actionStatus === "error" && (
                    <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-center">
                      <p className="text-red-400 font-bold">❌ Transaction failed!</p>
                      <p className="text-red-300 text-sm mt-1">Something went wrong. Please try again.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-6">Connect your wallet to start staking</p>
                  <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.5)] transform hover:scale-105">
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
            
            {/* 信息展示面板 */}
            <div className="space-y-8">
              {/* 用户质押信息卡片 */}
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                  Your Farming Stats
                </h2>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div>
                      <h3 className="font-bold text-gray-400">Staked Amount</h3>
                      <p className="text-2xl font-extrabold text-cyan-300 mt-1">
                        {isConnected ? parseFloat(stakedAmount).toFixed(2) : '0.00'} AC
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-500 border-2 border-cyan-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                      <span className="text-xl font-bold text-white">S</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div>
                      <h3 className="font-bold text-gray-400">Pending Rewards</h3>
                      <p className="text-2xl font-extrabold text-purple-300 mt-1">
                        {isConnected ? parseFloat(pendingReward).toFixed(4) : '0.0000'} AC
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-purple-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                      <span className="text-xl font-bold text-white">R</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div>
                      <h3 className="font-bold text-gray-400">Your Wallet Balance</h3>
                      <p className="text-2xl font-extrabold text-pink-300 mt-1">
                        {isConnected ? parseFloat(userBalance).toFixed(2) : '0.00'} AC
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-500 to-rose-500 border-2 border-pink-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_10px_rgba(244,114,182,0.5)]">
                      <span className="text-xl font-bold text-white">W</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 质押池信息卡片 */}
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
                <h2 className="text-2xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-cyan-400">
                  Farming Pool Info
                </h2>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div>
                      <h3 className="font-bold text-gray-400">Total Staked</h3>
                      <p className="text-2xl font-extrabold text-cyan-300 mt-1">
                        {parseFloat(totalStaked).toFixed(2)} AC
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-500 to-teal-500 border-2 border-cyan-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                      <span className="text-xl font-bold text-white">T</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div>
                      <h3 className="font-bold text-gray-400">Reward Pool Balance</h3>
                      <p className="text-2xl font-extrabold text-purple-300 mt-1">
                        {parseFloat(contractRewardBalance).toFixed(2)} AC
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-500 border-2 border-purple-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                      <span className="text-xl font-bold text-white">B</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div>
                      <h3 className="font-bold text-gray-400">Reward Rate</h3>
                      <p className="text-xl font-extrabold text-pink-300 mt-1">
                        0.000001 AC/sec per staked AC
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-500 to-rose-500 border-2 border-pink-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_10px_rgba(244,114,182,0.5)]">
                      <span className="text-xl font-bold text-white">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 说明信息 */}
          <div className="mt-12 max-w-4xl mx-auto">
            <h2 className="text-2xl font-extrabold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
              How Farming Works
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                <h3 className="font-extrabold text-lg mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  1. Stake Tokens
                </h3>
                <p className="text-gray-400">
                  Deposit your AC tokens into the farming contract to start earning rewards based on the amount and time staked.
                </p>
              </div>
              
              <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                <h3 className="font-extrabold text-lg mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                  2. Earn Rewards
                </h3>
                <p className="text-gray-400">
                  Rewards accumulate over time. The longer you stake and the more you stake, the more rewards you earn.
                </p>
              </div>
              
              <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                <h3 className="font-extrabold text-lg mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                  3. Claim & Unstake
                </h3>
                <p className="text-gray-400">
                  Claim your rewards at any time. You can also unstake your tokens when you want to stop farming.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}