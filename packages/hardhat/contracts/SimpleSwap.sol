// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SimpleSwap
/// @author Juan Cruz Gonzalez
/// @notice A simple automated market maker (AMM) supporting basic token swaps and liquidity management

contract SimpleSwap is ERC20, Ownable {
    
   struct Reserve {
        uint reserve0;
        uint reserve1;
    }
    
    mapping(address => mapping(address => Reserve)) private reserves;

    /// @notice Emitted when liquidity is added to the pool
    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint amountA,
        uint amountB,
        uint liquidity
    );

    /// @notice Emitted when liquidity is removed from the pool
    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint amountA,
        uint amountB
    );

    /// @notice Emitted when a token swap occurs
    event TokensSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint amountIn,
        uint amountOut
    );

    /// @param initialOwner The address that will own the initial LP tokens
    constructor(address initialOwner)
        ERC20("LPToken", "LPT")
        Ownable(initialOwner)
    {}

    /// @dev Sorts token addresses to ensure consistency in storage
    function sortTokens(address tokenA, address tokenB) private pure returns (address token0, address token1) {
        require(tokenA != tokenB, "Same Token");
        require(tokenA != address(0) && tokenB != address(0), "Zero address");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    /// @notice Returns reserves for a token pair
    function getReserves(address tokenA, address tokenB) public view returns (uint reserveA, uint reserveB) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        Reserve memory r = reserves[token0][token1];
        (reserveA, reserveB) = tokenA == token0 ? (r.reserve0, r.reserve1) : (r.reserve1, r.reserve0);
    }

    /// @dev Mints LP tokens to `to` address
    function mint(address to, uint256 amount) private {
        _mint(to, amount);
    }

    /// @notice Adds liquidity to the pool
    /// @param tokenA First token address
    /// @param tokenB Second token address
    /// @param amountADesired Desired amount of tokenA
    /// @param amountBDesired Desired amount of tokenB
    /// @param amountAMin Minimum accepted amount of tokenA
    /// @param amountBMin Minimum accepted amount of tokenB
    /// @param to Address to receive LP tokens
    /// @param deadline Timestamp after which the transaction reverts
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        require(block.timestamp <= deadline, "Expired");

        (uint reserveA, uint reserveB) = getReserves(tokenA, tokenB);
    
        (amountA, amountB) = _computeLiquidityAmounts(
            reserveA, reserveB,
            amountADesired, amountBDesired,
            amountAMin, amountBMin
        );

        ERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        ERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        liquidity = calculateLiquidity(amountA, amountB, reserveA, reserveB);
        _mint(to, liquidity);

        updateReserves(tokenA, tokenB, reserveA + amountA, reserveB + amountB);
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    /// @dev Calculates optimal amounts based on reserves and user input
    function _computeLiquidityAmounts(
        uint reserveA,
        uint reserveB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) private pure returns (uint amountA, uint amountB) {
        if (reserveA == 0 && reserveB == 0) {
            return (amountADesired, amountBDesired);
        }

        uint amountBOptimal = (amountADesired * reserveB) / reserveA;

        if (amountBOptimal <= amountBDesired) {
            require(amountBOptimal >= amountBMin, "Low amount B");
            return (amountADesired, amountBOptimal);
        }

        uint amountAOptimal = (amountBDesired * reserveA) / reserveB;
        require(amountAOptimal >= amountAMin, "Low amount A");
        return (amountAOptimal, amountBDesired);
    }

    /// @dev Updates internal reserve values
    function updateReserves(address tokenA, address tokenB, uint newReserveA, uint newReserveB) private {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        Reserve storage r = reserves[token0][token1];

        if (tokenA == token0) {
            r.reserve0 = newReserveA;
            r.reserve1 = newReserveB;
        } else {
            r.reserve0 = newReserveB;
            r.reserve1 = newReserveA;
        }
    }

    /// @dev Calculates LP tokens to mint based on contribution
    function calculateLiquidity(
        uint amountA,
        uint amountB,
        uint reserveA,
        uint reserveB
    ) private view returns (uint liquidity) {
        uint _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = _sqrt(amountA * amountB);
        } else {
            require(reserveA > 0 && reserveB > 0, "Bad reserves");
            uint liquidityA = (amountA * _totalSupply) / reserveA;
            uint liquidityB = (amountB * _totalSupply) / reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;
        }

        require(liquidity > 0, "Zero liquidity");
    }

    /// @notice Removes liquidity from the pool
    function removeLiquidity(
        address tokenA, 
        address tokenB, 
        uint liquidity, 
        uint amountAMin, 
        uint amountBMin, 
        address to, 
        uint deadline
    ) external returns (uint amountA, uint amountB) {
        require(block.timestamp <= deadline, "Expired");

        uint _totalSupply = totalSupply();
        (uint reserveA, uint reserveB) = getReserves(tokenA, tokenB);

        amountA = liquidity * reserveA / _totalSupply;
        amountB = liquidity * reserveB / _totalSupply;

        require(amountA >= amountAMin, "Min A");
        require(amountB >= amountBMin, "Min B");

        _burn(msg.sender, liquidity);

        ERC20(tokenA).transfer(to, amountA);
        ERC20(tokenB).transfer(to, amountB);

        updateReserves(tokenA, tokenB, reserveA - amountA, reserveB - amountB);
        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB);
    }

    /// @notice Gets price of tokenA in terms of tokenB
    function getPrice(address tokenA, address tokenB) external view returns (uint price) {
        (uint reserveA, uint reserveB) = getReserves(tokenA, tokenB);
        require(reserveA > 0, "No liquidity A");
        price = reserveB * 1e18 / reserveA;
    }

    /// @notice Estimates output amount for a given input

    function getAmountOut(
    uint amountIn,
    uint reserveIn,
    uint reserveOut
    ) pure external returns (uint amountOut) {
    require(amountIn > 0, "Amount must be > 0");
    require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
    amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    /// @notice Swaps a fixed amount of input tokens for as many output tokens as possible
    /// @param amountIn Amount of input tokens
    /// @param amountOutMin Minimum accepted output
    /// @param path Array with [tokenIn, tokenOut]
    /// @param to Recipient address
    /// @param deadline Timestamp after which the tx reverts
function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Deadline expired");
        require(path.length == 2, "Only 1-step swaps supported");

        address tokenIn = path[0];
        address tokenOut = path[1];

        (uint reserveIn, uint reserveOut) = getReserves(tokenIn, tokenOut);
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");

        uint amountOut = this.getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "Insufficient output amount");

        ERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        ERC20(tokenOut).transfer(to, amountOut);

        updateReserves(tokenIn, tokenOut, reserveIn + amountIn, reserveOut - amountOut);

        amounts = new uint[](2) ;
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        return amounts;
    }

    /// @dev Computes square root of a number using Babylonian method
    function _sqrt(uint y) private pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}