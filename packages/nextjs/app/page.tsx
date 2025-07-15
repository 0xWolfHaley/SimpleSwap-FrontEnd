"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { useWriteContract } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";
import { parseEther } from "viem";

const backgroundStyle = {
  backgroundImage: `
      linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 25%),
      url("https://pbs.twimg.com/profile_images/1787545282990764032/8lK0ob6w_400x400.jpg")
    `,
};

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  
  // Obtener los contratos deployados
  const { data: tokenAContract } = useScaffoldContract({
    contractName: "TokenA",
  });
  const { data: tokenBContract } = useScaffoldContract({
    contractName: "TokenB",
  });

  const { 
    writeContract,  
    isPending: isMintPending,
  } = useWriteContract();

  const handleMint = async (tokenContract: any, tokenName: string) => {
    if (!connectedAddress) {
      notification.error("Please connect your wallet first");
      return;
    }
    
    if (!tokenContract?.address) {
      notification.error(`${tokenName} contract not found`);
      return;
    }
    
    try {
      await writeContract({
        address: tokenContract.address,
        abi: tokenContract.abi,
        functionName: "mint",
        args: [connectedAddress, parseEther("1000")],
      });
      notification.success(`Mint transaction sent for ${tokenName}`);
    } catch (error) {
      console.error(`Error minting ${tokenName}:`, error);
      notification.error(`Failed to mint ${tokenName}`);
    }
  };

    return (
    <>
      <div className="px-60 flex flex-1 justify-center py-5">
        <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
          <div className="@container">
            <div className="@[480px]:px-4 @[480px]:py-3">
              <div
                className="bg-cover bg-center flex flex-col justify-end overflow-hidden bg-[#121417] @[480px]:rounded-xl min-h-80"
                style={backgroundStyle}
              >
                <div className="flex justify-center p-2">
                  <p className="text-white tracking-light text-[24px] font-bold leading-tight">Welcome to</p>
                </div>
                <div className="flex justify-center p-4 mb-8">
                  <p className="text-white tracking-light text-[60px] font-bold leading-tight">SimpleSwap</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-white text-base font-normal leading-normal pb-3 pt-1 px-4 text-center">
            Trade tokens instantly. Provide liquidity to earn fees from trades.
          </p>
          <div className="flex justify-center items-center space-x-2 flex-col pb-3 px-4">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} />
          </div>
          <div className="flex justify-center mt-2">
            <div className="flex flex-1 gap-3 flex-wrap px-4 py-3 max-w-[480px] justify-center">
              <Link href={"/swap"} passHref>
                <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-5 bg-[#adc7ea] text-[#121417] text-base font-bold leading-normal tracking-[0.015em] grow">
                  <span className="truncate">Swap Tokens</span>
                </button>
              </Link>
              <Link href={"/liquidity"} passHref>
                <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-5 bg-[#2b3036] text-white text-base font-bold leading-normal tracking-[0.015em] grow">
                  <span className="truncate">Add Liquidity</span>
                </button>
              </Link>
              <button 
                onClick={() => handleMint(tokenAContract, "Token A")}
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-5 bg-[#4CAF50] text-white text-base font-bold leading-normal tracking-[0.015em] grow"
                disabled={!connectedAddress || isMintPending || !tokenAContract}
              >
                {isMintPending ? "Minting..." : "Mint 1000 Token A"}
              </button>
              <button 
                onClick={() => handleMint(tokenBContract, "Token B")}
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-5 bg-[#2196F3] text-white text-base font-bold leading-normal tracking-[0.015em] grow"
                disabled={!connectedAddress || isMintPending || !tokenBContract}
              >
                {isMintPending ? "Minting..." : "Mint 1000 Token B"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
