"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { ethers } from "ethers";

// Sales 合约 ABI (简化版，仅包含需要的方法)
const SALES_ABI = [
  "function purchase(uint256 amount)",
  "function registerForWhitelist()",
  "function addToWhitelist(address[] calldata users)",
  "function removeFromWhitelist(address[] calldata users)",
  "function updatePurchaseLimit(uint256 newLimit)",
  "function updateSalePeriod(uint256 startTime, uint256 endTime)",
  "function updateSaleStatus(bool isActive)",
  "function updateRequiredTokenBalance(uint256 newBalance)",
  "function withdrawTokens(uint256 amount)",
  "function withdrawPaymentTokens(uint256 amount)",
  "function getRemainingPurchaseAmount(address user) view returns (uint256)",
  "function getSaleInfo() view returns (uint256, uint256, uint256, bool)",
  "function isWhitelisted(address) view returns (bool)",
  "function purchasedAmount(address) view returns (uint256)",
  "function purchaseLimit() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function endTime() view returns (uint256)",
  "function isSaleActive() view returns (bool)",
  "function price() view returns (uint256)",
  "function saleToken() view returns (address)",
  "function paymentToken() view returns (address)",
  "function requiredTokenBalance() view returns (uint256)"
];

// Token 合约 ABI (简化版)
const TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// AshCoin 合约 ABI (用于检查AC余额)
const ASHCOIN_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

// 合约地址 (从环境变量获取)
const SALES_ADDRESS = process.env.NEXT_PUBLIC_SALES_ADDRESS_LOCAL || '';
const PAYMENT_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS || '';
const SALE_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SALE_TOKEN_ADDRESS || '';
const ASHCOIN_ADDRESS = process.env.NEXT_PUBLIC_ASHCOIN_ADDRESS_LOCAL || '';

