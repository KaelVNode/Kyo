import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

dotenv.config();

console.log(chalk.green(`
  ¦¦¦¦¦¦ ___     ___      ¦¦¦_    ¦¦¦¦¦¦¦¦¦¦   ¦¦¦
¦¦¦    ¦¦¦¦¦¦_  ¦¦¦¦¦_    ¦¦ ¯¦   ¦¦¦¦¯ ¦¦¦¦¦  ¦¦¦
¦ ¦¦¦_  ¦¦¦  ¯¦_¦¦¦  ¯¦_ ¦¦¦  ¯¦ ¦¦¦¦¦   ¦¦¦¦¦ ¦¦¦
  ¦   ¦¦¦¦¦____¦¦¦¦____¦¦¦¦¦¦  ¦¦¦¦¦¦¦_   ¦¦ ¦¦¦¦¦
¦¦¦¦¦¦¦¦¦¦¦   ¦¦¦¦¦   ¦¦¦¦¦¦¦   ¦¦¦¦¦¦¦¦¦¦ ¦ ¦¦¦¦¦
¦ ¦¦¦ ¦ ¦¦¦   ¦¦¦¦¦   ¦¦¦¦ ¦¦   ¦ ¦ ¦¦¦  ¦  ¦¦¦¦¦ 
¦ ¦¦  ¦ ¦ ¦   ¦¦ ¦¦   ¦¦ ¦ ¦¦   ¦ ¦¦¦ ¦  ¦¦¦¦ ¦¦¦ 
¦  ¦  ¦   ¦   ¦   ¦   ¦     ¦   ¦ ¦ ¦ ¦  ¦¦ ¦ ¦¦  
      ¦       ¦  ¦    ¦  ¦        ¦   ¦   ¦ ¦     
                                    ¦     ¦ ¦     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint)",
    "function approve(address spender, uint amount) external returns (bool)"
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance: ${ethers.formatEther(balance)} tokens`));
        return balance;
    } catch (error) {
        console.error(chalk.red("? Error fetching balance:"), error);
        return BigInt(0);
    }
}

async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));
        const path = [WETH, USDC];
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline, { value: amountIn }
        );
        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);
        if (usdcBalance === BigInt(0)) return console.log(chalk.red("? No USDC available!"));
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));
        await approveToken(USDC, usdcBalance);
        const path = [USDC, WETH];
        const tx = await router.swapExactTokensForTokens(
            usdcBalance, 0, path, wallet.address, deadline
        );
        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function delay(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds...`));
    await new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

(async () => {
    try {
        const ethPerSwap = await askQuestion("?? Enter ETH per swap: ");
        const swapCount = await askQuestion("?? Number of swaps: ");
        const delayTime = await askQuestion("? Delay time between swaps (seconds): ");

        const ethAmount = ethers.parseEther(ethPerSwap);
        const totalSwaps = parseInt(swapCount);
        const delayMs = parseInt(delayTime) * 1000;

        if (isNaN(totalSwaps) || isNaN(delayMs) || ethAmount <= 0) {
            console.log(chalk.red("? Invalid input! Exiting..."));
            return;
        }

        console.log(chalk.magenta(`?? Starting ${totalSwaps} swaps of ${ethPerSwap} ETH...`));

        for (let i = 0; i < totalSwaps; i++) {
            console.log(chalk.cyan(`?? Swap ${i + 1}/${totalSwaps}...`));
            await swapETHForUSDC(ethAmount);
            if (i < totalSwaps - 1) await delay(delayMs);
        }
        console.log(chalk.magenta("?? Finalizing swaps..."));
        await swapUSDCForWETH();
        console.log(chalk.green("?? All swaps completed!"));
    } catch (error) {
        console.error(chalk.red("? Fatal error:"), error);
    }
})();
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

dotenv.config();

console.log(chalk.green(`
  ¦¦¦¦¦¦ ___     ___      ¦¦¦_    ¦¦¦¦¦¦¦¦¦¦   ¦¦¦
¦¦¦    ¦¦¦¦¦¦_  ¦¦¦¦¦_    ¦¦ ¯¦   ¦¦¦¦¯ ¦¦¦¦¦  ¦¦¦
¦ ¦¦¦_  ¦¦¦  ¯¦_¦¦¦  ¯¦_ ¦¦¦  ¯¦ ¦¦¦¦¦   ¦¦¦¦¦ ¦¦¦
  ¦   ¦¦¦¦¦____¦¦¦¦____¦¦¦¦¦¦  ¦¦¦¦¦¦¦_   ¦¦ ¦¦¦¦¦
¦¦¦¦¦¦¦¦¦¦¦   ¦¦¦¦¦   ¦¦¦¦¦¦¦   ¦¦¦¦¦¦¦¦¦¦ ¦ ¦¦¦¦¦
¦ ¦¦¦ ¦ ¦¦¦   ¦¦¦¦¦   ¦¦¦¦ ¦¦   ¦ ¦ ¦¦¦  ¦  ¦¦¦¦¦ 
¦ ¦¦  ¦ ¦ ¦   ¦¦ ¦¦   ¦¦ ¦ ¦¦   ¦ ¦¦¦ ¦  ¦¦¦¦ ¦¦¦ 
¦  ¦  ¦   ¦   ¦   ¦   ¦     ¦   ¦ ¦ ¦ ¦  ¦¦ ¦ ¦¦  
      ¦       ¦  ¦    ¦  ¦        ¦   ¦   ¦ ¦     
                                    ¦     ¦ ¦     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint)",
    "function approve(address spender, uint amount) external returns (bool)"
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance: ${ethers.formatEther(balance)} tokens`));
        return balance;
    } catch (error) {
        console.error(chalk.red("? Error fetching balance:"), error);
        return BigInt(0);
    }
}

async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));
        const path = [WETH, USDC];
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline, { value: amountIn }
        );
        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);
        if (usdcBalance === BigInt(0)) return console.log(chalk.red("? No USDC available!"));
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));
        await approveToken(USDC, usdcBalance);
        const path = [USDC, WETH];
        const tx = await router.swapExactTokensForTokens(
            usdcBalance, 0, path, wallet.address, deadline
        );
        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function delay(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds...`));
    await new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

