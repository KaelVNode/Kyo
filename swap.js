import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// Inisialisasi provider dan wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Alamat dan ABI Router Uniswap V2
const routerAddress = "0x3c56C7C1Bfd9dbC14Ab04935f409d49D3b7A802E";
const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
];

// Inisialisasi kontrak router
const router = new ethers.Contract(routerAddress, routerABI, wallet);

// Alamat token tujuan dan WETH di jaringan Soneium
const WETH = "0x4200000000000000000000000000000000000006"; // Ganti dengan alamat WETH di jaringan Soneium
const tokenOut = "0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369"; // Ganti dengan alamat token tujuan
const amountIn = ethers.parseEther("0.000001"); // Jumlah ETH yang akan ditukar
const slippage = 0.01; // 1% slippage
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 menit

async function swapETHForTokens() {
    try {
        // Tentukan jalur swap: WETH -> Token
        const path = [WETH, tokenOut];

        // Tentukan jumlah minimum token yang diterima (gunakan perkiraan manual atau panggil getAmountsOut jika tersedia)
        const amountOutMin = 0; // Sementara, Anda bisa gunakan data dari frontend DEX

        // Lakukan swap
        const tx = await router.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            { value: amountIn }
        );

        console.log(`Swapping ETH for tokens... TX: ${tx.hash}`);
        await tx.wait();
        console.log("Swap complete!");
    } catch (error) {
        console.error("Error swapping tokens:", error);
    }
}

swapETHForTokens();
