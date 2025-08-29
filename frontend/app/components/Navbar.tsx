"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

const Navbar = () => {
  const pathname = usePathname();
  const { isConnected, account, connectWallet, disconnectWallet } = useWallet();

  const formatAddress = (address: string | null) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Airdrops", path: "/airdrop" },
    { name: "Farming", path: "/farming" },
    { name: "Sales", path: "/sales" },
  ];

  return (
    <nav className="flex items-center justify-between p-6 relative z-10 border-b border-gray-900 bg-black text-white">
      <div className="flex items-center space-x-2">
        <div className="bg-gradient-to-br from-purple-500 to-blue-500 border-2 border-cyan-400 rounded-xl w-16 h-16 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
          <span className="text-2xl font-bold text-white">A</span>
        </div>
        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
          AshLaunch
        </span>
      </div>
      <div className="hidden md:flex space-x-8">
        {navItems.map((item, index) => (
          <Link 
            key={index} 
            href={item.path}
            className={`font-bold transition-all duration-300 relative group ${
              pathname === item.path 
                ? "text-cyan-400" 
                : "hover:text-cyan-400"
            }`}
          >
            {item.name}
            <span className={`absolute -bottom-1 left-0 h-0.5 bg-cyan-400 transition-all duration-300 ${
              pathname === item.path ? "w-full" : "w-0 group-hover:w-full"
            }`}></span>
          </Link>
        ))}
      </div>
      <button 
        onClick={isConnected ? disconnectWallet : connectWallet}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2 px-6 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.5)] transform hover:scale-105"
      >
        {isConnected ? formatAddress(account) : "Connect Wallet"}
      </button>
    </nav>
  );
};

export default Navbar;