(async () => {
    try {
        const ethPerSwap = await askQuestion("?? Enter ETH per swap: ");
        const swapCount = await askQuestion("?? Number of swaps: ");
        const delayTime = await askQuestion("? Delay time between swaps (seconds): ");

        const ethAmount = ethers.parseEther(ethPerSwap);
        const totalSwaps = parseInt(swapCount);
        const delayMs = parseInt(delayTime) * 1000;

        if (isNaN(totalSwaps) || isNaN(delayMs) || ethAmount <= 0) {
            console.log(chalk.red("? Invalid input! Exiting..."));
            return;
        }

        console.log(chalk.magenta(`?? Starting ${totalSwaps} swaps of ${ethPerSwap} ETH...`));

        for (let i = 0; i < totalSwaps; i++) {
            console.log(chalk.cyan(`?? Swap ${i + 1}/${totalSwaps}...`));
            await swapETHForUSDC(ethAmount);
            if (i < totalSwaps - 1) await delay(delayMs);
        }
        console.log(chalk.magenta("?? Finalizing swaps..."));
        await swapUSDCForWETH();
        console.log(chalk.green("?? All swaps completed!"));
    } catch (error) {
        console.error(chalk.red("? Fatal error:"), error);
    }
})();
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

dotenv.config();

console.log(chalk.green(`
  ¦¦¦¦¦¦ ___     ___      ¦¦¦_    ¦¦¦¦¦¦¦¦¦¦   ¦¦¦
¦¦¦    ¦¦¦¦¦¦_  ¦¦¦¦¦_    ¦¦ ¯¦   ¦¦¦¦¯ ¦¦¦¦¦  ¦¦¦
¦ ¦¦¦_  ¦¦¦  ¯¦_¦¦¦  ¯¦_ ¦¦¦  ¯¦ ¦¦¦¦¦   ¦¦¦¦¦ ¦¦¦
  ¦   ¦¦¦¦¦____¦¦¦¦____¦¦¦¦¦¦  ¦¦¦¦¦¦¦_   ¦¦ ¦¦¦¦¦
¦¦¦¦¦¦¦¦¦¦¦   ¦¦¦¦¦   ¦¦¦¦¦¦¦   ¦¦¦¦¦¦¦¦¦¦ ¦ ¦¦¦¦¦
¦ ¦¦¦ ¦ ¦¦¦   ¦¦¦¦¦   ¦¦¦¦ ¦¦   ¦ ¦ ¦¦¦  ¦  ¦¦¦¦¦ 
¦ ¦¦  ¦ ¦ ¦   ¦¦ ¦¦   ¦¦ ¦ ¦¦   ¦ ¦¦¦ ¦  ¦¦¦¦ ¦¦¦ 
¦  ¦  ¦   ¦   ¦   ¦   ¦     ¦   ¦ ¦ ¦ ¦  ¦¦ ¦ ¦¦  
      ¦       ¦  ¦    ¦  ¦        ¦   ¦   ¦ ¦     
                                    ¦     ¦ ¦     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint)",
    "function approve(address spender, uint amount) external returns (bool)"
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance: ${ethers.formatEther(balance)} tokens`));
        return balance;
    } catch (error) {
        console.error(chalk.red("? Error fetching balance:"), error);
        return BigInt(0);
    }
}

