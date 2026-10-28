const envConfig = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  paypalClientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "",
  appName: import.meta.env.VITE_APP_NAME || "Fintech Risk Engine",
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const;

export default envConfig;