export default function Sales() {
  const [isMounted, setIsMounted] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionStatus, setActionStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [userBalance, setUserBalance] = useState<string>('0');
  const [paymentTokenBalance, setPaymentTokenBalance] = useState<string>('0');
  const [paymentTokenAllowance, setPaymentTokenAllowance] = useState<string>('0');
  const [isUserWhitelisted, setIsUserWhitelisted] = useState<boolean>(false);
  const [userPurchasedAmount, setUserPurchasedAmount] = useState<string>('0');
  const [userRemainingAmount, setUserRemainingAmount] = useState<string>('0');
  const [saleInfo, setSaleInfo] = useState<any>(null);
  const [purchaseAmount, setPurchaseAmount] = useState<string>('');
  const [saleTokenPrice, setSaleTokenPrice] = useState<string>('0');
  const [requiredAC, setRequiredAC] = useState<string>('100'); // 默认要求100AC
  const [userACBalance, setUserACBalance] = useState<string>('0');
  const [isRegistering, setIsRegistering] = useState(false);
  
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
    if (isConnected && account && SALES_ADDRESS) {
      checkSaleStatus();
      const interval = setInterval(checkSaleStatus, 30000); // 每30秒检查一次
      return () => clearInterval(interval);
    }
  }, [isConnected, account]);

  const checkSaleStatus = async () => {
    if (!window.ethereum || !account) return;

    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const sales = new ethers.Contract(SALES_ADDRESS, SALES_ABI, provider);
      
      // 获取销售信息
      const info = await sales.getSaleInfo();
      const price = await sales.price();
      const whitelistStatus = await sales.isWhitelisted(account);
      const purchased = await sales.purchasedAmount(account);
      const remaining = await sales.getRemainingPurchaseAmount(account);
      const startTime = await sales.startTime();
      const endTime = await sales.endTime();
      const isActive = await sales.isSaleActive();
      const requiredBalance = await sales.requiredTokenBalance();
      
      setSaleInfo({
        contractBalance: ethers.utils.formatEther(info[0]),
        startTime: startTime.toNumber(),
        endTime: endTime.toNumber(),
        isActive: isActive
      });
      
      setSaleTokenPrice(ethers.utils.formatEther(price));
      setIsUserWhitelisted(whitelistStatus);
      setUserPurchasedAmount(ethers.utils.formatEther(purchased));
      setUserRemainingAmount(ethers.utils.formatEther(remaining));
      setRequiredAC(ethers.utils.formatEther(requiredBalance));
      
      // 获取用户代币余额
      if (SALE_TOKEN_ADDRESS) {
        const saleToken = new ethers.Contract(SALE_TOKEN_ADDRESS, TOKEN_ABI, provider);
        const balance = await saleToken.balanceOf(account);
        setUserBalance(ethers.utils.formatEther(balance));
      }
      
      // 获取支付代币余额和授权
      if (PAYMENT_TOKEN_ADDRESS) {
        const paymentToken = new ethers.Contract(PAYMENT_TOKEN_ADDRESS, TOKEN_ABI, provider);
        const balance = await paymentToken.balanceOf(account);
        const allowance = await paymentToken.allowance(account, SALES_ADDRESS);
        setPaymentTokenBalance(ethers.utils.formatEther(balance));
        setPaymentTokenAllowance(ethers.utils.formatEther(allowance));
      }
      
      // 获取用户AC余额
      if (ASHCOIN_ADDRESS) {
        const ashCoin = new ethers.Contract(ASHCOIN_ADDRESS, ASHCOIN_ABI, provider);
        const balance = await ashCoin.balanceOf(account);
        setUserACBalance(ethers.utils.formatEther(balance));
      }
    } catch (error) {
      console.error('Error checking sale status:', error);
    }
  };

  const handleApprove = async () => {
    if (!isConnected || !account || !window.ethereum || !purchaseAmount) return;
    
    setIsProcessing(true);
    setActionStatus("processing");
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const paymentToken = new ethers.Contract(PAYMENT_TOKEN_ADDRESS, TOKEN_ABI, signer);
      
      const amount = ethers.utils.parseEther(purchaseAmount);
      
      // 授权
      const tx = await paymentToken.approve(SALES_ADDRESS, amount);
      await tx.wait();
      
      setActionStatus("success");
      
      // 更新状态
      setTimeout(() => {
        checkSaleStatus();
        setActionStatus("idle");
      }, 3000);
    } catch (error: any) {
      console.error('Approve error:', error);
      setActionStatus("error");
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else {
        alert('授权失败，请稍后再试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchase = async () => {
    if (!isConnected || !account || !window.ethereum || !purchaseAmount) return;
    
    setIsProcessing(true);
    setActionStatus("processing");
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const sales = new ethers.Contract(SALES_ADDRESS, SALES_ABI, signer);
      
      const amount = ethers.utils.parseEther(purchaseAmount);
      
      // 购买
      const tx = await sales.purchase(amount);
      await tx.wait();
      
      setActionStatus("success");
      setPurchaseAmount('');
      
      // 更新状态
      setTimeout(() => {
        checkSaleStatus();
        setActionStatus("idle");
      }, 3000);
    } catch (error: any) {
      console.error('Purchase error:', error);
      setActionStatus("error");
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else if (error?.message?.includes('SaleNotActive')) {
        alert('销售未激活');
      } else if (error?.message?.includes('SaleNotStarted')) {
        alert('销售尚未开始');
      } else if (error?.message?.includes('SaleEnded')) {
        alert('销售已结束');
      } else if (error?.message?.includes('NotWhitelisted')) {
        alert('您不在白名单中');
      } else if (error?.message?.includes('PurchaseLimitExceeded')) {
        alert('超过购买限额');
      } else if (error?.message?.includes('InsufficientBalance')) {
        alert('合约余额不足');
      } else {
        alert('购买失败，请稍后再试');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 注册白名单功能
  const handleRegisterWhitelist = async () => {
    if (!isConnected || !account || !window.ethereum) return;
    
    // 检查用户是否有足够的AC代币
    if (parseFloat(userACBalance) < parseFloat(requiredAC)) {
      alert(`您需要至少持有 ${requiredAC} AC 才能注册白名单`);
      return;
    }
    
    setIsRegistering(true);
    
    try {
      // 使用ethers v5语法
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const sales = new ethers.Contract(SALES_ADDRESS, SALES_ABI, signer);
      
      // 注册白名单
      const tx = await sales.registerForWhitelist();
      await tx.wait();
      
      // 更新状态
      setTimeout(() => {
        checkSaleStatus();
        alert('成功注册白名单！');
      }, 3000);
    } catch (error: any) {
      console.error('Register whitelist error:', error);
      
      if (error?.message?.includes('user rejected transaction')) {
        alert('用户取消了交易');
      } else if (error?.message?.includes('OwnableUnauthorizedAccount')) {
        alert('只有合约所有者可以添加白名单。请联系项目方将您添加到白名单中。');
      } else {
        alert('注册白名单失败，请联系项目方将您添加到白名单中。');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const getSaleStatus = () => {
    if (!saleInfo) return "Loading...";
    
    const now = Math.floor(Date.now() / 1000);
    
    if (!saleInfo.isActive) return "已结束";
    if (now < saleInfo.startTime) return "未开始";
    if (now >= saleInfo.startTime && now <= saleInfo.endTime) return "进行中";
    return "已结束";
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // 计算销售进度百分比
  const calculateProgress = () => {
    if (!saleInfo) return 0;
    const total = parseFloat(saleInfo.contractBalance);
    const sold = parseFloat(userPurchasedAmount) || 0;
    return total > 0 ? Math.min(100, (sold / total) * 100) : 0;
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

      {/* Sales Section */}
      <section className="py-20 px-4 relative z-10 max-w-6xl mx-auto">
        <div className={`transition-all duration-1000 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-6">
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 mb-4">
              TOKEN SALES
            </span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500">
              PARTICIPATE IN EXCLUSIVE LAUNCHES
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-12 text-center max-w-3xl mx-auto font-medium">
            Join our exclusive token sales and get early access to promising projects
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* 项目信息区 */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h2 className="text-2xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                Project Information
              </h2>
              
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-cyan-400 rounded-xl w-20 h-20 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)] mr-6">
                  <span className="text-3xl font-bold text-white">P</span>
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-2">
                    Project Name
                  </h3>
                  <p className="text-gray-400">
                    Revolutionary blockchain project with innovative solutions
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-cyan-300 mb-2">Project Description</h4>
                  <p className="text-gray-400">
                    This is a revolutionary blockchain project that aims to solve real-world problems with innovative solutions.
                    Join us in building the future of decentralized technology.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-bold text-cyan-300 mb-2">Official Links</h4>
                  <div className="flex flex-wrap gap-3">
                    <a href="#" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                      Website
                    </a>
                    <a href="#" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                      Whitepaper
                    </a>
                    <a href="#" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                      Twitter
                    </a>
                    <a href="#" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                      Telegram
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 销售详情区 */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h2 className="text-2xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                Sale Details
              </h2>
              
              <div className="space-y-6">
                {/* 销售进度条 */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-cyan-300">{calculateProgress().toFixed(2)}% funded</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-cyan-500 h-2.5 rounded-full" 
                      style={{ width: `${calculateProgress()}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-400">{userPurchasedAmount || "0"} TOKEN</span>
                    <span className="text-gray-400">{saleInfo?.contractBalance || "0"} TOKEN</span>
                  </div>
                </div>
                
                {/* 价格信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <div className="text-gray-400 text-sm mb-1">Price</div>
                    <div className="font-bold">1 TOKEN = {saleTokenPrice || "0.1"} USDT</div>
                  </div>
                  
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                    <div className="text-gray-400 text-sm mb-1">Status</div>
                    <div className="font-bold text-cyan-300">{getSaleStatus()}</div>
                  </div>
                </div>
                
                {/* 时间信息 */}
                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                  <div className="text-gray-400 text-sm mb-2">Timeline</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Start Time:</span>
                      <span>{saleInfo ? formatTime(saleInfo.startTime) : "Loading..."}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">End Time:</span>
                      <span>{saleInfo ? formatTime(saleInfo.endTime) : "Loading..."}</span>
                    </div>
                  </div>
                </div>
                
                {/* 购买资格 */}
                <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                  <div className="text-gray-400 text-sm mb-2">Eligibility</div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Required AC:</span>
                    <span>{requiredAC} AC</span>
                  </div>
                  <div className="mt-2 text-sm">
                    {isUserWhitelisted ? (
                      <span className="text-green-400">✓ You are eligible to participate</span>
                    ) : (
                      <span className="text-red-400">
                        ✗ You are not eligible. 
                        {isConnected ? (
                          <span> Hold {requiredAC} AC to participate.</span>
                        ) : (
                          <span> Connect wallet to check eligibility.</span>
                        )}
                      </span>
                    )}
                  </div>
                  {isConnected && !isUserWhitelisted && (
                    <div className="mt-3">
                      <p className="text-gray-400 text-sm mb-2">
                        Your AC balance: {parseFloat(userACBalance).toFixed(2)} AC
                      </p>
                      <button
                        onClick={handleRegisterWhitelist}
                        disabled={isRegistering || parseFloat(userACBalance) < parseFloat(requiredAC)}
                        className={`py-2 px-4 rounded-lg font-bold text-sm transition-all duration-300 ${
                          isRegistering 
                            ? "bg-gray-700 cursor-not-allowed" 
                            : parseFloat(userACBalance) < parseFloat(requiredAC)
                              ? "bg-gray-700 cursor-not-allowed"
                              : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        }`}
                      >
                        {isRegistering ? "Registering..." : "Register for Whitelist"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 用户交互区 */}
            <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h2 className="text-2xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                Your Participation
              </h2>
              
              {isConnected ? (
                <div className="space-y-6">
                  {/* 个人参与信息 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                      <div className="text-gray-400 text-sm mb-1">Your Allocation</div>
                      <div className="font-bold">{userRemainingAmount || "0"} TOKEN</div>
                    </div>
                    
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                      <div className="text-gray-400 text-sm mb-1">Purchased</div>
                      <div className="font-bold">{userPurchasedAmount || "0"} TOKEN</div>
                    </div>
                    
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                      <div className="text-gray-400 text-sm mb-1">Claimable</div>
                      <div className="font-bold">0 TOKEN</div>
                    </div>
                  </div>
                  
                  {/* 购买操作 */}
                  <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-bold mb-4 text-purple-300">Purchase Tokens</h3>
                    
                    <div className="mb-4">
                      <label className="block text-gray-400 text-sm mb-2">
                        Amount to Purchase (TOKEN)
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          value={purchaseAmount}
                          onChange={(e) => setPurchaseAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-gray-900 border border-gray-700 rounded-l-lg py-3 px-4 text-white focus:outline-none focus:border-purple-500"
                          disabled={isProcessing}
                        />
                        <button 
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-r-lg"
                          onClick={() => setPurchaseAmount(userRemainingAmount)}
                          disabled={isProcessing}
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      {parseFloat(paymentTokenAllowance) < parseFloat(purchaseAmount || "0") ? (
                        <button
                          onClick={handleApprove}
                          disabled={isProcessing || !purchaseAmount}
                          className={`py-3 px-6 rounded-lg font-bold transition-all duration-300 ${
                            isProcessing || !purchaseAmount
                              ? "bg-gray-700 cursor-not-allowed"
                              : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                          }`}
                        >
                          {isProcessing ? "Processing..." : "Approve USDT"}
                        </button>
                      ) : (
                        <button
                          onClick={handlePurchase}
                          disabled={isProcessing || !purchaseAmount || !isUserWhitelisted}
                          className={`py-3 px-6 rounded-lg font-bold transition-all duration-300 ${
                            isProcessing || !purchaseAmount || !isUserWhitelisted
                              ? "bg-gray-700 cursor-not-allowed"
                              : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                          }`}
                        >
                          {isProcessing ? "Processing..." : "Purchase Tokens"}
                        </button>
                      )}
                      
                      <button
                        className="py-3 px-6 rounded-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all duration-300"
                        disabled={isProcessing}
                      >
                        Claim Tokens
                      </button>
                    </div>
                  </div>
                  
                  {/* 操作状态反馈 */}
                  {actionStatus === "success" && (
                    <div className="p-4 bg-green-900/30 border border-green-800 rounded-lg text-center">
                      <p className="text-green-400 font-bold">✓ Transaction successful!</p>
                    </div>
                  )}
                  
                  {actionStatus === "error" && (
                    <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-center">
                      <p className="text-red-400 font-bold">✗ Transaction failed! Please try again.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Connect your wallet to participate in the sale</p>
                  <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.5)] transform hover:scale-105">
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}