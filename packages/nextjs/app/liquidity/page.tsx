"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatEther, isAddress, parseEther } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

// ABI básico de ERC20 (solo las funciones que necesitamos)
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const PoolPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [tokenAAddress, setTokenAAddress] = useState("");
  const [tokenBAddress, setTokenBAddress] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  // Estados adicionales para remove liquidity
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [minAmountA, setMinAmountA] = useState("");
  const [minAmountB, setMinAmountB] = useState("");

  // Estados para slippage tolerance
  const [slippageTolerance, setSlippageTolerance] = useState("0.5"); // 0.5%

  // Estados para balances y allowances
  const [tokenABalance, setTokenABalance] = useState<string>("0");
  const [tokenBBalance, setTokenBBalance] = useState<string>("0");
  const [tokenAAllowance, setTokenAAllowance] = useState<string>("0");
  const [tokenBAllowance, setTokenBAllowance] = useState<string>("0");

  const simpleSwapInfo = useDeployedContractInfo({ contractName: "SimpleSwap" });

  // Validaciones
  const isTokenAValid = isAddress(tokenAAddress);
  const isTokenBValid = isAddress(tokenBAddress);
  const areTokensDifferent =
    tokenAAddress.toLowerCase() !== tokenBAddress.toLowerCase() && tokenAAddress && tokenBAddress;

  // Función para calcular deadline (20 minutos desde ahora)
  const getDeadline = () => {
    return BigInt(Math.floor(Date.now() / 1000) + 20 * 60); // 20 minutos
  };

  // Función para calcular cantidades mínimas con slippage
  const calculateMinAmount = (amount: string, slippage: string) => {
    if (!amount || !slippage) return "0";
    const amountNum = parseFloat(amount);
    const slippageNum = parseFloat(slippage);
    const minAmount = amountNum * (1 - slippageNum / 100);
    return minAmount.toString();
  };

  // Hooks para leer datos de los tokens usando wagmi directamente
  const { data: tokenABalanceData } = useReadContract({
    address: isTokenAValid ? tokenAAddress : undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  const { data: tokenBBalanceData } = useReadContract({
    address: isTokenBValid ? tokenBAddress : undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  const { data: tokenAAllowanceData } = useReadContract({
    address: isTokenAValid ? tokenAAddress : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      connectedAddress && simpleSwapInfo.data?.address ? [connectedAddress, simpleSwapInfo.data.address] : undefined,
  });

  const { data: tokenBAllowanceData } = useReadContract({
    address: isTokenBValid ? tokenBAddress : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      connectedAddress && simpleSwapInfo.data?.address ? [connectedAddress, simpleSwapInfo.data.address] : undefined,
  });

  // Actualizar estados cuando cambien los datos
  useEffect(() => {
    if (tokenABalanceData) {
      setTokenABalance(formatEther(tokenABalanceData));
    }
  }, [tokenABalanceData]);

  useEffect(() => {
    if (tokenBBalanceData) {
      setTokenBBalance(formatEther(tokenBBalanceData));
    }
  }, [tokenBBalanceData]);

  useEffect(() => {
    if (tokenAAllowanceData) {
      setTokenAAllowance(formatEther(tokenAAllowanceData));
    }
  }, [tokenAAllowanceData]);

  useEffect(() => {
    if (tokenBAllowanceData) {
      setTokenBAllowance(formatEther(tokenBAllowanceData));
    }
  }, [tokenBAllowanceData]);

  // Hooks para escribir contratos - USAMOS SCAFFOLD-ETH PARA SIMPLESWAP
  const { writeContractAsync: addLiquidity } = useScaffoldWriteContract({
    contractName: "SimpleSwap",
  });

  const { writeContractAsync: removeLiquidity } = useScaffoldWriteContract({
    contractName: "SimpleSwap",
  });

  // Para los tokens ERC20 usamos wagmi directamente
  const { writeContract: writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleApproveTokenA = async () => {
    if (!amountA || !simpleSwapInfo.data?.address) {
      notification.error("Please enter amount for Token A first");
      return;
    }
    try {
      writeContract({
        address: tokenAAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [simpleSwapInfo.data.address, parseEther(amountA)],
      });
    } catch {
      notification.error("Failed to approve Token A");
    }
  };

  const handleApproveTokenB = async () => {
    if (!amountB || !simpleSwapInfo.data?.address) {
      notification.error("Please enter amount for Token B first");
      return;
    }
    try {
      writeContract({
        address: tokenBAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [simpleSwapInfo.data.address, parseEther(amountB)],
      });
    } catch {
      notification.error("Failed to approve Token B");
    }
  };

  const handleAddLiquidity = async () => {
    if (!connectedAddress || !isTokenAValid || !isTokenBValid || !amountA || !amountB) {
      notification.error("Please fill all fields with valid token addresses");
      return;
    }

    if (!areTokensDifferent) {
      notification.error("Token A and Token B must be different");
      return;
    }

    // Verificar allowances
    const amountAWei = parseEther(amountA);
    const amountBWei = parseEther(amountB);

    if (tokenAAllowanceData && BigInt(tokenAAllowanceData) < amountAWei) {
      notification.error("Token A allowance insufficient. Please approve first.");
      return;
    }

    if (tokenBAllowanceData && BigInt(tokenBAllowanceData) < amountBWei) {
      notification.error("Token B allowance insufficient. Please approve first.");
      return;
    }

    try {
      // Calcular cantidades mínimas con slippage
      const amountAMin = parseEther(calculateMinAmount(amountA, slippageTolerance));
      const amountBMin = parseEther(calculateMinAmount(amountB, slippageTolerance));
      const deadline = getDeadline();

      // ARGS CORREGIDOS PARA ADDLIQUIDITY
      await addLiquidity({
        functionName: "addLiquidity",
        args: [
          tokenAAddress,
          tokenBAddress,
          amountAWei,
          amountBWei,
          amountAMin,
          amountBMin,
          connectedAddress,
          deadline,
        ],
      });
      notification.success("Liquidity added successfully!");
    } catch (error) {
      console.error("Error adding liquidity:", error);
      notification.error("Failed to add liquidity");
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!connectedAddress || !isTokenAValid || !isTokenBValid || !liquidityAmount || !minAmountA || !minAmountB) {
      notification.error("Please fill all fields with valid token addresses and amounts");
      return;
    }

    if (!areTokensDifferent) {
      notification.error("Token A and Token B must be different");
      return;
    }

    try {
      const deadline = getDeadline();

      // ARGS CORREGIDOS PARA REMOVELIQUIDITY
      await removeLiquidity({
        functionName: "removeLiquidity",
        args: [
          tokenAAddress,
          tokenBAddress,
          parseEther(liquidityAmount),
          parseEther(minAmountA),
          parseEther(minAmountB),
          connectedAddress,
          deadline,
        ],
      });
      notification.success("Liquidity removed successfully!");
    } catch (error) {
      console.error("Error removing liquidity:", error);
      notification.error("Failed to remove liquidity");
    }
  };

  // Mostrar notificaciones cuando las transacciones se completen
  useEffect(() => {
    if (isSuccess) {
      notification.success("Transaction completed successfully!");
    }
  }, [isSuccess]);

  return (
    <>
      <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
        <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
          <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center w-full lg:w-[600px] shadow-xl">
            <h1 className="text-4xl font-bold">Liquidity Pool</h1>
            <p className="text-base-content/60">Add or remove liquidity from the SimpleSwap pool</p>

            {/* Tabs */}
            <div className="tabs tabs-boxed mt-6">
              <button className={`tab ${activeTab === "add" ? "tab-active" : ""}`} onClick={() => setActiveTab("add")}>
                Add Liquidity
              </button>
              <button
                className={`tab ${activeTab === "remove" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("remove")}
              >
                Remove Liquidity
              </button>
            </div>

            {activeTab === "add" ? (
              <div className="w-full mt-6 space-y-4">
                {/* Slippage Tolerance */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Slippage Tolerance (%)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.5"
                    className="input input-bordered"
                    value={slippageTolerance}
                    onChange={e => setSlippageTolerance(e.target.value)}
                    step="0.1"
                    min="0"
                    max="50"
                  />
                </div>

                {/* Token A */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Token A Address</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="input input-bordered"
                    value={tokenAAddress}
                    onChange={e => setTokenAAddress(e.target.value)}
                  />
                  {isTokenAValid && (
                    <div className="mt-2 text-sm text-base-content/70">
                      <div>Balance: {tokenABalance} tokens</div>
                      <div>Allowance: {tokenAAllowance} tokens</div>
                    </div>
                  )}
                </div>

                {/* Token B */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Token B Address</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="input input-bordered"
                    value={tokenBAddress}
                    onChange={e => setTokenBAddress(e.target.value)}
                  />
                  {isTokenBValid && (
                    <div className="mt-2 text-sm text-base-content/70">
                      <div>Balance: {tokenBBalance} tokens</div>
                      <div>Allowance: {tokenBAllowance} tokens</div>
                    </div>
                  )}
                </div>

                {/* Amount A */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount Token A</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered"
                    value={amountA}
                    onChange={e => setAmountA(e.target.value)}
                  />
                  {amountA && slippageTolerance && (
                    <div className="mt-1 text-xs text-base-content/50">
                      Min amount: {calculateMinAmount(amountA, slippageTolerance)}
                    </div>
                  )}
                </div>

                {/* Amount B */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount Token B</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered"
                    value={amountB}
                    onChange={e => setAmountB(e.target.value)}
                  />
                  {amountB && slippageTolerance && (
                    <div className="mt-1 text-xs text-base-content/50">
                      Min amount: {calculateMinAmount(amountB, slippageTolerance)}
                    </div>
                  )}
                </div>

                {/* Approve Buttons */}
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary flex-1"
                    onClick={handleApproveTokenA}
                    disabled={!isTokenAValid || !amountA || isConfirming}
                  >
                    {isConfirming ? "Approving..." : "Approve Token A"}
                  </button>
                  <button
                    className="btn btn-secondary flex-1"
                    onClick={handleApproveTokenB}
                    disabled={!isTokenBValid || !amountB || isConfirming}
                  >
                    {isConfirming ? "Approving..." : "Approve Token B"}
                  </button>
                </div>

                {/* Add Liquidity Button */}
                <button
                  className="btn btn-primary w-full"
                  onClick={handleAddLiquidity}
                  disabled={
                    !connectedAddress ||
                    !isTokenAValid ||
                    !isTokenBValid ||
                    !amountA ||
                    !amountB ||
                    !areTokensDifferent ||
                    isConfirming
                  }
                >
                  {isConfirming ? "Adding Liquidity..." : "Add Liquidity"}
                </button>
              </div>
            ) : (
              <div className="w-full mt-6 space-y-4">
                {/* Remove Liquidity Form */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Token A Address</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="input input-bordered"
                    value={tokenAAddress}
                    onChange={e => setTokenAAddress(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Token B Address</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="input input-bordered"
                    value={tokenBAddress}
                    onChange={e => setTokenBAddress(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">LP Token Amount to Remove</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered"
                    value={liquidityAmount}
                    onChange={e => setLiquidityAmount(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Minimum Token A Amount</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered"
                    value={minAmountA}
                    onChange={e => setMinAmountA(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Minimum Token B Amount</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered"
                    value={minAmountB}
                    onChange={e => setMinAmountB(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary w-full"
                  onClick={handleRemoveLiquidity}
                  disabled={
                    !connectedAddress ||
                    !isTokenAValid ||
                    !isTokenBValid ||
                    !liquidityAmount ||
                    !minAmountA ||
                    !minAmountB ||
                    !areTokensDifferent ||
                    isConfirming
                  }
                >
                  {isConfirming ? "Removing Liquidity..." : "Remove Liquidity"}
                </button>
              </div>
            )}

            <div className="mt-8">
              <Link href="/" className="link">
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PoolPage;
