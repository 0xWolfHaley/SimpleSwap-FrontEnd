import { Contract, getAddress } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploySimpleSwapContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` or `yarn account:import` to import your
    existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const tokenADeploy = await deploy("TokenA", {
    from: deployer,
    contract: "TestToken",
    args: ["Token A", "TKA", 1000000],
    log: true,
    autoMine: true,
  });

  const tokenBDeploy = await deploy("TokenB", {
    from: deployer,
    contract: "TestToken",
    args: ["Token B", "TKB", 1000000],
    log: true,
    autoMine: true,
  });

  const simpleSwapDeploy = await deploy("SimpleSwap", {
    from: deployer,
    args: ["0x6080164AE22d7b1b4e8f3A6808aAE90f1c61f4A3"],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const tokenA = await hre.ethers.getContract<Contract>("TokenA", deployer);
  const tokenB = await hre.ethers.getContract<Contract>("TokenB", deployer);
  const simpleSwap = await hre.ethers.getContract<Contract>("SimpleSwap", deployer);

  console.log("✅ Contracts deployed:");
  console.log("📄 Token A:", tokenADeploy.address);
  console.log("📄 Token B:", tokenBDeploy.address);
  console.log("📄 SimpleSwap:", simpleSwapDeploy.address);
};

export default deploySimpleSwapContract;

deploySimpleSwapContract.tags = ["SimpleSwap", "TestToken"];