async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));
        const path = [WETH, USDC];
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline, { value: amountIn }
        );
        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);
        if (usdcBalance === BigInt(0)) return console.log(chalk.red("? No USDC available!"));
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));
        await approveToken(USDC, usdcBalance);
        const path = [USDC, WETH];
        const tx = await router.swapExactTokensForTokens(
            usdcBalance, 0, path, wallet.address, deadline
        );
        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function delay(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds...`));
    await new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

(async () => {
    try {
        const ethPerSwap = await askQuestion("?? Enter ETH per swap: ");
        const swapCount = await askQuestion("?? Number of swaps: ");
        const delayTime = await askQuestion("? Delay time between swaps (seconds): ");

        const ethAmount = ethers.parseEther(ethPerSwap);
        const totalSwaps = parseInt(swapCount);
        const delayMs = parseInt(delayTime) * 1000;

        if (isNaN(totalSwaps) || isNaN(delayMs) || ethAmount <= 0) {
            console.log(chalk.red("? Invalid input! Exiting..."));
            return;
        }

        console.log(chalk.magenta(`?? Starting ${totalSwaps} swaps of ${ethPerSwap} ETH...`));

        for (let i = 0; i < totalSwaps; i++) {
            console.log(chalk.cyan(`?? Swap ${i + 1}/${totalSwaps}...`));
            await swapETHForUSDC(ethAmount);
            if (i < totalSwaps - 1) await delay(delayMs);
        }
        console.log(chalk.magenta("?? Finalizing swaps..."));
        await swapUSDCForWETH();
        console.log(chalk.green("?? All swaps completed!"));
    } catch (error) {
        console.error(chalk.red("? Fatal error:"), error);
    }
})();
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

dotenv.config();

console.log(chalk.green(`
  ¦¦¦¦¦¦ ___     ___      ¦¦¦_    ¦¦¦¦¦¦¦¦¦¦   ¦¦¦
¦¦¦    ¦¦¦¦¦¦_  ¦¦¦¦¦_    ¦¦ ¯¦   ¦¦¦¦¯ ¦¦¦¦¦  ¦¦¦
¦ ¦¦¦_  ¦¦¦  ¯¦_¦¦¦  ¯¦_ ¦¦¦  ¯¦ ¦¦¦¦¦   ¦¦¦¦¦ ¦¦¦
  ¦   ¦¦¦¦¦____¦¦¦¦____¦¦¦¦¦¦  ¦¦¦¦¦¦¦_   ¦¦ ¦¦¦¦¦
¦¦¦¦¦¦¦¦¦¦¦   ¦¦¦¦¦   ¦¦¦¦¦¦¦   ¦¦¦¦¦¦¦¦¦¦ ¦ ¦¦¦¦¦
¦ ¦¦¦ ¦ ¦¦¦   ¦¦¦¦¦   ¦¦¦¦ ¦¦   ¦ ¦ ¦¦¦  ¦  ¦¦¦¦¦ 
¦ ¦¦  ¦ ¦ ¦   ¦¦ ¦¦   ¦¦ ¦ ¦¦   ¦ ¦¦¦ ¦  ¦¦¦¦ ¦¦¦ 
¦  ¦  ¦   ¦   ¦   ¦   ¦     ¦   ¦ ¦ ¦ ¦  ¦¦ ¦ ¦¦  
      ¦       ¦  ¦    ¦  ¦        ¦   ¦   ¦ ¦     
                                    ¦     ¦ ¦     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint)",
    "function approve(address spender, uint amount) external returns (bool)"
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance: ${ethers.formatEther(balance)} tokens`));
        return balance;
    } catch (error) {
        console.error(chalk.red("? Error fetching balance:"), error);
        return BigInt(0);
    }
}

async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));
        const path = [WETH, USDC];
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline, { value: amountIn }
        );
        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);
        if (usdcBalance === BigInt(0)) return console.log(chalk.red("? No USDC available!"));
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));
        await approveToken(USDC, usdcBalance);
        const path = [USDC, WETH];
        const tx = await router.swapExactTokensForTokens(
            usdcBalance, 0, path, wallet.address, deadline
        );
        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function delay(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds...`));
    await new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

