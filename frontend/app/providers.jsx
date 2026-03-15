"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HARDHAT_LOCAL, BASE_SEPOLIA, BASE_MAINNET } from "@/lib/contract";

const config = createConfig({
  chains: [HARDHAT_LOCAL, BASE_SEPOLIA, BASE_MAINNET],
  transports: {
    [HARDHAT_LOCAL.id]: http("http://127.0.0.1:8545"),
    [BASE_SEPOLIA.id]: http(),
    [BASE_MAINNET.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
