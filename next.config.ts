import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
        }

        // Add WASM MIME type
        config.module.rules.push({
            test: /\.wasm$/,
            type: 'asset/resource',
        })

        return config
    },
};

export default nextConfig;
