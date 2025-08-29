"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { isConnected, account, connectWallet, disconnectWallet } = useWallet();

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleCardHover = (index: number | null) => {
    setHoveredCard(index);
  };

  const formatAddress = (address: string | null) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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

      {/* Hero Section */}
      <section className="text-center py-20 px-4 relative z-10">
        <div className={`transition-all duration-1000 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-4xl md:text-7xl font-extrabold mb-6">
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-500 mb-4">
              FROM ASH,
            </span>
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500">
              WE RISE.
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto font-medium">
            The Birthplace of Giants - Launching the next generation of blockchain projects
          </p>
        </div>
        
        {/* Key Metrics */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12 transition-all duration-1000 delay-300 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
          {[
            { value: '10M+', label: 'Total Raised' },
            { value: '150+', label: 'Total Projects' },
            { value: '50K+', label: 'Total Users' },
            { value: '15.6x', label: 'Average ROI' }
          ].map((metric, index) => (
            <div 
              key={index}
              className="p-4 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 group"
              onMouseEnter={() => handleCardHover(index)}
              onMouseLeave={() => handleCardHover(null)}
            >
              <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-1">
                {metric.value}
              </div>
              <div className="text-gray-400 group-hover:text-cyan-300 transition-colors duration-300">
                {metric.label}
              </div>
              <div className={`h-1 mt-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500 ${hoveredCard === index ? 'w-full' : 'w-0'}`}></div>
            </div>
          ))}
        </div>
        
        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row justify-center gap-4 transition-all duration-1000 delay-500 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
          <button 
            onClick={connectWallet}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.5)] transform hover:scale-105"
          >
            {isConnected ? "Connected" : "Connect Wallet"}
          </button>
          <button className="bg-transparent hover:bg-gray-800/50 text-white font-bold py-3 px-8 rounded-full text-lg border-2 border-cyan-500 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            View Live Sales
          </button>
        </div>
      </section>

      {/* Live & Upcoming Sales */}
      <section className="py-16 px-4 relative z-10">
        <h2 className="text-3xl font-extrabold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
          Live & Upcoming Sales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Project Card 1 */}
          <div 
            className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 group transform hover:-translate-y-2"
            onMouseEnter={() => handleCardHover(10)}
            onMouseLeave={() => handleCardHover(null)}
          >
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-cyan-400 rounded-xl w-16 h-16 mr-4 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
              <div>
                <h3 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">Project Alpha</h3>
                <p className="text-gray-400">Revolutionary DeFi Protocol</p>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>IDO</span>
                <span>50% funded</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-purple-600 to-cyan-500 h-2.5 rounded-full" style={{ width: "50%" }}></div>
              </div>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <div>
                <div className="text-gray-400">Registration</div>
                <div className="text-cyan-300">Aug 30 - Sep 5</div>
              </div>
              <div>
                <div className="text-gray-400">Sale</div>
                <div className="text-cyan-300">Sep 10 - Sep 12</div>
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50">
              Register Now
            </button>
          </div>
          
          {/* Project Card 2 */}
          <div 
            className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 group transform hover:-translate-y-2"
            onMouseEnter={() => handleCardHover(11)}
            onMouseLeave={() => handleCardHover(null)}
          >
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-500 border-2 border-purple-400 rounded-xl w-16 h-16 mr-4 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
              <div>
                <h3 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">Project Beta</h3>
                <p className="text-gray-400">NFT Gaming Platform</p>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>IGO</span>
                <span>30% funded</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-cyan-600 to-purple-500 h-2.5 rounded-full" style={{ width: "30%" }}></div>
              </div>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <div>
                <div className="text-gray-400">Registration</div>
                <div className="text-cyan-300">Sep 5 - Sep 10</div>
              </div>
              <div>
                <div className="text-gray-400">Sale</div>
                <div className="text-cyan-300">Sep 15 - Sep 17</div>
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-700 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 border border-cyan-500/30 hover:border-cyan-500/50">
              Register Now
            </button>
          </div>
          
          {/* Project Card 3 */}
          <div 
            className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800 hover:border-pink-500/50 transition-all duration-300 group transform hover:-translate-y-2"
            onMouseEnter={() => handleCardHover(12)}
            onMouseLeave={() => handleCardHover(null)}
          >
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-br from-pink-500 to-purple-500 border-2 border-cyan-400 rounded-xl w-16 h-16 mr-4 flex items-center justify-center shadow-[0_0_10px_rgba(236,72,153,0.5)]" />
              <div>
                <h3 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Project Gamma</h3>
                <p className="text-gray-400">Cross-chain Bridge</p>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>INO</span>
                <span>75% funded</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-pink-600 to-purple-500 h-2.5 rounded-full" style={{ width: "75%" }}></div>
              </div>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <div>
                <div className="text-gray-400">Registration</div>
                <div className="text-cyan-300">Aug 25 - Aug 31</div>
              </div>
              <div>
                <div className="text-gray-400">Sale</div>
                <div className="text-cyan-300">Sep 5 - Sep 7</div>
              </div>
            </div>
            <button className="w-full bg-gradient-to-r from-pink-600/80 to-purple-600/80 hover:from-pink-700 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 border border-pink-500/30 hover:border-pink-500/50">
              View Details
            </button>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="py-16 px-4 bg-gray-900/30 relative z-10">
        <h2 className="text-3xl font-extrabold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
          Your Four Pillars
        </h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Explore our platform's core features and how they work together to maximize your investment potential
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {[
            { title: 'AirDrop', desc: 'Get free tokens from upcoming projects', link: '/airdrop' },
            { title: 'Farming', desc: 'Earn passive income by providing liquidity', link: '/farming' },
            { title: 'Staking', desc: 'Stake $ASH to gain benefits and rewards', link: '/staking' },
            { title: 'Sales', desc: 'Participate in exclusive token sales', link: '/sales' }
          ].map((feature, index) => (
            <div 
              key={index}
              className="text-center p-6 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 group"
              onMouseEnter={() => handleCardHover(20 + index)}
              onMouseLeave={() => handleCardHover(null)}
            >
              <div className="bg-gradient-to-br from-purple-500 to-cyan-500 border-2 border-cyan-400 rounded-xl w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.7)] transition-all duration-300 transform group-hover:scale-110" />
              <h3 className="text-xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                {feature.title}
              </h3>
              <p className="text-gray-400 mb-4 group-hover:text-cyan-300 transition-colors duration-300">
                {feature.desc}
              </p>
              <Link href={feature.link} className="text-cyan-400 hover:text-cyan-300 font-bold group-hover:translate-x-2 transition-transform duration-300">
                Enter →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Token Utility */}
      <section className="py-16 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
            Token Utility - $ASH
          </h2>
          <p className="text-gray-400 text-center mb-12">
            Our native token empowers users with various benefits across the platform
          </p>
          
          <div className="space-y-6">
            {[
              { num: '1', title: 'Governance', desc: 'Stake and vote on which projects get listed on our platform' },
              { num: '2', title: 'Access Control', desc: 'Stake a certain amount of $ASH to participate in premium sales' },
              { num: '3', title: 'Fee Discounts', desc: 'Use $ASH to pay for fees with up to 50% discount' },
              { num: '4', title: 'Revenue Sharing', desc: 'Part of our platform revenue is distributed to $ASH stakers' }
            ].map((item, index) => (
              <div 
                key={index}
                className="flex items-start p-4 rounded-xl hover:bg-gray-900/30 transition-all duration-300 group border border-gray-800 hover:border-purple-500/30"
                onMouseEnter={() => handleCardHover(30 + index)}
                onMouseLeave={() => handleCardHover(null)}
              >
                <div className="bg-gradient-to-br from-purple-600 to-cyan-500 rounded-full w-12 h-12 flex items-center justify-center mr-6 flex-shrink-0 shadow-[0_0_10px_rgba(139,92,246,0.5)] group-hover:shadow-[0_0_20px_rgba(139,92,246,0.7)] transition-all duration-300 transform group-hover:rotate-12">
                  <span className="text-xl font-extrabold">{item.num}</span>
                </div>
                <div>
                  <h3 className="text-xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 group-hover:from-cyan-400 group-hover:to-purple-400">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 group-hover:text-cyan-300 transition-colors duration-300">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-16 px-4 bg-gray-900/30 relative z-10">
        <h2 className="text-3xl font-extrabold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
          Roadmap
        </h2>
        
        <div className="max-w-4xl mx-auto">
          <div className="space-y-12">
            {[
              { quarter: 'Q1 2024', items: ['Website launch and community building', 'Seed funding round', 'Smart contract development'], completed: true },
              { quarter: 'Q2 2024', items: ['$ASH token launch and listing on DEX', 'First IDO launch', 'Partnership with 3 major projects'], completed: true },
              { quarter: 'Q3 2024', items: ['Launch of v2 with multi-chain support', 'Staking platform release', 'Mobile app beta launch'], completed: true },
              { quarter: 'Q4 2024 (Planned)', items: ['Cross-chain bridge implementation', 'DAO governance launch', 'CEX listings for $ASH'], completed: false }
            ].map((quarter, index) => (
              <div key={index} className="flex group">
                <div className="flex flex-col items-center mr-6">
                  <div className={`w-6 h-6 rounded-full ${quarter.completed ? 'bg-gradient-to-br from-purple-500 to-cyan-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'bg-gray-700'} flex items-center justify-center`}>
                    {quarter.completed && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                  <div className={`h-full w-0.5 ${index === 3 ? 'bg-gray-700' : 'bg-gradient-to-b from-purple-500 to-cyan-500'}`}></div>
                </div>
                <div className="pb-12">
                  <h3 className={`text-xl font-extrabold mb-3 ${quarter.completed ? 'text-cyan-300' : 'text-gray-500'}`}>
                    {quarter.quarter}
                  </h3>
                  <ul className="space-y-2">
                    {quarter.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start">
                        <span className={`mr-2 mt-1 w-2 h-2 rounded-full ${quarter.completed ? 'bg-cyan-400' : 'bg-gray-600'}`}></span>
                        <span className={quarter.completed ? 'text-gray-300' : 'text-gray-600'}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 text-center relative z-10">
        <h2 className="text-3xl md:text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-500">
          Ready to Launch Your Project?
        </h2>
        <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
          Join our platform and get access to our community of investors and supporters
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.5)] transform hover:scale-105">
            Apply for IDO
          </button>
          <button className="bg-transparent hover:bg-gray-800/50 text-white font-bold py-3 px-8 rounded-full text-lg border-2 border-cyan-500 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            View Documentation
          </button>
        </div>
      </section>
    </div>
  );
}