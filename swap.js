import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk"; // Terminal color library

dotenv.config();

// ASCII Art "Saandy"
console.log(chalk.green(`
  ██████ ▄▄▄     ▄▄▄      ███▄    █▓█████▓██   ██▓
▒██    ▒▒████▄  ▒████▄    ██ ▀█   █▒██▀ ██▒██  ██▒
░ ▓██▄  ▒██  ▀█▄▒██  ▀█▄ ▓██  ▀█ ██░██   █▌▒██ ██░
  ▒   ██░██▄▄▄▄█░██▄▄▄▄██▓██▒  ▐▌██░▓█▄   ▌░ ▐██▓░
▒██████▒▒▓█   ▓██▓█   ▓██▒██░   ▓██░▒████▓ ░ ██▒▓░
▒ ▒▓▒ ▒ ░▒▒   ▓▒█▒▒   ▓▒█░ ▒░   ▒ ▒ ▒▒▓  ▒  ██▒▒▒ 
░ ░▒  ░ ░ ▒   ▒▒ ░▒   ▒▒ ░ ░░   ░ ▒░░ ▒  ▒▓██ ░▒░ 
░  ░  ░   ░   ▒   ░   ▒     ░   ░ ░ ░ ░  ░▒ ▒ ░░  
      ░       ░  ░    ░  ░        ░   ░   ░ ░     
                                    ░     ░ ░     
`));

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const address = wallet.address;

// Uniswap V2 Router Contract
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
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

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369"; 
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; 

// Fungsi untuk mendapatkan saldo token
async function getTokenBalance(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(chalk.green(`? Balance of ${tokenAddress}: ${ethers.formatEther(balance)}`));
        return balance;
    } catch (error) {
        console.error(chalk.red(`? Error fetching balance for ${tokenAddress}:`), error);
        return BigInt(0);
    }
}

// Fungsi untuk approve token sebelum swap
async function approveToken(tokenAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
        const tx = await tokenContract.approve(routerAddress, amount);
        console.log(chalk.blue(`?? Approving ${ethers.formatEther(amount)} tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Token approval successful!"));
    } catch (error) {
        console.error(chalk.red("? Error approving token:"), error);
    }
}

// Fungsi untuk swap ETH ke USDC
async function swapETHForUSDC(amountIn) {
    try {
        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(amountIn)} ETH to USDC...`));

        const path = [WETH, USDC];
        const amountOutMin = 0;

        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            { value: amountIn }
        );

        console.log(chalk.green(`? Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Error swapping ETH for USDC:"), error);
    }
}

// Fungsi untuk swap USDC ke WETH setelah 5 kali swap
async function swapUSDCForWETH() {
    try {
        const usdcBalance = await getTokenBalance(USDC);

        if (usdcBalance === BigInt(0)) {
            console.log(chalk.red("? No USDC balance available to swap back!"));
            return;
        }

        console.log(chalk.yellow(`?? Swapping ${ethers.formatEther(usdcBalance)} USDC to WETH...`));

        const path = [USDC, WETH];
        const amountOutMin = 0;

        await approveToken(USDC, usdcBalance);

        const tx = await router.swapExactTokensForTokens(
            usdcBalance,
            amountOutMin,
            path,
            wallet.address,
            deadline
        );

        console.log(chalk.green(`? Swap back to WETH successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("? Error swapping USDC to WETH:"), error);
    }
}

