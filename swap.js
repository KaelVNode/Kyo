import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk"; // Terminal color library

dotenv.config();

// ASCII Art "Saandy"
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

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const address = wallet.address;

// Uniswap V2 Router Contract
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
];

// Initialize contract
const router = new ethers.Contract(routerAddress, routerABI, wallet);

// Token and WETH addresses
const WETH = "0x4200000000000000000000000000000000000006"; 
const tokenOut = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369"; 
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; 

// Function to fetch balance and transaction count from RPC
async function getAccountDetails() {
    try {
        // Fetch ETH balance from RPC
        const balanceWei = await provider.getBalance(address);
        const balanceEth = ethers.formatEther(balanceWei);

        // Fetch transaction count from RPC (nonce)
        const txCount = await provider.getTransactionCount(address);

        console.log(chalk.cyan(`🔹 Address: ${address}`));
        console.log(chalk.yellow(`💰 Balance: ${balanceEth} ETH`));
        console.log(chalk.green(`📊 Total Transactions: ${txCount}`));

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
        console.log(chalk.yellow(`🔄 Preparing swap for ${ethers.formatEther(amountIn)} ETH...`));

        const path = [WETH, tokenOut];
        const amountOutMin = 0; // No slippage handling for now

        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            { value: amountIn }
        );

        console.log(chalk.green(`✅ Swapping ETH for tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("✔ Swap complete!"));
    } catch (error) {
        console.error(chalk.red("❌ Error swapping tokens:"), error);
    }
}

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
(async () => {
    const accountDetails = await getAccountDetails();
    
    if (!accountDetails) return;

    // Get user input
    const ethPerSwap = await askQuestion("💰 Enter amount of ETH per swap: ");
    const swapCount = await askQuestion("🔄 Enter number of swaps: ");

    const ethAmount = ethers.parseUnits(ethPerSwap, "ether");
    const totalEthNeeded = ethAmount * BigInt(swapCount);

    // Check if balance is sufficient
    if (parseFloat(accountDetails.balanceEth) < parseFloat(ethers.formatEther(totalEthNeeded))) {
        console.log(chalk.red("❌ Not enough balance to execute all swaps!"));
        return;
    }

    console.log(chalk.magenta(`🚀 Starting ${swapCount} swaps of ${ethPerSwap} ETH each...`));

    for (let i = 0; i < swapCount; i++) {
        console.log(chalk.cyan(`🔹 Swap ${i + 1} of ${swapCount}...`));
        await swapETHForTokens(ethAmount);

        if (i < swapCount - 1) {
            console.log(chalk.blue("⏳ Waiting 5 seconds before next swap..."));
            await delay(5000);
        }
    }

    console.log(chalk.green("🎉 All swaps completed!"));
})();
