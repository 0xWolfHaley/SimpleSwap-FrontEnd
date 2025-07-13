import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SimpleSwap } from "../typechain-types";

const { parseEther } = ethers;

describe("SimpleSwap", () => {
  const deployContractsFixture = async () => {
    const [deployer]: HardhatEthersSigner[] = await ethers.getSigners();

    const simpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
    const simpleSwap: SimpleSwap = await simpleSwapFactory.deploy();

    return { simpleSwap };
  };

  describe("Deployment", () => {
    it("Should deploy SimpleSwap contract successfully", async () => {
      const { simpleSwap } = await loadFixture(deployContractsFixture);

      expect(simpleSwap.target).to.not.equal(0);
    });
  });
});
