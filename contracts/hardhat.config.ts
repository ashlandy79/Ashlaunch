import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
type HardhatUserConfig = import("hardhat/types").HardhatUserConfig;

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    // 本地网络配置
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    }
  }
};

export default config;