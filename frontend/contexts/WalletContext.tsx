"use client";

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { ethers } from 'ethers';

type WalletContextType = {
  isConnected: boolean;
  account: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    // 检查本地存储中是否有已连接的账户
    const storedAccount = localStorage.getItem('connectedAccount');
    if (storedAccount) {
      setAccount(storedAccount);
      setIsConnected(true);
    }
  }, []);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('MetaMask is not installed!');
        return;
      }

      // 请求账户访问权限
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const connectedAccount = ethers.utils.getAddress(accounts[0]);
      setAccount(connectedAccount);
      setIsConnected(true);
      
      // 将账户信息存储在本地存储中
      localStorage.setItem('connectedAccount', connectedAccount);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    localStorage.removeItem('connectedAccount');
  };

  return (
    <WalletContext.Provider value={{ isConnected, account, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};