(async () => {
    try {
        const ethPerSwap = await askQuestion("?? Enter ETH per swap: ");
        const swapCount = await askQuestion("?? Number of swaps: ");
        const delayTime = await askQuestion("? Delay time between swaps (seconds): ");

        const ethAmount = ethers.parseEther(ethPerSwap);
        const totalSwaps = parseInt(swapCount);
        const delayMs = parseInt(delayTime) * 1000;

        if (isNaN(totalSwaps) || isNaN(delayMs) || ethAmount <= 0) {
            console.log(chalk.red("? Invalid input! Exiting..."));
            return;
        }

        console.log(chalk.magenta(`?? Starting ${totalSwaps} swaps of ${ethPerSwap} ETH...`));

        for (let i = 0; i < totalSwaps; i++) {
            console.log(chalk.cyan(`?? Swap ${i + 1}/${totalSwaps}...`));
            await swapETHForUSDC(ethAmount);
            if (i < totalSwaps - 1) await delay(delayMs);
        }
        console.log(chalk.magenta("?? Finalizing swaps..."));
        await swapUSDCForWETH();
        console.log(chalk.green("?? All swaps completed!"));
    } catch (error) {
        console.error(chalk.red("? Fatal error:"), error);
    }
})();
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

dotenv.config();

console.log(chalk.green(`
  ¦¦¦¦¦¦ ___     ___      ¦¦¦_    ¦¦¦¦¦¦¦¦¦¦   ¦¦¦
¦¦¦    ¦¦¦¦¦¦_  ¦¦¦¦¦_    ¦¦ ¯¦   ¦¦¦¦¯ ¦¦¦¦¦  ¦¦¦
¦ ¦¦¦_  ¦¦¦  ¯¦_¦¦¦  ¯¦_ ¦¦¦  ¯¦ ¦¦¦¦¦   ¦¦¦¦¦ ¦¦¦
  ¦   ¦¦¦¦¦____¦¦¦¦____¦¦¦¦¦¦  ¦¦¦¦¦¦¦_   ¦¦ ¦¦¦¦¦
¦¦¦¦¦¦¦¦¦¦¦   ¦¦¦¦¦   ¦¦¦¦¦¦¦   ¦¦¦¦¦¦¦¦¦¦ ¦ ¦¦¦¦¦
¦ ¦¦¦ ¦ ¦¦¦   ¦¦¦¦¦   ¦¦¦¦ ¦¦   ¦ ¦ ¦¦¦  ¦  ¦¦¦¦¦ 
¦ ¦¦  ¦ ¦ ¦   ¦¦ ¦¦   ¦¦ ¦ ¦¦   ¦ ¦¦¦ ¦  ¦¦¦¦ ¦¦¦ 
¦  ¦  ¦   ¦   ¦   ¦   ¦     ¦   ¦ ¦ ¦ ¦  ¦¦ ¦ ¦¦  
      ¦       ¦  ¦    ¦  ¦        ¦   ¦   ¦ ¦     
                                    ¦     ¦ ¦     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint)",
    "function approve(address spender, uint amount) external returns (bool)"
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance: ${ethers.formatEther(balance)} tokens`));
        return balance;
    } catch (error) {
        console.error(chalk.red("? Error fetching balance:"), error);
        return BigInt(0);
    }
}

