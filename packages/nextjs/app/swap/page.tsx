"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatEther, isAddress, parseEther } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

// ABI básico de ERC20
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
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const SwapPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [tokenAAddress, setTokenAAddress] = useState("");
  const [tokenBAddress, setTokenBAddress] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [amountOutMin, setAmountOutMin] = useState("");
  const [estimatedAmountOut, setEstimatedAmountOut] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState("0.5"); // 0.5%

  // Estados para balances y allowances
  const [tokenABalance, setTokenABalance] = useState<string>("0");
  const [tokenBBalance, setTokenBBalance] = useState<string>("0");
  const [tokenAAllowance, setTokenAAllowance] = useState<string>("0");
  const [tokenASymbol, setTokenASymbol] = useState<string>("Token A");
  const [tokenBSymbol, setTokenBSymbol] = useState<string>("Token B");

  // Información del contrato SimpleSwap
  const simpleSwapInfo = useDeployedContractInfo({ contractName: "SimpleSwap" });

  // Hook para escribir al contrato SimpleSwap
  const { writeContractAsync: writeSimpleSwap, isMining } = useScaffoldWriteContract({
    contractName: "SimpleSwap",
  });

  // Para approvals de tokens ERC20
  const { writeContract: writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Validar que las direcciones sean válidas
  const isTokenAValid = tokenAAddress && isAddress(tokenAAddress);
  const isTokenBValid = tokenBAddress && isAddress(tokenBAddress);
  const areTokensDifferent = tokenAAddress !== tokenBAddress && tokenAAddress && tokenBAddress;

  const { data: reservesData } = useScaffoldReadContract({
    contractName: "SimpleSwap",
    functionName: "reserves",
    args:
      isTokenAValid && isTokenBValid && areTokensDifferent
        ? [
            tokenAAddress < tokenBAddress ? tokenAAddress : tokenBAddress,
            tokenAAddress < tokenBAddress ? tokenBAddress : tokenAAddress,
          ]
        : undefined,
  });

  const { data: priceData } = useScaffoldReadContract({
    contractName: "SimpleSwap",
    functionName: "getPrice",
    args: isTokenAValid && isTokenBValid && areTokensDifferent ? [tokenAAddress, tokenBAddress] : undefined,
  });

  // Hook de Scaffold-ETH para obtener estimación real
  const { data: amountOutData } = useScaffoldReadContract({
    contractName: "SimpleSwap",
    functionName: "getAmountOut",
    args:
      amountIn && reservesData && reservesData[0] > 0
        ? [
            parseEther(amountIn),
            tokenAAddress < tokenBAddress ? reservesData[0] : reservesData[1], // reserveIn
            tokenAAddress < tokenBAddress ? reservesData[1] : reservesData[0], // reserveOut
          ]
        : undefined,
  });

  // Hooks para leer datos de los tokens
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

  const { data: tokenASymbolData } = useReadContract({
    address: isTokenAValid ? tokenAAddress : undefined,
    abi: ERC20_ABI,
    functionName: "symbol",
  });

  const { data: tokenBSymbolData } = useReadContract({
    address: isTokenBValid ? tokenBAddress : undefined,
    abi: ERC20_ABI,
    functionName: "symbol",
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
    if (tokenASymbolData) {
      setTokenASymbol(tokenASymbolData);
    }
  }, [tokenASymbolData]);

  useEffect(() => {
    if (tokenBSymbolData) {
      setTokenBSymbol(tokenBSymbolData);
    }
  }, [tokenBSymbolData]);

  const calculateRealEstimation = useCallback(async () => {
    if (!amountIn || !isTokenAValid || !isTokenBValid || !areTokensDifferent || !reservesData) {
      setEstimatedAmountOut("");
      setAmountOutMin("");
      return;
    }

    // Verificar si el pool existe
    const [reserveA, reserveB] = reservesData;
    if (!reserveA || !reserveB || reserveA === 0n || reserveB === 0n) {
      setEstimatedAmountOut("Pool doesn't exist");
      setAmountOutMin("");
      return;
    }

    // Usar la estimación del contrato si está disponible
    if (amountOutData) {
      const estimatedOut = formatEther(amountOutData);
      setEstimatedAmountOut(estimatedOut);

      // Auto-calcular amountOutMin basado en slippage
      const autoMinAmount = calculateMinAmount(estimatedOut, slippageTolerance);
      setAmountOutMin(autoMinAmount);
    }
  }, [amountIn, isTokenAValid, isTokenBValid, areTokensDifferent, reservesData, amountOutData, slippageTolerance]);

  const getPoolInfo = () => {
    if (!reservesData) return null;

    const [reserveA, reserveB] = reservesData;
    const token0 = tokenAAddress < tokenBAddress ? tokenAAddress : tokenBAddress;
    const token1 = tokenAAddress < tokenBAddress ? tokenBAddress : tokenAAddress;

    return {
      reserve0: formatEther(reserveA),
      reserve1: formatEther(reserveB),
      token0Symbol: token0 === tokenAAddress ? tokenASymbol : tokenBSymbol,
      token1Symbol: token1 === tokenAAddress ? tokenASymbol : tokenBSymbol,
      exists: reserveA > 0n && reserveB > 0n,
    };
  };

  const calculatePriceImpact = (amountIn: string, amountOut: string) => {
    if (!priceData || !amountIn || !amountOut) return "0";

    const price = parseFloat(formatEther(priceData));
    const amountInNum = parseFloat(amountIn);
    const amountOutNum = parseFloat(amountOut);

    const expectedOut = amountInNum * price;
    const impact = ((expectedOut - amountOutNum) / expectedOut) * 100;

    return Math.abs(impact).toFixed(2);
  };

  // Validación antes del swap
  const validateSwap = () => {
    const poolInfo = getPoolInfo();

    if (!poolInfo?.exists) {
      notification.error("Pool doesn't exist for this token pair");
      return false;
    }

    if (!connectedAddress || !isTokenAValid || !isTokenBValid || !amountIn || !areTokensDifferent) {
      notification.error("Please fill all fields with valid token addresses");
      return false;
    }

    // Verificar balance suficiente
    const amountInWei = parseEther(amountIn);
    if (tokenABalanceData && BigInt(tokenABalanceData) < amountInWei) {
      notification.error("Insufficient token balance");
      return false;
    }

    // Verificar allowance
    if (needsApproval()) {
      notification.error("Token allowance insufficient. Please approve first.");
      return false;
    }

    return true;
  };

  // Función para calcular cantidades mínimas con slippage
  const calculateMinAmount = (amount: string, slippage: string) => {
    if (!amount || !slippage) return "0";
    const amountNum = parseFloat(amount);
    const slippageNum = parseFloat(slippage);
    const minAmount = amountNum * (1 - slippageNum / 100);
    return minAmount.toFixed(6);
  };

  // Calcular estimación cuando cambian los inputs
  useEffect(() => {
    calculateRealEstimation();
  }, [calculateRealEstimation]);

  // Función para aprobar Token A
  const handleApproveTokenA = async () => {
    if (!amountIn || !simpleSwapInfo.data?.address) {
      notification.error("Please enter amount first");
      return;
    }
    try {
      writeContract({
        address: tokenAAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [simpleSwapInfo.data.address, parseEther(amountIn)],
      });
    } catch {
      notification.error("Failed to approve token");
    }
  };

  // Verificar si necesita approval
  const needsApproval = () => {
    if (!amountIn || !tokenAAllowanceData) return false;
    const amountInWei = parseEther(amountIn);
    return BigInt(tokenAAllowanceData) < amountInWei;
  };

  const handleSwap = async () => {
    if (!validateSwap()) return;

    try {
      // Convertir las cantidades a wei
      const amountOutMinWei = parseEther(amountOutMin || "0");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      const path = [tokenAAddress, tokenBAddress];

      await writeSimpleSwap({
        functionName: "swapExactTokensForTokens",
        args: [parseEther(amountIn), amountOutMinWei, path, connectedAddress, deadline],
      });

      notification.success("Swap executed successfully!");

      // Limpiar formulario
      setAmountIn("");
      setAmountOutMin("");
      setEstimatedAmountOut("");
    } catch (error) {
      console.error("Error executing swap:", error);
      notification.error("Failed to execute swap");
    }
  };

  const handleSwitchTokens = () => {
    setTokenAAddress(tokenBAddress);
    setTokenBAddress(tokenAAddress);
    setAmountIn("");
    setAmountOutMin("");
    setEstimatedAmountOut("");
  };

  // Mostrar notificaciones cuando las transacciones se completen
  useEffect(() => {
    if (isSuccess) {
      notification.success("Approval completed successfully!");
    }
  }, [isSuccess]);

  const poolInfo = getPoolInfo();
  const realPriceImpact = calculatePriceImpact(amountIn, estimatedAmountOut);

  const PoolInfo = () => {
    if (!poolInfo) return null;

    return (
      <div className="bg-base-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">Pool Information</h3>
        {poolInfo.exists ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{poolInfo.token0Symbol} Reserve:</span>
              <span>{parseFloat(poolInfo.reserve0).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>{poolInfo.token1Symbol} Reserve:</span>
              <span>{parseFloat(poolInfo.reserve1).toFixed(4)}</span>
            </div>
            {priceData && (
              <div className="flex justify-between">
                <span>
                  Price ({tokenBSymbol}/{tokenASymbol}):
                </span>
                <span>{parseFloat(formatEther(priceData)).toFixed(6)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-warning text-sm">{"Pool doesn't exist for this pair"}</p>
        )}
      </div>
    );
  };

  const SwapDetails = () => {
    if (!amountIn || !estimatedAmountOut) return null;

    return (
      <div className="bg-base-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">Swap Details</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Input Amount:</span>
            <span>
              {amountIn} {tokenASymbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Estimated Output:</span>
            <span>
              {estimatedAmountOut} {tokenBSymbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Minimum Output:</span>
            <span>
              {amountOutMin} {tokenBSymbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Price Impact:</span>
            <span className={parseFloat(realPriceImpact) > 5 ? "text-warning" : ""}>{realPriceImpact}%</span>
          </div>
          <div className="flex justify-between">
            <span>Slippage Tolerance:</span>
            <span>{slippageTolerance}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 px-4">
      <div className="bg-base-100 rounded-3xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Token Swap</h1>

        {/* Slippage Tolerance */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Slippage Tolerance (%)</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.5"
              value={slippageTolerance}
              onChange={e => setSlippageTolerance(e.target.value)}
              className="input input-bordered flex-1"
              step="0.1"
              min="0"
              max="50"
            />
            <div className="flex gap-1">
              <button
                className={`btn btn-xs ${slippageTolerance === "0.1" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSlippageTolerance("0.1")}
              >
                0.1%
              </button>
              <button
                className={`btn btn-xs ${slippageTolerance === "0.5" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSlippageTolerance("0.5")}
              >
                0.5%
              </button>
              <button
                className={`btn btn-xs ${slippageTolerance === "1.0" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSlippageTolerance("1.0")}
              >
                1%
              </button>
            </div>
          </div>
        </div>

        {/* Token A Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">From</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="0.0"
              value={amountIn}
              onChange={e => setAmountIn(e.target.value)}
              className="input input-bordered flex-1"
            />
            <input
              type="text"
              placeholder="0x..."
              value={tokenAAddress}
              onChange={e => setTokenAAddress(e.target.value)}
              className={`input input-bordered flex-1 ${tokenAAddress && !isTokenAValid ? "input-error" : ""}`}
            />
          </div>
          {tokenAAddress && !isTokenAValid && <p className="text-error text-xs mt-1">Invalid token address</p>}
          {isTokenAValid && (
            <div className="mt-2 text-sm text-base-content/70">
              <div className="flex justify-between">
                <span>Symbol: {tokenASymbol}</span>
                <span>Balance: {parseFloat(tokenABalance).toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Allowance: {parseFloat(tokenAAllowance).toFixed(4)}</span>
                {needsApproval() && <span className="text-warning">Approval needed</span>}
              </div>
            </div>
          )}
        </div>

        {/* Approval Button */}
        {isTokenAValid && needsApproval() && (
          <div className="mb-6">
            <button
              className="btn btn-secondary w-full"
              onClick={handleApproveTokenA}
              disabled={!amountIn || isConfirming}
            >
              {isConfirming ? "Approving..." : `Approve ${tokenASymbol}`}
            </button>
          </div>
        )}

        {/* Swap Arrow */}
        <div className="flex justify-center mb-6">
          <button
            className="btn btn-circle btn-outline"
            onClick={handleSwitchTokens}
            disabled={!tokenAAddress || !tokenBAddress}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>

        {/* Token B Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">To (estimated)</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="0.0"
              value={estimatedAmountOut}
              className="input input-bordered flex-1"
              readOnly
            />
            <input
              type="text"
              placeholder="0x..."
              value={tokenBAddress}
              onChange={e => setTokenBAddress(e.target.value)}
              className={`input input-bordered flex-1 ${tokenBAddress && !isTokenBValid ? "input-error" : ""}`}
            />
          </div>
          {tokenBAddress && !isTokenBValid && <p className="text-error text-xs mt-1">Invalid token address</p>}
          {isTokenBValid && (
            <div className="mt-2 text-sm text-base-content/70">
              <div className="flex justify-between">
                <span>Symbol: {tokenBSymbol}</span>
                <span>Balance: {parseFloat(tokenBBalance).toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Minimum Amount Out */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Minimum Amount Out</label>
          <input
            type="text"
            placeholder="Auto-calculated"
            value={amountOutMin}
            onChange={e => setAmountOutMin(e.target.value)}
            className="input input-bordered w-full"
          />
          <p className="text-xs text-gray-600 mt-1">
            Auto-calculated based on slippage tolerance. You can override this value.
          </p>
        </div>

        <PoolInfo />

        <SwapDetails />

        {/* Error Messages */}
        {!areTokensDifferent && tokenAAddress && tokenBAddress && (
          <div className="alert alert-warning mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span>Token A and Token B must be different addresses</span>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={
            !connectedAddress ||
            !isTokenAValid ||
            !isTokenBValid ||
            !amountIn ||
            !areTokensDifferent ||
            isMining ||
            needsApproval()
          }
          className="btn btn-primary w-full mb-4"
        >
          {!connectedAddress
            ? "Connect Wallet"
            : needsApproval()
              ? "Approve Token First"
              : isMining
                ? "Swapping..."
                : "Swap Tokens"}
        </button>

        {/* Connected Address */}
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Connected Address:</p>
          <Address address={connectedAddress} />
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link href="/" className="link link-primary">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SwapPage;