// Fungsi delay dengan animasi hitungan mundur
async function delayWithCountdown(ms) {
    console.log(chalk.blue(`? Waiting ${ms / 1000} seconds before next swap...`));
    for (let i = ms / 1000; i > 0; i--) {
        process.stdout.write(chalk.cyan(`\r? ${i}s remaining... `));
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(chalk.green("\n? Resuming swaps..."));
}

// Fungsi untuk mendapatkan input pengguna
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

// Eksekusi utama
(async () => {
    const ethPerSwap = await askQuestion("?? Enter amount of ETH per swap: ");
    const swapCount = await askQuestion("?? Enter number of swaps before swapping USDC back: ");
    const delayTime = await askQuestion("? Enter delay time between swaps (seconds): ");

    const ethAmount = ethers.parseEther(ethPerSwap);
    const totalSwaps = parseInt(swapCount);
    const delayMs = parseInt(delayTime) * 1000;

    console.log(chalk.magenta(`?? Starting swaps: ${totalSwaps} swaps of ${ethPerSwap} ETH each...`));

    for (let i = 0; i < totalSwaps; i++) {
        console.log(chalk.cyan(`?? Swap ${i + 1} of ${totalSwaps}...`));
        await swapETHForUSDC(ethAmount);

        if ((i + 1) % 5 === 0) {
            console.log(chalk.magenta("?? Swapping accumulated USDC back to WETH..."));
            await swapUSDCForWETH();
        }

        if (i < totalSwaps - 1) {
            await delayWithCountdown(delayMs);
        }
    }

    console.log(chalk.magenta("?? Swapping any remaining USDC back to WETH..."));
    await swapUSDCForWETH();

    console.log(chalk.green("?? All swaps completed!"));
})();

// Initialize contract
const router = new ethers.Contract(routerAddress, routerABI, wallet);

// Token and WETH addresses
const WETH = "0x4200000000000000000000000000000000000006"; 
const tokenOut = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369"; 
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; 

// Function to fetch balance and transaction count from RPC
async function getAccountDetails() {
    try {
        const balanceWei = await provider.getBalance(address);
        const balanceEth = ethers.formatEther(balanceWei);
        const txCount = await provider.getTransactionCount(address);

        console.log(chalk.cyan(`🔹 Address: ${address}`));
        console.log(chalk.yellow(`💰 Balance: ${balanceEth} ETH`));
        console.log(chalk.green(`📜 Total Transactions: ${txCount}`));

        return { balanceEth, txCount };
    } catch (error) {
        console.error(chalk.red("❌ Error fetching account details:"), error);
        return null;
    }
}

// Function to get user input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(chalk.blue(query), ans => {
        rl.close();
        resolve(ans);
    }));
}

// Function to swap ETH for tokens
async function swapETHForTokens(amountIn) {
    try {
        console.log(chalk.yellow(`🛠 Swapping ${ethers.formatEther(amountIn)} ETH...`));

        const path = [WETH, tokenOut];
        const amountOutMin = 0;

        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            { value: amountIn }
        );

        console.log(chalk.green(`✅ Swap successful! TX: ${tx.hash}`));
        await tx.wait();
    } catch (error) {
        console.error(chalk.red("❌ Error swapping tokens:"), error);
    }
}

// Countdown function with color
async function countdown(seconds) {
    return new Promise((resolve) => {
        let counter = seconds;
        const interval = setInterval(() => {
            process.stdout.write(chalk.red(`\r⏳ Waiting ${counter} seconds before next swap... `));
            counter--;

            if (counter < 0) {
                clearInterval(interval);
                process.stdout.write(chalk.green("\r✔ Proceeding to next swap!\n"));
                resolve();
            }
        }, 1000);
    });
}

// Main execution
(async () => {
    const accountDetails = await getAccountDetails();
    if (!accountDetails) return;

    const ethPerSwap = await askQuestion("💰 Enter amount of ETH per swap: ");
    const swapCount = await askQuestion("🛠 Enter number of swaps: ");
    let delayTime = await askQuestion("⏳ Enter delay between swaps (seconds, default 5): ");

    if (!delayTime || isNaN(delayTime) || delayTime <= 0) {
        delayTime = 5; // Default to 5 seconds if input is invalid
    }

    console.log(chalk.cyan(`🔄 Delay set to ${delayTime} seconds per swap.`));

    const ethAmount = ethers.parseEther(ethPerSwap);
    const totalEthNeeded = ethAmount * BigInt(swapCount);

    if (parseFloat(accountDetails.balanceEth) < parseFloat(ethers.formatEther(totalEthNeeded))) {
        console.log(chalk.red("❌ Not enough balance to execute all swaps!"));
        return;
    }

    console.log(chalk.magenta(`🚀 Starting ${swapCount} swaps of ${ethPerSwap} ETH each...`));

    for (let i = 0; i < swapCount; i++) {
        await swapETHForTokens(ethAmount);

        if (i < swapCount - 1) {
            await countdown(delayTime);
        }
    }

    console.log(chalk.green("🎉 All swaps completed!"));
})();