async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));
        const path = [WETH, USDC];
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline, { value: amountIn }
        );
        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);
        if (usdcBalance === BigInt(0)) return console.log(chalk.red("? No USDC available!"));
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));
        await approveToken(USDC, usdcBalance);
        const path = [USDC, WETH];
        const tx = await router.swapExactTokensForTokens(
            usdcBalance, 0, path, wallet.address, deadline
        );
        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function delay(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds...`));
    await new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

(async () => {
    try {
        const ethPerSwap = await askQuestion("?? Enter ETH per swap: ");
        const swapCount = await askQuestion("?? Number of swaps: ");
        const delayTime = await askQuestion("? Delay time between swaps (seconds): ");

        const ethAmount = ethers.parseEther(ethPerSwap);
        const totalSwaps = parseInt(swapCount);
        const delayMs = parseInt(delayTime) * 1000;

        if (isNaN(totalSwaps) || isNaN(delayMs) || ethAmount <= 0) {
            console.log(chalk.red("? Invalid input! Exiting..."));
            return;
        }

        console.log(chalk.magenta(`?? Starting ${totalSwaps} swaps of ${ethPerSwap} ETH...`));

        for (let i = 0; i < totalSwaps; i++) {
            console.log(chalk.cyan(`?? Swap ${i + 1}/${totalSwaps}...`));
            await swapETHForUSDC(ethAmount);
            if (i < totalSwaps - 1) await delay(delayMs);
        }
        console.log(chalk.magenta("?? Finalizing swaps..."));
        await swapUSDCForWETH();
        console.log(chalk.green("?? All swaps completed!"));
    } catch (error) {
        console.error(chalk.red("? Fatal error:"), error);
    }
})();
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

dotenv.config();

console.log(chalk.green(`
  ¦¦¦¦¦¦ ___     ___      ¦¦¦_    ¦¦¦¦¦¦¦¦¦¦   ¦¦¦
¦¦¦    ¦¦¦¦¦¦_  ¦¦¦¦¦_    ¦¦ ¯¦   ¦¦¦¦¯ ¦¦¦¦¦  ¦¦¦
¦ ¦¦¦_  ¦¦¦  ¯¦_¦¦¦  ¯¦_ ¦¦¦  ¯¦ ¦¦¦¦¦   ¦¦¦¦¦ ¦¦¦
  ¦   ¦¦¦¦¦____¦¦¦¦____¦¦¦¦¦¦  ¦¦¦¦¦¦¦_   ¦¦ ¦¦¦¦¦
¦¦¦¦¦¦¦¦¦¦¦   ¦¦¦¦¦   ¦¦¦¦¦¦¦   ¦¦¦¦¦¦¦¦¦¦ ¦ ¦¦¦¦¦
¦ ¦¦¦ ¦ ¦¦¦   ¦¦¦¦¦   ¦¦¦¦ ¦¦   ¦ ¦ ¦¦¦  ¦  ¦¦¦¦¦ 
¦ ¦¦  ¦ ¦ ¦   ¦¦ ¦¦   ¦¦ ¦ ¦¦   ¦ ¦¦¦ ¦  ¦¦¦¦ ¦¦¦ 
¦  ¦  ¦   ¦   ¦   ¦   ¦     ¦   ¦ ¦ ¦ ¦  ¦¦ ¦ ¦¦  
      ¦       ¦  ¦    ¦  ¦        ¦   ¦   ¦ ¦     
                                    ¦     ¦ ¦     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369";
const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const erc20ABI = [
    "function balanceOf(address owner) view returns (uint)",
    "function approve(address spender, uint amount) external returns (bool)"
];

const router = new ethers.Contract(routerAddress, routerABI, wallet);

async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance: ${ethers.formatEther(balance)} tokens`));
        return balance;
    } catch (error) {
        console.error(chalk.red("? Error fetching balance:"), error);
        return BigInt(0);
    }
}

async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));
        const path = [WETH, USDC];
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline, { value: amountIn }
        );
        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);
        if (usdcBalance === BigInt(0)) return console.log(chalk.red("? No USDC available!"));
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));
        await approveToken(USDC, usdcBalance);
        const path = [USDC, WETH];
        const tx = await router.swapExactTokensForTokens(
            usdcBalance, 0, path, wallet.address, deadline
        );
        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Swap error:"), error);
    }
}

async function delay(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds...`));
    await new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

(async () => {
    try {
        const ethPerSwap = await askQuestion("?? Enter ETH per swap: ");
        const swapCount = await askQuestion("?? Number of swaps: ");
        const delayTime = await askQuestion("? Delay time between swaps (seconds): ");

        const ethAmount = ethers.parseEther(ethPerSwap);
        const totalSwaps = parseInt(swapCount);
        const delayMs = parseInt(delayTime) * 1000;

        if (isNaN(totalSwaps) || isNaN(delayMs) || ethAmount <= 0) {
            console.log(chalk.red("? Invalid input! Exiting..."));
            return;
        }

        console.log(chalk.magenta(`?? Starting ${totalSwaps} swaps of ${ethPerSwap} ETH...`));

        for (let i = 0; i < totalSwaps; i++) {
            console.log(chalk.cyan(`?? Swap ${i + 1}/${totalSwaps}...`));
            await swapETHForUSDC(ethAmount);
            if (i < totalSwaps - 1) await delay(delayMs);
        }
        console.log(chalk.magenta("?? Finalizing swaps..."));
        await swapUSDCForWETH();
        console.log(chalk.green("?? All swaps completed!"));
    } catch (error) {
        console.error(chalk.red("? Fatal error:"), error);
    }
})();
