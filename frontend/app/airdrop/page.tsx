"use client";

import { useState, useEffect } from "react";
import { ethers } from 'ethers';
import { useWallet } from "@/contexts/WalletContext";

// 扩展window.ethereum类型定义
declare global {
  interface Window {
    ethereum: {
      isMetaMask?: boolean;
      chainId?: string;
      request?: (...args: any[]) => Promise<any>;
    };
  }
}

// 导入合约ABI
const ASHCOIN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const ASHFAUCET_ABI = [
  "function claim() public",
  "function getRemainingTime(address user) public view returns (uint256)",
  "function getContractBalance() public view returns (uint256)",
  "function getNextClaimTime(address user) public view returns (uint256)",
  "function canClaim(address user) public view returns (bool)",
  "event AirdropClaimed(address indexed user, uint256 amount)"
];

// 合约地址 (从环境变量获取)
const ASHCOIN_ADDRESS = process.env.NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL || '';
const ASHFAUCET_ADDRESS = process.env.NEXT_PUBLIC_ASHFAUCET_ADDRESS_LOCAL || '';

export default function Airdrop() {
  const [isMounted, setIsMounted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "error">("idle");
  const [canUserClaim, setCanUserClaim] = useState<boolean>(false);
  const [nextClaimTime, setNextClaimTime] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [contractBalance, setContractBalance] = useState<string>('0');
  const [userBalance, setUserBalance] = useState<string>('0');
  const { isConnected, account } = useWallet();

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 检查用户申领状态
  useEffect(() => {
    if (isConnected && account && ASHFAUCET_ADDRESS && ASHCOIN_ADDRESS) {
      checkClaimStatus();
      checkUserBalance();
      const interval = setInterval(() => {
        checkClaimStatus();
        checkUserBalance();
      }, 30000); // 每30秒检查一次
      return () => clearInterval(interval);
    }
  }, [isConnected, account]);

  const checkUserBalance = async () => {
    if (!window.ethereum || !account || !ASHCOIN_ADDRESS) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const ashCoin = new ethers.Contract(ASHCOIN_ADDRESS, ASHCOIN_ABI, provider);
      const balance = await ashCoin.balanceOf(account);
      setUserBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('Error checking user balance:', error);
    }
  };

  const checkClaimStatus = async () => {
    if (!window.ethereum || !account) return;

    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const ashFaucet = new ethers.Contract(ASHFAUCET_ADDRESS, ASHFAUCET_ABI, provider);

      // 检查用户是否可以申领
      const canClaim = await ashFaucet.canClaim(account);
      setCanUserClaim(canClaim);

      // 获取下次申领时间
      const nextTime = await ashFaucet.getNextClaimTime(account);
      setNextClaimTime(nextTime.toNumber());

      // 获取剩余时间
      const remaining = await ashFaucet.getRemainingTime(account);
      updateRemainingTime(remaining.toNumber());

      // 获取合约余额
      const balance = await ashFaucet.getContractBalance();
      setContractBalance(ethers.utils.formatEther(balance));

      // 如果用户可以申领，更新状态
      if (canClaim && claimStatus === "claimed") {
        setClaimStatus("idle");
      }
    } catch (error) {
      console.error('Error checking claim status:', error);
    }
  };

  const updateRemainingTime = (seconds: number) => {
    if (seconds <= 0) {
      setRemainingTime('Available now');
      return;
    }

    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds %= 24 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds %= 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    let timeString = '';
    if (days > 0) timeString += `${days}d `;
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}m `;
    if (seconds > 0) timeString += `${seconds}s`;

    setRemainingTime(timeString.trim());
  };

  const addTokenToWallet = async () => {
    if (!window.ethereum || !ASHCOIN_ADDRESS) return;
    
    try {
      // 请求添加代币到MetaMask
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: ASHCOIN_ADDRESS,
            symbol: 'AC',
            decimals: 18,
            image: '', // 可选：代币图标URL
          },
        },
      });
      
      if (wasAdded) {
        console.log('Token added successfully');
      } else {
        console.log('Token addition rejected');
      }
    } catch (error) {
      console.error('添加代币到钱包失败:', error);
      alert('添加代币到钱包失败，请手动添加');
    }
  };

  const handleClaim = async () => {
    if (!isConnected || !account || !window.ethereum) return;
    
    setIsClaiming(true);
    setClaimStatus("claiming");
    
    try {
      // 连接钱包并创建合约实例 (ethers v5语法)
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const ashFaucet = new ethers.Contract(ASHFAUCET_ADDRESS, ASHFAUCET_ABI, signer);

      // 调用申领方法
      const tx = await ashFaucet.claim();
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      // 检查事件是否被触发
      const airdropClaimedEvent = receipt.events?.find((event: ethers.Event) => event.event === "AirdropClaimed");
      if (airdropClaimedEvent && airdropClaimedEvent.args) {
        console.log("空投申领成功，用户:", airdropClaimedEvent.args.user, "金额:", airdropClaimedEvent.args.amount.toString());
      }
      
      // 成功申领
      setClaimStatus("claimed");
      
      // 更新状态
      setTimeout(() => {
        checkClaimStatus();
        checkUserBalance();
      }, 3000);
    } catch (error: any) {
      console.error('Claim error:', error);
      setClaimStatus("error");
      
      // 检查是否是自定义错误
      if (error?.message?.includes('ClaimTooEarly')) {
        alert('申领太早了，请稍后再试');
      } else if (error?.message?.includes('InsufficientBalance')) {
        alert('合约余额不足');
      } else if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else {
        alert('申领失败，请稍后再试');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* 动态背景光效 */}
      <div 
        className="fixed inset-0 opacity-70 pointer-events-none"
        style={{
          background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.15), transparent 80%)`
        }}
      />
      
      {/* 网格背景 */}
      <div className="fixed inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }} />

      {/* AirDrop Section */}
      <section className="py-20 px-4 relative z-10 max-w-6xl mx-auto">
        <div className={`transition-all duration-1000 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-6">
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-500 mb-4">
              CLAIM YOUR
            </span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500">
              $ASH AIRDROP
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 text-center max-w-3xl mx-auto font-medium">
            Connect your wallet to check your eligibility and claim your $ASH tokens
          </p>
          
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 mb-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center">
                  <div className="bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-cyan-400 rounded-xl w-20 h-20 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)] mr-6">
                    <span className="text-3xl font-bold text-white">A</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                      $ASH Token Airdrop
                    </h2>
                    <p className="text-gray-400">
                      {isConnected ? (
                        canUserClaim ? "Eligible for claiming" : "Not eligible"
                      ) : (
                        "Connect to check eligibility"
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="text-center md:text-right">
                  <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-1">
                    100 $ASH
                  </div>
                  <div className="text-gray-400">Available to claim</div>
                  {isConnected && nextClaimTime > 0 && (
                    <div className="text-sm text-cyan-300 mt-1">
                      {remainingTime}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-8">
                {isConnected ? (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Your Wallet</span>
                      <span className="text-cyan-300">{account?.substring(0, 6)}...{account?.substring(account.length - 4)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-gray-400">Your AC Balance</span>
                      <span className="text-cyan-300">{parseFloat(userBalance).toFixed(2)} AC</span>
                    </div>
                    <button
                      onClick={handleClaim}
                      disabled={isClaiming || claimStatus === "claimed" || !canUserClaim}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                        claimStatus === "claimed"
                          ? "bg-gradient-to-r from-green-600 to-emerald-600 cursor-not-allowed"
                          : isClaiming
                          ? "bg-gradient-to-r from-purple-700 to-indigo-700 cursor-not-allowed"
                          : !canUserClaim
                          ? "bg-gray-600 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                      }`}
                    >
                      {claimStatus === "claimed"
                        ? "Already Claimed"
                        : isClaiming
                        ? "Claiming..."
                        : !canUserClaim
                        ? "Not Eligible"
                        : "Claim Airdrop"}
                    </button>
                    
                    {claimStatus === "claimed" && (
                      <div className="mt-4 p-4 bg-green-900/30 border border-green-800 rounded-lg text-center">
                        <p className="text-green-400 font-bold">🎉 Successfully claimed 100 $ASH tokens!</p>
                        <p className="text-green-300 text-sm mt-1">Tokens have been sent to your wallet.</p>
                      </div>
                    )}
                    
                    {claimStatus === "error" && (
                      <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-center">
                        <p className="text-red-400 font-bold">❌ Claim failed!</p>
                        <p className="text-red-300 text-sm mt-1">Something went wrong. Please try again later.</p>
                      </div>
                    )}
                    
                    <div className="mt-4 text-center text-sm text-gray-400">
                      <p>Contract Balance: {parseFloat(contractBalance).toFixed(2)} $ASH</p>
                    </div>
                    
                    <div className="mt-4 text-center">
                      <button
                        onClick={addTokenToWallet}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all duration-300"
                      >
                        Add AC Token to MetaMask
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-400 mb-4">Connect your wallet to check eligibility</p>
                    <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.5)] transform hover:scale-105">
                      Connect Wallet to Claim
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                <h3 className="font-extrabold text-lg mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  How to Claim
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-400">
                  <li>Connect your wallet</li>
                  <li>Check your eligibility</li>
                  <li>Click "Claim Airdrop"</li>
                  <li>Confirm transaction</li>
                  <li>Receive $ASH tokens</li>
                </ol>
              </div>
              
              <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                <h3 className="font-extrabold text-lg mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  Eligibility Criteria
                </h3>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    <span>Hold at least 0.1 ETH</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    <span>Wallet created before Jan 1, 2024</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-cyan-400 mr-2">•</span>
                    <span>Not claimed previously</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                <h3 className="font-extrabold text-lg mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  About $ASH
                </h3>
                <p className="text-gray-400">
                  $ASH is the native utility token of AshLaunch platform, used for governance, staking, and accessing premium features.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}