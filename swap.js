import fetch from "node-fetch";
import { ethers } from "ethers";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk"; // Import chalk untuk pewarnaan terminal

dotenv.config();

// Inisialisasi provider dan wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// API Explorer Blockscout
const API_KEY = "c9192483-2036-42d6-9d5f-5096b48dff0d";
const EXPLORER_API = "https://soneium.blockscout.com/api";
const address = wallet.address;

// Alamat dan ABI Router Uniswap V2
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
];

// Inisialisasi kontrak router
const router = new ethers.Contract(routerAddress, routerABI, wallet);

// Alamat token tujuan dan WETH di jaringan Soneium
const WETH = "0x4200000000000000000000000000000000000006"; 
const tokenOut = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369"; 
const slippage = 0.01; 
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; 

// Fungsi untuk mengambil informasi akun
async function getAccountDetails() {
    try {
        const balanceResponse = await fetch(`${EXPLORER_API}?module=account&action=balance&address=${address}&apikey=${API_KEY}`);
        const balanceData = await balanceResponse.json();
        const balanceEth = ethers.formatEther(balanceData.result);

        const txCountResponse = await fetch(`${EXPLORER_API}?module=account&action=txlist&address=${address}&apikey=${API_KEY}`);
        const txCountData = await txCountResponse.json();
        const txCount = txCountData.result.length;

        console.log(chalk.cyan(`?? Address: ${address}`));
        console.log(chalk.yellow(`?? Balance: ${balanceEth} ETH`));
        console.log(chalk.green(`?? Total Transactions: ${txCount}`));

        return { balanceEth, txCount };
    } catch (error) {
        console.error(chalk.red("? Error fetching account details:"), error);
        return null;
    }
}

// Fungsi untuk membaca input dari pengguna
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

// Fungsi untuk melakukan swap ETH ke Token
async function swapETHForTokens(amountIn) {
    try {
        console.log(chalk.yellow(`? Preparing swap for ${ethers.formatEther(amountIn)} ETH...`));

        const path = [WETH, tokenOut];
        const amountOutMin = 0;

        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            { value: amountIn }
        );

        console.log(chalk.green(`?? Swapping ETH for tokens... TX: ${tx.hash}`));
        await tx.wait();
        console.log(chalk.green("? Swap complete!"));
    } catch (error) {
        console.error(chalk.red("? Error swapping tokens:"), error);
    }
}

// Fungsi delay (jeda 5 detik antara swap)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Jalankan fungsi utama
(async () => {
    const accountDetails = await getAccountDetails();
    
    if (!accountDetails) return;

    // Minta input dari pengguna
    const ethPerSwap = await askQuestion("?? Masukkan jumlah ETH per swap: ");
    const swapCount = await askQuestion("?? Masukkan jumlah swap yang diinginkan: ");

    const ethAmount = ethers.parseEther(ethPerSwap);
    const totalEthNeeded = ethAmount * BigInt(swapCount);

    // Pastikan saldo cukup
    if (parseFloat(accountDetails.balanceEth) < parseFloat(ethers.formatEther(totalEthNeeded))) {
        console.log(chalk.red("?? Not enough balance to execute all swaps!"));
        return;
    }

    console.log(chalk.magenta(`?? Starting ${swapCount} swaps of ${ethPerSwap} ETH each...`));

    for (let i = 0; i < swapCount; i++) {
        console.log(chalk.cyan(`?? Swap ${i + 1} of ${swapCount}...`));
        await swapETHForTokens(ethAmount);

        if (i < swapCount - 1) {
            console.log(chalk.blue("? Waiting 5 seconds before next swap..."));
            await delay(5000);
        }
    }

    console.log(chalk.green("? All swaps completed!"));
})();
