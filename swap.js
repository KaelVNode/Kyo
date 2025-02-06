import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const routerAddress = "0x0dC73Fe1341365929Ed8a89Dd47097A9FDD254D0";
const routerABI = [
    {"inputs":[{"internalType":"address","name":"_factory","type":"address"},{"internalType":"address","name":"_WETH9","type":"address"},{"internalType":"bytes32","name":"initCodeHash","type":"bytes32"}],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[],"name":"WETH9","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"}],"internalType":"struct ISwapRouter.ExactInputParams","name":"params","type":"tuple"}],"name":"exactInput","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct ISwapRouter.ExactInputSingleParams","name":"params","type":"tuple"}],"name":"exactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"}
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

const tokenIn = "ETH";
const tokenOut = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369"; // Replace with target token
const amountIn = ethers.parseEther("0.1"); // Amount of ETH to swap
const slippage = 0.01; // 1% slippage
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 min

async function swapTokens() {
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    const minAmountOut = amounts[1] * (1 - slippage);
    
    const tx = await router.exactInputSingle({
        tokenIn,
        tokenOut,
        fee: 3000,
        recipient: wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
    }, { value: amountIn });

    console.log(`Swapping ETH for tokens... TX: ${tx.hash}`);
    await tx.wait();
    console.log("Swap complete!");
}

swapTokens().catch(console.error);
